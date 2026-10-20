/**
 * Launch real Google Chrome with the unpacked extension loaded, and hand back a
 * Playwright handle to it.
 *
 * Branded Chrome (137+) ignores --load-extension, and Playwright's bundled
 * Chromium cannot play NRK's H.264/H.265 streams. So we start Chrome ourselves:
 *   - --remote-debugging-pipe, to call Extensions.loadUnpacked (pipe-only method)
 *   - --remote-debugging-port, so Playwright can connectOverCDP to the same browser
 *
 * The profile lives in .harness/profile so a downloaded translation model survives
 * between runs.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = path.resolve(__dirname, '..', '..');

async function launch({
  // BROWSER=microsoft-edge runs the same harness against Edge
  binary = process.env.BROWSER || 'google-chrome',
  headless = process.env.HEADED ? false : true,
  port = 9300 + Math.floor(Math.random() * 600),
  profile = path.join(REPO, '.harness', 'profile'),
  width = 1400,
  height = 850,
} = {}) {
  fs.mkdirSync(profile, { recursive: true });
  // A crashed previous run leaves a lock that makes Chrome exit immediately
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { fs.unlinkSync(path.join(profile, lock)); } catch {}
  }

  const args = [
    '--remote-debugging-pipe',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--enable-unsafe-extension-debugging',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');
  // e.g. EXTRA_ARGS="--enable-features=Foo" to try browser switches
  if (process.env.EXTRA_ARGS) args.unshift(...process.env.EXTRA_ARGS.split(' ').filter(Boolean));

  const proc = spawn(binary, args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const toChrome = proc.stdio[3];
  const fromChrome = proc.stdio[4];
  fromChrome.on('error', () => {});
  toChrome.on('error', () => {});

  let buffer = '';
  const pending = new Map();
  fromChrome.on('data', (chunk) => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }
  });
  let nextId = 1;
  const pipeSend = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      toChrome.write(JSON.stringify({ id, method, params }) + '\0');
    });

  const { id: extensionId } = await pipeSend('Extensions.loadUnpacked', { path: REPO });

  let browser;
  for (let i = 0; i < 100 && !browser; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  if (!browser) {
    proc.kill();
    throw new Error('Could not connect to Chrome');
  }

  const context = browser.contexts()[0];

  const close = async () => {
    try { await browser.close(); } catch {}
    proc.kill();
  };

  /** Write extension settings through an extension page, which has chrome.storage */
  const setSettings = async (settings) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/dist/ui/options.html`);
    await page.evaluate((s) => chrome.storage.sync.set(s), settings);
    await page.close();
  };

  return { browser, context, extensionId, close, pipeSend, setSettings };
}

/** Collect extension console output from a page, optionally echoing it live. */
function captureConsole(page, { echo = !!process.env.VERBOSE, filter = /NRK-Oversetter|Translator|nrk-sub/ } = {}) {
  const lines = [];
  page.on('console', (m) => {
    const text = m.text();
    if (!filter.test(text)) return;
    const line = `${new Date().toISOString().slice(11, 23)} ${m.type()} ${text.split('\n')[0]}`;
    lines.push(line);
    if (echo) console.log('  [console]', line);
  });
  return lines;
}

module.exports = { launch, captureConsole, REPO };
