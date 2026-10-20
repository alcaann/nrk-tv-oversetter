/**
 * Record the "how to use it" tutorial against live tv.nrk.no: annotated
 * screenshots for the README and store (1280x800, the Chrome Web Store size),
 * an MP4 and a GIF.
 *
 * Drives the real extension like a first-time user, with callouts and a visible
 * cursor drawn by tutorial-overlay.js. Uses the harness profile, so the
 * translation model is already downloaded and nothing waits on it.
 *
 * Also saves clean-*.png (no callouts) for render-store-assets.cjs.
 *
 * Usage: npm run build && node tools/media/record-tutorial.cjs [out-dir]
 *   Needs ffmpeg on PATH. Default out-dir: docs/tutorial
 */
const { launch, REPO } = require('../harness/launch.cjs');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A calm sitcom scene: short everyday lines, and no names or captions drawn on
// the video that would compete with the callouts
const EPISODE = 'https://tv.nrk.no/serie/side-om-side/sesong/1/episode/1?autoplay=true';
const START_AT = 150; // seconds, past the opening credits
const WIDTH = 1280;
const HEIGHT = 800;
const OVERLAY = fs.readFileSync(path.join(__dirname, 'tutorial-overlay.js'), 'utf8');
const OUT = path.resolve(process.argv[2] || path.join(REPO, 'docs', 'tutorial'));

