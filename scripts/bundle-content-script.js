const fs = require('fs');
const path = require('path');

/**
 * Simple bundler for content script
 * Reads all the module files and combines them into a single IIFE
 */

const distPath = path.join(__dirname, '..', 'dist');

// Read all the necessary files in dependency order
const files = [
  'utils/Logger.js',
  'core/interfaces/IStorageService.js',
  'core/interfaces/ITranslationEngine.js',
  "core/modelStatus.js",
  "core/languages.js",
  'core/modes.js',
  'core/translation/TranslatorEngine.js',
  'core/translation/TranslationEngineFactory.js',
  'utils/StorageService.js',
  'content/captions/types.js',
  'content/captions/TextTrackSource.js',
  'content/captions/DomSource.js',
  'content/captions/CaptionTracker.js',
  'content/translation/TranslationStatus.js',
  'content/translation/TranslationQueue.js',
  'content/ui/OverlayRenderer.js',
  'content/ui/HistoryPanel.js',
  'content/ui/NrkMenuIntegration.js',
  'content/subtitle-injector.js'
];

// Every file shares one scope in the bundle, so a top-level name declared in two
// files is a SyntaxError at runtime that kills the whole content script. Catch it
// here instead.
const declaredIn = new Map();
const duplicates = [];

let bundledCode = `// Bundled content script for NRK TV Oversetter\n`;
bundledCode += `// Generated automatically - do not edit\n\n`;
bundledCode += `(function() {\n`;
bundledCode += `  'use strict';\n\n`;

// Process each file
files.forEach(file => {
  const filePath = path.join(distPath, file);

  if (!fs.existsSync(filePath)) {
    console.error(`Warning: File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Remove import/export statements
  content = content.replace(/^import\s+.*?;?\s*$/gm, '');
  content = content.replace(/^export\s+/gm, '');
  content = content.replace(/^export\s*{[^}]+}\s*;?\s*$/gm, '');

  for (const match of content.matchAll(/^(?:const|let|var|class|function\*?|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
    const name = match[1];
    if (declaredIn.has(name)) {
      duplicates.push(`${name} (${declaredIn.get(name)} and ${file})`);
    } else {
      declaredIn.set(name, file);
    }
  }

  bundledCode += `  // ========== ${file} ==========\n`;
  bundledCode += content + '\n\n';
});

bundledCode += `})();\n`;

if (duplicates.length) {
  console.error('Top-level names declared in more than one bundled file:');
  duplicates.forEach((d) => console.error(`  ${d}`));
  process.exit(1);
}

// Write the bundled file
const outputPath = path.join(distPath, 'content', 'subtitle-injector.bundle.js');
fs.writeFileSync(outputPath, bundledCode);

console.log(`Bundled content script created: ${outputPath}`);
console.log(`Size: ${(bundledCode.length / 1024).toFixed(2)} KB`);
