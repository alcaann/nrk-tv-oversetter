import { SubtitleProcessor } from './SubtitleProcessor.js';
import { Logger } from '../utils/Logger.js';
import { getSupportedLanguages } from '../core/languages.js';
import { StorageService } from '../utils/StorageService.js';

/**
 * Content script entry point
 * This script runs on NRK TV pages and injects subtitle translations
 */

Logger.info('NRK TV Oversetter content script loaded');

let processor: SubtitleProcessor | null = null;
let initGeneration = 0;

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeProcessor);
} else {
  initializeProcessor();
}

async function initializeProcessor() {
  Logger.info('Initializing subtitle processor');

  // Settings changes can arrive faster than a processor takes to start up. Without
  // a generation token, each overlapping call overwrites `processor`, orphaning the
  // previous instance with its observer and polling timer still running.
  const generation = ++initGeneration;

  if (processor) {
    processor.dispose();
    processor = null;
  }

  const candidate = new SubtitleProcessor();
  await candidate.initialize();

  if (generation !== initGeneration) {
    // A newer initialisation overtook us - stand down
    candidate.dispose();
    return;
  }

  processor = candidate;
  warmLanguageCache();
}

/**
 * Populate the supported-language cache from here.
 *
 * The popup and options page usually manage this themselves, but the Translator API
 * is only guaranteed to be reachable from a page context like this one. Probing here
 * means the language list is correct even if those pages cannot probe directly.
 * Cheap after the first run - getSupportedLanguages() returns early from cache.
 */
function warmLanguageCache(): void {
  const storage = new StorageService();
  storage
    .getAll()
    .then((settings) => getSupportedLanguages(settings.sourceLanguage))
    .then((languages) => {
      Logger.info(`Language cache ready: ${languages.length} target languages available`);
    })
    .catch((error) => {
      Logger.warn('Could not build language cache:', error);
    });
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    Logger.info('Settings changed, reinitializing processor');

    // initializeProcessor() disposes the previous instance itself, so that
    // overlapping changes cannot leave an orphan running
    initializeProcessor();
  }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (processor) {
    processor.dispose();
  }
});
