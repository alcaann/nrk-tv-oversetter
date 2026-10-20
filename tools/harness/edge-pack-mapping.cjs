/**
 * Which language pack does Edge download for a requested pair, and does that
 * pack work?
 *
 * Edge on Linux has been seen fetching English-Afrikaans when asked for German- or
 * Norwegian-English, then failing create() with NotSupportedError. For each pair,
 * in a fresh throwaway profile (so earlier downloads cannot steer the next one):
 *   1. create() for the requested pair, noting which pack directory appears
 *   2. create() + translate() for the pair that pack actually contains
 * The profile is deleted afterwards, so only one pack (~200 MB) is on disk at once.
 *
 * Usage: BROWSER=microsoft-edge-dev node tools/harness/edge-pack-mapping.cjs de:en,af:en
 *   KEEP_PROFILE=1 keeps the profile for inspection (prints its path)
 */
const { launch } = require('./launch.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PACK_DIR = 'EdgeTranslateKitLanguagePack';
const CREATE_TIMEOUT_MS = Number(process.env.CREATE_TIMEOUT_MS || 240000);
const SAMPLES = {
  en: 'Good morning, how are you?',
  de: 'Guten Morgen, wie geht es dir?',
  no: 'God morgen, hvordan har du det?',
  af: 'Goeie môre, hoe gaan dit met jou?',
  zh: '早上好，你好吗？',
  ca: 'Bon dia, com estàs?',
};

function packs(profile) {
  try {
    return fs.readdirSync(path.join(profile, PACK_DIR));
  } catch {
    return [];
  }
}

/** create() + translate() after a real click; returns a one-line outcome */
async function tryCreate(page, source, target) {
  await page.click('#probe-click');
  const started = Date.now();
  const outcome = await page.evaluate(
    async ([s, t, text, timeout]) => {
      let progress = -1;
      try {
        const translator = await Promise.race([
          Translator.create({
            sourceLanguage: s,
            targetLanguage: t,
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => (progress = Math.round(e.loaded * 100)));
            },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`no result after ${timeout / 1000}s`)), timeout)),
        ]);
        return `OK "${await translator.translate(text)}"`;
      } catch (e) {
        return `FAIL ${e.name}: ${e.message}` + (progress >= 0 ? ` (download reached ${progress}%)` : '');
      }
    },
    [source, target, SAMPLES[source] || SAMPLES.en, CREATE_TIMEOUT_MS]
  );
  return `${outcome} [${Math.round((Date.now() - started) / 1000)}s]`;
}

(async () => {
  const pairs = (process.argv[2] || 'de:en').split(',').map((p) => p.split(':'));

  for (const [source, target] of pairs) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-packs-'));
    const harness = await launch({ profile });
    try {
      const page = await harness.context.newPage();
      await page.goto('https://tv.nrk.no/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        const el = document.createElement('div');
        el.id = 'probe-click';
        el.style.cssText = 'position:fixed;left:0;bottom:0;width:40px;height:40px;z-index:2147483647';
        document.body.appendChild(el);
      });

      const availability = await page.evaluate(
        ([s, t]) => Translator.availability({ sourceLanguage: s, targetLanguage: t }),
        [source, target]
      );
      const result = await tryCreate(page, source, target);
      const downloaded = packs(profile);
      console.log(`${source}->${target}  availability=${availability}  downloaded=[${downloaded.join(', ')}]`);
      console.log(`    requested pair: ${result}`);

      // Does the pack Edge actually fetched work for its own languages?
      for (const pack of downloaded) {
        const [a, b] = pack.split('-');
        const other = a === 'en' ? b : a;
        if (`${source}-${target}` === `${other}-en` || `${source}-${target}` === `en-${other}`) continue;
        console.log(`    ${other}->en (what was downloaded): ${await tryCreate(page, other, 'en')}`);
      }
    } catch (error) {
      console.log(`${source}->${target}  ERROR ${error.message.split('\n')[0]}`);
    } finally {
      await harness.close();
      if (process.env.KEEP_PROFILE) {
        console.log(`    profile kept at ${profile}`);
      } else {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      }
    }
  }
})();