const FIRST_INSTALL = {
  enabled: false,
  onboarded: false,
  mode: 'dual',
  showOriginal: true,
  showTranslation: true,
  panelCollapsed: false,
  pauseOnHover: true,
  targetLanguage: 'en',
  position: 'below',
  fontSizeMode: 'relative',
  fontSizeScale: 0.75,
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'nrk-tutorial-frames-'));
  const { context, close, setSettings, extensionId } = await launch({ width: WIDTH, height: HEIGHT });

  try {
    await setSettings(FIRST_INSTALL);
    const page = await context.newPage();
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });

    // --- helpers --------------------------------------------------------------
    const overlay = () => page.evaluate(OVERLAY);
    const callout = (opts) => page.evaluate((o) => window.__tutorial.callout(o), opts);
    const clear = () => page.evaluate(() => window.__tutorial.clear());
    const banner = (title, text, opts) => page.evaluate(([t, x, o]) => window.__tutorial.banner(t, x, o), [title, text, opts]);
    const hideBanner = () => page.evaluate(() => window.__tutorial.hideBanner());
    const calmPlayer = (on) => page.evaluate((v) => window.__tutorial.calmPlayer(v), on);
    const holdSubtitlesUp = (on) => page.evaluate((v) => window.__tutorial.holdSubtitlesUp(v), on);
    const hideCursor = (hidden) => page.evaluate((v) => window.__tutorial.hideCursor(v), hidden);
    const shot = (name) => page.screenshot({ path: path.join(OUT, name) });
    const rectOf = async (locator) => {
      await locator.waitFor({ state: 'visible', timeout: 30000 });
      return locator.boundingBox();
    };
    // Children can reach outside their parent's box (NRK's menu rows do)
    const unionRectOf = async (locator) => {
      await locator.waitFor({ state: 'visible', timeout: 30000 });
      return locator.evaluate((el) => {
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const e of [el, ...el.querySelectorAll('*')]) {
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          left = Math.min(left, r.left); top = Math.min(top, r.top);
          right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
        }
        return { x: left, y: top, width: right - left, height: bottom - top };
      });
    };
    let mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
    const glide = async (x, y, steps = 28) => {
      await page.mouse.move(x, y, { steps });
      mouse = { x, y };
    };
    const glideTo = async (locator, steps) => {
      const r = await rectOf(locator);
      await glide(r.x + r.width / 2, r.y + r.height / 2, steps);
      return r;
    };
    // NRK hides its controls after a moment without pointer movement, and its
    // subtitles slide back down: keep the pointer alive, a pixel at a time
    const holdControls = async (ms) => {
      const end = Date.now() + ms;
      let nudge = 1;
      while (Date.now() < end) {
        await page.mouse.move(mouse.x + nudge, mouse.y);
        nudge = -nudge;
        await wait(400);
      }
      await page.mouse.move(mouse.x, mouse.y);
      const shown = await page.evaluate(() => !!document.querySelector('tv-player-subtitles.displace-subtitles'));
      if (!shown) console.warn('NRK hid its controls during a step that needs them');
    };
    const step = async (locator, opts, hold) => {
      const rect = locator ? await rectOf(locator) : null;
      await callout({ ...opts, rect });
      await wait(hold);
    };

    // --- the tutorial -----------------------------------------------------------
    // The title goes up on black before the page has drawn anything, and the
    // recording starts only once the video is playing from START_AT, so neither
    // the loading page nor the program's poster image shows
    await page.goto(EPISODE, { waitUntil: 'domcontentloaded' });
    await overlay();
    await banner('NRK TV <span>Oversetter</span>', 'Watch NRK in Norwegian, with the translation one glance away', { opaque: true });
    await calmPlayer(true);
    await page.mouse.move(mouse.x, mouse.y);
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, null, { timeout: 30000 });
    await page.evaluate((t) => { document.querySelector('video').currentTime = t; }, START_AT);
    await page.waitForFunction((t) => {
      const v = document.querySelector('video');
      return v && !v.paused && v.currentTime > t + 0.5;
    }, START_AT, { timeout: 30000 });
    const recorder = await startScreencast(page, frames);
    await wait(2800);
    await hideBanner();
    await wait(400);

    const card = page.locator('#nrk-oversetter-first-run .card');
    await step(card, {
      step: 1,
      title: 'Open any program on tv.nrk.no',
      text: 'The first time, the extension asks how you would like the subtitles.',
      placement: 'bottom',
    }, 3800);
    await shot('01-choose-mode.png');

    const dual = card.locator('button[data-choice="dual"]');
    await glideTo(dual);
    await step(dual, {
      step: 2,
      title: 'Dual subtitles',
      text: 'The translation under the Norwegian, right on the video. Picking a mode also downloads the translation model, once.',
      placement: 'bottom',
    }, 3800);
    await clear();
    await page.mouse.click(mouse.x, mouse.y);
    await glide(640, 760, 20);

    const translation = page.locator('.nrk-oversetter-translation:not(.is-notice)');
    await translation.waitFor({ state: 'visible', timeout: 40000 });
    await wait(600);
    await hideCursor(true);
    await shot('clean-dual.png');
    await hideCursor(false);
    await step(translation, {
      step: 2,
      title: 'Norwegian and English together',
      text: 'Each line is translated ahead of time, on your computer, so it appears with the Norwegian.',
      placement: 'left',
      at: { x: 16, y: 572 }, // beside the translation, clear of the Norwegian line above it
    }, 4500);
    await shot('02-dual-subtitles.png');
    await clear();

    // This step needs NRK's controls: reveal them, then open their subtitle menu
    await calmPlayer(false);
    await glide(500, 380, 15);
    const ccButton = page.locator('button[aria-label="Valg for undertekster og tilgjengelighet"]');
    await glideTo(ccButton);
    await step(ccButton, {
      step: 3,
      title: 'Change mode any time',
      text: "It's in NRK's own subtitle menu, so it works in fullscreen too.",
      placement: 'top',
    }, 0);
    await holdControls(3200);
    await holdSubtitlesUp(true);
    await clear();
    await page.mouse.click(mouse.x, mouse.y);

    const section = page.locator('[data-nrk-oversetter-menu]');
    await section.waitFor({ state: 'visible', timeout: 30000 });
    await wait(300);
    await callout({
      step: 3,
      title: 'Choose "Learning panel"',
      text: 'Our modes sit under "Oversetter", next to NRK\'s own subtitle options.',
      rect: await unionRectOf(section),
      aim: await rectOf(section.locator('button[data-mode="learning"]')),
      // Below the subtitles, rather than over them
      at: { x: 480, y: 555 },
    });
    await wait(3800);
    await shot('03-nrk-menu.png');
    const learning = section.locator('button[data-mode="learning"]');
    await glideTo(learning);
    await wait(500);
    await clear();
    await page.mouse.click(mouse.x, mouse.y);
    await wait(400);
    await page.keyboard.press('Escape');
    await glide(420, 300, 20);
    // Let NRK's controls fade out by themselves before hiding them again, so its
    // subtitles and ours come down together
    await page.waitForFunction(() => !document.querySelector('tv-player-subtitles.displace-subtitles'), null, { timeout: 10000 }).catch(() => {});
    await holdSubtitlesUp(false);
    await calmPlayer(true);

    // Let a few lines collect in the panel
    const rows = page.locator('#nrk-oversetter-panel li:not([hidden])');
    await page.waitForFunction(
      () => document.getElementById('nrk-oversetter-panel')?.shadowRoot.querySelectorAll('li:not([hidden])').length >= 4,
      null,
      { timeout: 60000 }
    );
    const panel = page.locator('#nrk-oversetter-panel .panel');
    await hideCursor(true);
    await shot('clean-panel.png');
    await hideCursor(false);
    await step(panel, {
      step: 4,
      title: 'The learning panel',
      text: 'Every line so far, in Norwegian. The translation stays hidden, so you keep listening in Norwegian.',
      placement: 'left',
    }, 4800);
    await shot('04-learning-panel.png');
    await clear();

    // Slide straight into the panel at the line's height: the video pauses as the
    // pointer enters, so no new line scrolls the list before it reaches the row
    const panelRect = await rectOf(panel);
    const count = await rows.count();
    const row = rows.nth(Math.max(0, count - 2));
    const approach = await rectOf(row);
    await glide(panelRect.x + 16, approach.y + approach.height / 2, 36);
    await wait(500);
    await glideTo(row, 14);
    await wait(700);
    await step(row, {
      step: 5,
      title: "Hover a line you didn't catch",
      text: 'Its translation appears, and the video pauses while you read.',
      placement: 'left',
    }, 4800);
    await shot('05-hover-to-reveal.png');

    const time = row.locator('.time');
    await glideTo(time, 14);
    await step(time, {
      step: 5,
      title: 'Click the time to hear it again',
      text: 'Playback jumps back to the start of that line.',
      placement: 'left',
    }, 3200);
    await clear();
    await page.mouse.click(mouse.x, mouse.y);
    await glide(430, 330, 36);
    await callout({ step: 5, title: 'Move away and it plays on', text: 'No need to touch pause or play.', rect: null, at: { x: 40, y: 390 } }); // on the video, where the eye is
    await wait(4000);
    await clear();

    // The toolbar popup. Headless Chrome draws no browser toolbar, so the last
    // frame of the program is framed in a drawn one, with the real popup page in
    // an iframe where Chrome would open it
    await wait(400); // let the last callout fade out of the picture
    await hideCursor(true);
    const backdrop = (await page.screenshot({ type: 'jpeg', quality: 90 })).toString('base64');
    await recorder.pause();
    await page.goto(`chrome-extension://${extensionId}/dist/ui/popup.html`);
    await page.evaluate(([html]) => { document.documentElement.innerHTML = html; }, [browserMock(backdrop)]);
    await page.waitForFunction(() => document.querySelector('.popup')?.contentDocument?.querySelector('body *'), null, { timeout: 10000 });
    await page.waitForTimeout(600);
    await overlay();
    await page.mouse.move(mouse.x, mouse.y);
    await recorder.resume();
    await wait(300);
    await page.evaluate(() => document.body.classList.add('framed'));
    await wait(1000);

    const extIcon = page.locator('#ext');
    await glideTo(extIcon, 40);
    await step(extIcon, {
      step: 6,
      title: 'Settings from the toolbar icon',
      text: 'Click the extension\'s icon. Not there? Pin it from the puzzle-piece menu next to it.',
      // Left of the panel, so the arrow runs along the toolbar, clear of the panel's lines and buttons
      at: { x: 500, y: 96 },
    }, 3800);
    await clear();
    await page.mouse.click(mouse.x, mouse.y);
    await page.evaluate(openPopup);
    await wait(700);
    await step(page.locator('.popup'), {
      step: 6,
      title: 'Mode, language and model status',
      text: '"All settings" has the rest: where the translation goes, its size, and pause on hover.',
      placement: 'left',
    }, 5000);
    await shot('06-popup.png');
    await clear();
    await banner('Free on the Chrome Web Store', 'Translation runs on your computer. Nothing you watch leaves it.');
    await wait(3500);

    await recorder.stop();
    buildVideo(frames, OUT);
  } finally {
    await close();
    fs.rmSync(frames, { recursive: true, force: true });
  }
}

