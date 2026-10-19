/**
 * Audit the legacy DOM-scraping detector against ground truth.
 *
 * Ground truth is the video's own subtitle TextTrack: NRK's player loads the cues
 * there and paints the active one into span.tv-player-subtitle-text. Every 250 ms
 * we sample the active cue, NRK's span and the extension's translation element,
 * then report lines that were missed, lingered after their cue ended, or were
 * overwritten by a stale translation.
 *
 * Usage: node tools/harness/audit.cjs [episode-url] [seconds]
 */
const { launch, captureConsole } = require('./launch.cjs');

const DEFAULT_URL = 'https://tv.nrk.no/serie/humoretaten/sesong/4/episode/IUFH21002726?autoplay=true';

(async () => {
  const url = process.argv[2] || DEFAULT_URL;
  const seconds = Number(process.argv[3] || 60);
  const { context, close } = await launch();
  const page = await context.newPage();
  const logs = captureConsole(page);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  // A trusted click grants the user activation Chrome needs to download the model.
  // Click the page header, not the player, so playback is not toggled.
  await page.mouse.click(5, 5);

  const samples = [];
  const start = Date.now();
  while (Date.now() - start < seconds * 1000) {
    samples.push(
      await page.evaluate(() => {
        const video = document.querySelector('video');
        const track = video && [...video.textTracks].find((t) => t.kind === 'subtitles' && t.mode !== 'disabled');
        const active = track && track.activeCues ? [...track.activeCues].map((c) => c.text).join('\n') : null;
        const span = document.querySelector('.tv-player-subtitle-text');
        const tr = document.querySelector('.nrk-oversetter-translation');
        return {
          t: video ? +video.currentTime.toFixed(2) : null,
          paused: video ? video.paused : null,
          cue: active ? active.replace(/<[^>]+>/g, '').trim() : '',
          span: span ? span.textContent.trim() : null,
          spanVisible: span ? span.offsetParent !== null && getComputedStyle(span).display !== 'none' : false,
          translation: tr ? tr.textContent : null,
          translationCount: document.querySelectorAll('.nrk-oversetter-translation').length,
        };
      })
    );
    await page.waitForTimeout(250);
  }

  // Group consecutive samples into segments of one cue (or one gap)
  const segments = [];
  for (const s of samples) {
    const last = segments.at(-1);
    if (last && last.cue === s.cue) last.samples.push(s);
    else segments.push({ cue: s.cue, samples: [s] });
  }

  // A translation is "fresh" for a cue if it was not already on screen during the
  // previous cue. Anything else is the previous line's translation still showing.
  let previousTranslations = new Set();
  const rows = [];
  for (const seg of segments) {
    const seen = seg.samples.map((s) => s.translation || '');
    if (!seg.cue) {
      rows.push({ gap: true, t: seg.samples[0].t, lingering: seen.filter(Boolean).length });
      seen.filter(Boolean).forEach((x) => previousTranslations.add(x));
      continue;
    }
    const firstFresh = seg.samples.find((s) => s.translation && !previousTranslations.has(s.translation));
    const stale = seg.samples.filter((s) => s.translation && previousTranslations.has(s.translation)).length;
    rows.push({
      t: seg.samples[0].t,
      cue: seg.cue,
      duration: +(seg.samples.at(-1).t - seg.samples[0].t).toFixed(2),
      latency: firstFresh ? +(firstFresh.t - seg.samples[0].t).toFixed(2) : null,
      fresh: firstFresh ? firstFresh.translation : null,
      staleSamples: stale,
      spanVisible: seg.samples.some((s) => s.spanVisible),
    });
    previousTranslations = new Set(seen.filter(Boolean));
  }

  const cueRows = rows.filter((r) => !r.gap);
  const missed = cueRows.filter((r) => r.latency === null);
  const staleRows = cueRows.filter((r) => r.staleSamples > 0);
  const lingering = rows.filter((r) => r.gap && r.lingering > 0);
  const duplicates = samples.filter((s) => s.translationCount > 1);
  const latencies = cueRows.filter((r) => r.latency !== null).map((r) => r.latency);
  const median = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)];

  console.log(`\nSampled ${samples.length} times over ${seconds}s, video ${samples[0]?.t}s -> ${samples.at(-1)?.t}s`);
  console.log(`Cues on the TextTrack:                     ${cueRows.length}`);
  console.log(`  never got their own translation:         ${missed.length}`);
  console.log(`  showed the PREVIOUS line's translation:  ${staleRows.length}`);
  console.log(`  median latency cue -> translation:       ${median ?? '-'}s`);
  console.log(`Gaps where a translation lingered:         ${lingering.length}`);
  console.log(`Samples with >1 translation element:       ${duplicates.length}`);
  console.log('\nPer cue:');
  for (const r of rows) {
    if (r.gap) {
      if (r.lingering) console.log(`  t=${r.t}  (gap)  translation lingered for ${r.lingering} samples`);
      continue;
    }
    const status = r.latency === null ? 'MISSED' : `+${r.latency}s`;
    console.log(
      `  t=${r.t} (${r.duration}s) ${status.padEnd(7)} stale=${r.staleSamples}  ${JSON.stringify(r.cue.slice(0, 50))}` +
        (r.fresh ? `  ->  ${JSON.stringify(r.fresh.slice(0, 50))}` : '')
    );
  }
  console.log('\nExtension console:');
  for (const l of logs.slice(-40)) console.log('  ' + l);

  await close();
})();
