// Scratch helper: open a URL with the extension loaded and run an inline async
// snippet against the page. Usage: node explore.cjs <url> <file-with-async-body>
const { launch, captureConsole } = require('./launch.cjs');
const fs = require('fs');
(async () => {
  const { context, close } = await launch();
  const page = await context.newPage();
  const logs = captureConsole(page);
  if (process.argv[2]) await page.goto(process.argv[2], { waitUntil: 'domcontentloaded' });
  const body = fs.readFileSync(process.argv[3], 'utf8');
  try { await new Function('page', 'logs', 'context', `return (async () => { ${body} })()`)(page, logs, context); }
  catch (e) { console.error('ERR', e); }
  await close();
})();
