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
  'core/interfaces/ISubtitleProcessor.js',
  'core/interfaces/ITranslationEngine.js',
  'core/translation/TranslatorEngine.js',
  'core/translation/TranslationEngineFactory.js',
  'utils/StorageService.js',
  'content/SubtitleProcessor.js',
  'content/subtitle-injector.js'
];

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

  bundledCode += `  // ========== ${file} ==========\n`;
  bundledCode += content + '\n\n';
});

bundledCode += `})();\n`;

// Write the bundled file
const outputPath = path.join(distPath, 'content', 'subtitle-injector.bundle.js');
fs.writeFileSync(outputPath, bundledCode);

console.log(`Bundled content script created: ${outputPath}`);
console.log(`Size: ${(bundledCode.length / 1024).toFixed(2)} KB`);
