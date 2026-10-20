const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Zip what the store needs - manifest, icons and the built dist/ - into
 * release/nrk-tv-oversetter-<version>.zip. Run through `npm run package`, which
 * cleans and rebuilds first so no stale build output gets shipped.
 */

const root = path.join(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (pkg.version !== version) {
  console.error(`Version mismatch: manifest.json ${version}, package.json ${pkg.version}`);
  process.exit(1);
}

const outDir = path.join(root, 'release');
const out = path.join(outDir, `nrk-tv-oversetter-${version}.zip`);
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(out, { force: true });

execFileSync('zip', ['-r', '-q', '-X', out, 'manifest.json', 'icons', 'dist', '-x', '*.d.ts', '*.map', '*.DS_Store'], {
  cwd: root,
  stdio: 'inherit',
});

const listing = execFileSync('unzip', ['-Z1', out], { encoding: 'utf8' }).trim().split('\n');
console.log(`Packaged ${listing.length} files into ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
