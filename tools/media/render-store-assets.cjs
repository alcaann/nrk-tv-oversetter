/**
 * Render the Chrome Web Store promo images from the tutorial's clean frames:
 *   store/assets/promo-small-440x280.png   (required "small promo tile")
 *   store/assets/promo-marquee-1400x560.png (optional "marquee promo tile")
 *
 * Usage: node tools/media/render-store-assets.cjs   (after record-tutorial.cjs)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const TUTORIAL = path.join(REPO, 'docs', 'tutorial');
const OUT = path.join(REPO, 'store', 'assets');

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(path.join(TUTORIAL, file)).toString('base64')}`;
const icon = `data:image/png;base64,${fs.readFileSync(path.join(REPO, 'icons', 'icon128.png')).toString('base64')}`;

const BASE = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff; background: #141414; overflow: hidden; }
  .accent { color: #ffd700; }
`;

// Too small for a legible screenshot crop: draw the idea instead, styled like the
// extension's real on-video subtitles
const small = `
  <style>${BASE}
    body { width: 440px; height: 280px; padding: 22px 24px; background: radial-gradient(circle at 85% 0%, #4a1a20, #121212 65%); }
    .head { display: flex; gap: 12px; align-items: center; }
    .head img { width: 46px; height: 46px; border-radius: 9px; }
    h1 { font-size: 25px; line-height: 1.1; letter-spacing: -.01em; }
    p { font-size: 13px; color: #c8c8c8; margin-top: 3px; }
    .subs { margin-top: 30px; display: grid; justify-items: center; gap: 6px; }
    .no { font-size: 23px; background: rgba(0,0,0,.75); padding: 2px 10px; }
    .en { font-size: 18px; font-weight: 700; color: #ffd700; background: rgba(0,0,0,.6); padding: 3px 10px; border-radius: 4px; }
  </style>
  <div class="head"><img src="${icon}"><div><h1>NRK TV <span class="accent">Oversetter</span></h1><p>Norwegian subtitles, translated on your device</p></div></div>
  <div class="subs"><div class="no">Hvordan har uka vært?</div><div class="en">How has the week been?</div></div>`;

const marquee = `
  <style>${BASE}
    body { width: 1400px; height: 560px; display: grid; grid-template-columns: 580px 1fr; background: radial-gradient(circle at 20% 30%, #3a1418, #0d0d0d 70%); }
    .copy { padding: 70px 0 0 64px; }
    .copy img { width: 72px; height: 72px; border-radius: 14px; }
    h1 { font-size: 36px; line-height: 1.1; margin-top: 22px; letter-spacing: -.02em; }
    p { font-size: 20px; color: #ccc; margin-top: 16px; line-height: 1.4; }
    ul { list-style: none; padding: 0; margin-top: 22px; color: #eee; font-size: 17px; line-height: 1.9; }
    li::before { content: "●"; color: #ffd700; margin-right: 10px; font-size: 12px; vertical-align: 2px; }
    .shot { margin: 48px 0 0 0; border-radius: 14px 0 0 14px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.6); border: 1px solid #333; border-right: 0;
            background: url(${dataUrl('clean-panel.png')}) no-repeat; background-size: 1140px auto; background-position: -300px 0; height: 464px; }
  </style>
  <div class="copy">
    <img src="${icon}">
    <h1>Watch NRK in Norwegian.<br><span class="accent">Peek at the translation.</span></h1>
    <p>Dual subtitles on the video, or a learning panel with every line so far.</p>
    <ul><li>Hover a line to reveal it, the video pauses</li><li>Runs on your device, works offline</li><li>40+ languages, from your browser</li></ul>
  </div>
  <div class="shot"></div>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [name, html, width, height] of [
    ['promo-small-440x280.png', small, 440, 280],
    ['promo-marquee-1400x560.png', marquee, 1400, 560],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(`<!doctype html><meta charset="utf-8">${html}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log(path.relative(REPO, path.join(OUT, name)));
  }
  await browser.close();
})();