/** A plain dark Chrome window: one tab, the address bar, our pinned icon */
function browserMock(backdropJpeg) {
  const icon = (d, filled) =>
    `<svg viewBox="0 0 24 24" class="${filled ? 'filled' : ''}"><path d="${d}"/></svg>`;
  const BACK = 'M19 12H5M11 6l-6 6 6 6';
  const FORWARD = 'M5 12h14M13 6l6 6-6 6';
  const RELOAD = 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5';
  const PUZZLE = 'M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z';
  return `
  <head><style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: #000; font: 13px system-ui, "Segoe UI", Roboto, sans-serif; }
    .page { position: fixed; inset: 0; background: url(data:image/jpeg;base64,${backdropJpeg}) top center / cover; transition: top .7s cubic-bezier(.2, .7, .2, 1); }
    .chrome { position: fixed; left: 0; right: 0; top: 0; height: 76px; background: #202124; transform: translateY(-76px); transition: transform .7s cubic-bezier(.2, .7, .2, 1); }
    body.framed .chrome { transform: none; }
    body.framed .page { top: 76px; }
    .tabs { height: 36px; display: flex; align-items: flex-end; padding-left: 10px; }
    .tab { height: 30px; width: 250px; box-sizing: border-box; background: #35363a; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 8px; padding: 0 10px 0 12px; color: #e8eaed; font-size: 12px; }
    .fav { width: 16px; height: 16px; border-radius: 3px; background: #e8eaed; color: #111; font: 800 6px/16px sans-serif; text-align: center; }
    .tab .close { margin-left: auto; color: #9aa0a6; font-size: 14px; }
    .newtab { color: #9aa0a6; font-size: 18px; margin: 0 0 6px 10px; }
    .bar { height: 40px; background: #35363a; display: flex; align-items: center; gap: 4px; padding: 0 8px; }
    .btn { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #c4c7c5; flex: none; }
    .btn.dim { color: #6f7378; }
    .btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .btn svg.filled { fill: currentColor; stroke: none; }
    .btn img { width: 18px; height: 18px; border-radius: 3px; }
    #ext.pressed { background: #4a4d51; }
    .omni { flex: 1; height: 30px; margin: 0 8px; border-radius: 15px; background: #282a2d; display: flex; align-items: center; padding: 0 14px; font-size: 14px; color: #9aa0a6; }
    .omni b { color: #e8eaed; font-weight: 400; }
    .avatar { width: 24px; height: 24px; border-radius: 50%; background: #8ab4f8; color: #202124; font-weight: 700; display: grid; place-items: center; font-size: 12px; }
    .dots { display: grid; gap: 3px; } .dots i { width: 4px; height: 4px; border-radius: 50%; background: #c4c7c5; }
    .popup { position: fixed; top: 72px; left: -9999px; border: 0; border-radius: 8px; background: #141414; box-shadow: 0 8px 28px rgba(0, 0, 0, .6); opacity: 0; transform: translateY(-4px); transition: opacity .15s, transform .15s; }
    .popup.open { opacity: 1; transform: none; }
  </style></head>
  <body>
    <div class="page"></div>
    <div class="chrome">
      <div class="tabs"><div class="tab"><span class="fav">NRK</span>Side om side – NRK TV<span class="close">×</span></div><span class="newtab">+</span></div>
      <div class="bar">
        <span class="btn">${icon(BACK)}</span><span class="btn dim">${icon(FORWARD)}</span><span class="btn">${icon(RELOAD)}</span>
        <div class="omni"><b>tv.nrk.no</b>/serie/side-om-side/sesong/1/episode/1</div>
        <span class="btn" id="ext"><img src="../../icons/icon48.png" alt=""></span>
        <span class="btn">${icon(PUZZLE, true)}</span>
        <span class="btn"><span class="avatar">J</span></span>
        <span class="btn"><span class="dots"><i></i><i></i><i></i></span></span>
      </div>
    </div>
    <iframe class="popup" src="popup.html"></iframe>
  </body>`;
}

