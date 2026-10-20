/**
 * Probe the browser's built-in Translator API directly, without the extension's
 * code in the way: availability, then create() and translate() for each pair.
 * Each create() follows a real click, for the user activation a download needs.
 *
 * Usage: node tools/harness/translator-probe.cjs [pairs] [profile-dir]
 *   pairs: comma-separated source:target, default "no:en,de:en,en:es"
 *   BROWSER=microsoft-edge-dev to probe another browser
 */
const { launch } = require('./launch.cjs');

const SAMPLES = { en: 'Good morning, how are you?', de: 'Guten Morgen, wie geht es dir?', no: 'God morgen, hvordan har du det?' };
const CREATE_TIMEOUT_MS = 180000;

(async () => {
  const pairs = (process.argv[2] || 'no:en,de:en,en:es').split(',').map((p) => p.split(':'));
  const { context, close } = await launch(process.argv[3] ? { profile: process.argv[3] } : {});
  const page = await context.newPage();
  await page.goto('https://tv.nrk.no/', { waitUntil: 'domcontentloaded' });
  console.log(await page.evaluate(() => navigator.userAgent));

  // An inert element to click: real links would navigate away mid-probe
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.id = 'probe-click';
    target.style.cssText = 'position:fixed;left:0;bottom:0;width:40px;height:40px;z-index:2147483647';
    document.body.appendChild(target);
  });

  for (const [source, target] of pairs) {
    const availability = await page.evaluate(
      ([s, t]) => Translator.availability({ sourceLanguage: s, targetLanguage: t }),
      [source, target]
    );
    await page.click('#probe-click');
    const started = Date.now();
    const result = await page.evaluate(
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
          return `OK "${await translator.translate(text)}" (last progress ${progress}%)`;
        } catch (e) {
          return `FAIL ${e.name}: ${e.message} (last progress ${progress}%)`;
        }
      },
      [source, target, SAMPLES[source] || SAMPLES.en, CREATE_TIMEOUT_MS]
    );
    console.log(`${source}->${target}: availability=${availability}; ${result} after ${Math.round((Date.now() - started) / 1000)}s`);
  }
  await close();
})();
