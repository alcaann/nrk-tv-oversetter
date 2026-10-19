/**
 * Run the extension through the situations that tend to break subtitle detection,
 * sampling ground truth throughout and printing a report per scenario.
 *
 * Usage: node tools/harness/scenarios.cjs [scenario ...]
 *   With no arguments every scenario runs. VERBOSE=1 echoes extension console output.
 */
const { launch, captureConsole } = require('./launch.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startSampling, report } = require('./sampler.cjs');

const EPISODE = 'https://tv.nrk.no/serie/humoretaten/sesong/4/episode/IUFH21002726?autoplay=true';
const SUBS_MENU = 'button[aria-label="Valg for undertekster og tilgjengelighet"]';

/**
 * A trusted click grants the user activation Chrome needs to download the model.
 * It has to land somewhere inert: page corners hold NRK links on some pages. The
 * panel footer is ours and does nothing; moving away again resumes playback the
 * panel paused on hover.
 */
async function grantActivation(page) {
  const footer = page.locator('#nrk-oversetter-panel footer');
  await footer.waitFor({ timeout: 15000 });
  await footer.click();
  await page.mouse.move(300, 300);
}

async function openEpisode(page, url = EPISODE) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 30000 });
  await grantActivation(page);
}

async function chooseSubtitles(page, label) {
  await page.mouse.move(700, 400);
  await page.click(SUBS_MENU);
  await page.getByText(label, { exact: true }).first().click();
  await page.keyboard.press('Escape');
}

async function sampleFor(page, seconds, during) {
  const sampler = startSampling(page);
  if (during) await during();
  else await page.waitForTimeout(seconds * 1000);
  return sampler.stop();
}

const scenarios = {
  /** Land on the front page, then reach an episode through client-side routing. */
  async 'spa-navigation'(page) {
    await page.goto('https://tv.nrk.no/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const href = await page.$eval('a[href*="/episode/"]', (a) => a.getAttribute('href'));
    console.log('  clicking through to', href);
    await page.click(`a[href="${href}"]`);
    await page.waitForSelector('video', { timeout: 30000 });
    await grantActivation(page);
    return sampleFor(page, 40);
  },

  /** Play one episode, then move to another without a page load. */
  async 'episode-switch'(page) {
    await openEpisode(page);
    await page.waitForTimeout(15000);
    const href = await page.$$eval('a[href*="/episode/"]', (as) =>
      as.map((a) => a.getAttribute('href')).find((h) => !h.includes('IUFH21002726'))
    );
    console.log('  switching to', href);
    await page.click(`a[href="${href}"]`);
    await page.waitForTimeout(2000);
    return sampleFor(page, 40);
  },

  /** Turn NRK's subtitles off and back on mid-episode. */
  async 'subtitle-toggle'(page) {
    await openEpisode(page);
    await page.waitForTimeout(10000);
    return sampleFor(page, 0, async () => {
      await chooseSubtitles(page, 'Av');
      await page.waitForTimeout(12000);
      await chooseSubtitles(page, 'Norsk');
      await page.waitForTimeout(20000);
    });
  },

  /** Jump backwards and forwards. */
  async seek(page) {
    await openEpisode(page);
    await page.waitForTimeout(20000);
    return sampleFor(page, 0, async () => {
      await page.evaluate(() => (document.querySelector('video').currentTime = 5));
      await page.waitForTimeout(12000);
      await page.evaluate(() => (document.querySelector('video').currentTime = 120));
      await page.waitForTimeout(15000);
    });
  },

  /** Pause in the middle of a line, then resume. */
  async pause(page) {
    await openEpisode(page);
    await page.waitForTimeout(13000);
    return sampleFor(page, 0, async () => {
      await page.evaluate(() => document.querySelector('video').pause());
      await page.waitForTimeout(5000);
      await page.evaluate(() => document.querySelector('video').play());
      await page.waitForTimeout(10000);
    });
  },

  /** A live channel rather than on-demand */
  async live(page) {
    await page.goto('https://tv.nrk.no/direkte/nrk1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video', { timeout: 30000 });
    await grantActivation(page);
    await page.waitForTimeout(8000);
    return sampleFor(page, 45);
  },

  /** NRK's fullscreen button: the panel has to move into the fullscreen element */
  async fullscreen(page) {
    await openEpisode(page);
    await page.waitForTimeout(8000);
    await page.mouse.move(500, 300);
    await page.click('button[aria-label="Fullskjerm"]');
    await page.waitForTimeout(1500);
    const where = await page.evaluate(() => ({
      fullscreen: document.fullscreenElement?.tagName ?? null,
      panelInside: !!document.fullscreenElement?.querySelector('#nrk-oversetter-panel'),
    }));
    console.log('  fullscreen state:', JSON.stringify(where));
    const samples = await sampleFor(page, 20);
    await page.screenshot({ path: path.join(os.tmpdir(), 'nrk-harness-fullscreen.png') });
    return samples;
  },

  /**
   * First run: a profile with no model downloaded. Nothing translates until the
   * viewer interacts; after one click it should download and catch up.
   */
  async 'fresh-profile'(page) {
    await page.goto(EPISODE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video', { timeout: 30000 });
    await page.waitForTimeout(12000);
    const before = await page.evaluate(() => document.getElementById('nrk-oversetter-panel')?.shadowRoot.querySelector('footer')?.textContent);
    console.log('  before any click:', before);
    return sampleFor(page, 0, async () => {
      await grantActivation(page);
      await page.waitForTimeout(30000);
    });
  },
};

/** Scenarios that need a browser profile of their own */
const ISOLATED = new Set(['fresh-profile']);

(async () => {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(scenarios);
  const shared = names.some((n) => !ISOLATED.has(n)) ? await launch() : null;
  try {
    for (const name of names) {
      let isolated = null;
      if (ISOLATED.has(name)) {
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nrk-harness-'));
        isolated = await launch({ profile });
        isolated.profile = profile;
      }
      const { context } = isolated || shared;
      const page = await context.newPage();
      const logs = captureConsole(page);
      try {
        const samples = await scenarios[name](page);
        report(samples, name);
      } catch (error) {
        console.log(`\n===== ${name} ===== FAILED: ${error.message.split('\n')[0]}`);
      }
      if (process.env.LOGS) for (const l of logs) console.log('  ' + l);
      await page.close();
      if (isolated) {
        await isolated.close();
        // Chrome can still be flushing the profile as it exits
        fs.rmSync(isolated.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      }
    }
  } finally {
    await shared?.close();
  }
})();