/** Runs in the page: open the popup under our icon, the way Chrome does */
function openPopup() {
  const ext = document.getElementById('ext');
  const frame = document.querySelector('.popup');
  const doc = frame.contentDocument.documentElement;
  frame.style.width = `${doc.scrollWidth}px`;
  frame.style.height = `${doc.scrollHeight}px`;
  const r = ext.getBoundingClientRect();
  frame.style.left = `${Math.round(r.right - doc.scrollWidth + 8)}px`;
  ext.classList.add('pressed');
  frame.classList.add('open');
}

/** CDP screencast: frames arrive only when something changes, each with a timestamp */
async function startScreencast(page, dir) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let paused = false;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (!paused) {
      const file = path.join(dir, `f${String(frames.length).padStart(6, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, t: metadata.timestamp });
    }
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const start = () =>
    cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 });
  await start();
  return {
    // Navigating away would otherwise record the blank page in between
    async pause() {
      paused = true;
    },
    async resume() {
      await start().catch(() => {});
      paused = false;
    },
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames));
    },
  };
}

function buildVideo(dir, out) {
  const frames = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  if (frames.length < 2) throw new Error('No frames recorded');
  // Gaps from the paused navigation would freeze the video; cap any single frame
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1];
    const duration = next ? Math.min(Math.max(next.t - frames[i].t, 0.001), 6) : 2;
    lines.push(`file '${frames[i].file}'`, `duration ${duration.toFixed(3)}`);
  }
  lines.push(`file '${frames.at(-1).file}'`);
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, lines.join('\n'));

  const mp4 = path.join(out, 'tutorial.mp4');
  const gif = path.join(out, 'tutorial.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-movflags', '+faststart', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4,
    '-vf', 'fps=6,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    gif]);
  for (const f of [mp4, gif]) console.log(`${path.relative(REPO, f)}  ${(fs.statSync(f).size / 1048576).toFixed(1)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
