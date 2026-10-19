/**
 * Ground-truth sampler shared by the harness scenarios.
 *
 * Ground truth is the video's own subtitle TextTrack: NRK's player loads the cues
 * there and paints the active one into span.tv-player-subtitle-text. Each sample
 * records the active cue next to what the extension is showing, so a report can
 * flag lines that were missed, lingered after their cue ended, or were showing the
 * previous line's translation.
 */

const SAMPLE = () => {
  const video = document.querySelector('video');
  const track = video && [...video.textTracks].find((t) => t.kind === 'subtitles' && t.mode !== 'disabled');
  const active = track && track.activeCues ? [...track.activeCues].map((c) => c.text).join('\n') : null;
  const span = document.querySelector('.tv-player-subtitle-text');
  const tr = [...document.querySelectorAll('.nrk-oversetter-translation')].find((e) => e.style.display !== 'none');
  const native = document.querySelector('tv-player-subtitles');
  const panel = document.getElementById('nrk-oversetter-panel')?.shadowRoot;
  const rows = panel ? [...panel.querySelectorAll('li:not([hidden])')] : [];
  const activeRow = panel?.querySelector('li.active');
  return {
    t: video ? +video.currentTime.toFixed(2) : null,
    paused: video ? video.paused : null,
    cue: active ? active.replace(/<[^>]+>/g, '').replace(/^Valgt undertekst:[\s\S]*/, '').trim() : '',
    span: span ? span.textContent.trim() : null,
    spanVisible: span ? span.offsetParent !== null && getComputedStyle(span).display !== 'none' : false,
    translation: tr ? tr.textContent : null,
    translationCount: [...document.querySelectorAll('.nrk-oversetter-translation')].filter((e) => e.style.display !== 'none').length,
    nativeVisible: native ? getComputedStyle(native).visibility !== 'hidden' : null,
    panel: panel
      ? {
          rows: rows.length,
          lastRow: rows.at(-1)?.querySelector('.no').textContent ?? null,
          active: activeRow?.querySelector('.no').textContent ?? null,
          activeEn: activeRow?.querySelector('.en:not(.pending)')?.textContent ?? null,
          status: panel.querySelector('footer')?.textContent ?? '',
        }
      : null,
  };
};

/** Sample every `interval` ms until stop() is called. */
function startSampling(page, { interval = 250 } = {}) {
  const samples = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      try {
        const s = await page.evaluate(SAMPLE);
        s.wall = Date.now();
        samples.push(s);
      } catch {
        // Page navigating - skip this tick
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  })();
  return {
    samples,
    async stop() {
      running = false;
      await loop;
      return samples;
    },
  };
}

function report(samples, label = '') {
  if (label) console.log(`\n===== ${label} =====`);
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

  console.log(`Sampled ${samples.length} times, video ${samples[0]?.t}s -> ${samples.at(-1)?.t}s`);
  console.log(`Cues on the TextTrack:                     ${cueRows.length}`);
  console.log(`  never got their own translation:         ${missed.length}`);
  console.log(`  showed the PREVIOUS line's translation:  ${staleRows.length}`);
  console.log(`  median latency cue -> translation:       ${median ?? '-'}s`);
  console.log(`Gaps where a translation lingered:         ${lingering.length}`);
  console.log(`Samples with >1 translation element:       ${duplicates.length}`);
  const withPanel = samples.filter((s) => s.panel);
  if (withPanel.length) {
    const norm = (x) => (x || '').replace(/\s+/g, ' ').trim();
    const panelMissed = cueRows.filter((r) => !withPanel.some((s) => norm(s.panel.active) === norm(r.cue) || norm(s.panel.lastRow) === norm(r.cue)));
    const activeWrong = withPanel.filter((s) => s.cue && s.panel.active !== null && norm(s.panel.active) !== norm(s.cue));
    const noEnglish = cueRows.filter((r) => !withPanel.some((s) => norm(s.cue) === norm(r.cue) && s.panel.activeEn));
    console.log(`Panel: cues never shown in history:        ${panelMissed.length}`);
    console.log(`Panel: samples with wrong active line:     ${activeWrong.length}`);
    console.log(`Panel: active cues with no English ready:  ${noEnglish.length}`);
    console.log(`Panel: NRK subtitles visible on video:     ${withPanel.filter((s) => s.nativeVisible).length}/${withPanel.length} samples`);
    console.log(`Panel: last status: ${withPanel.at(-1).panel.status}`);
    for (const r of panelMissed) console.log(`    not in panel: t=${r.t} ${JSON.stringify(r.cue.slice(0, 60))}`);
  }
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
  return { cueRows, missed, staleRows, lingering, duplicates };
}

module.exports = { startSampling, report, SAMPLE };
