import { SubtitleProcessor } from './SubtitleProcessor.js';
import { Logger } from '../utils/Logger.js';

/**
 * Content script entry point
 * This script runs on NRK TV pages and injects subtitle translations
 */

Logger.info('NRK TV Oversetter content script loaded');

let processor: SubtitleProcessor | null = null;

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeProcessor);
} else {
  initializeProcessor();
}

async function initializeProcessor() {
  Logger.info('Initializing subtitle processor');

  processor = new SubtitleProcessor();
  await processor.initialize();
}

// Handle model availability check
async function handleCheckAvailability(message: any): Promise<any> {
  // @ts-ignore
  if (typeof Translator === 'undefined') {
    return { availability: 'unavailable', error: 'Translator API not available' };
  }

  // @ts-ignore
  const availability = await Translator.availability({
    sourceLanguage: message.sourceLang,
    targetLanguage: message.targetLang
  });

  return { availability };
}

// Handle model download
async function handleDownloadModel(message: any): Promise<any> {
  // @ts-ignore
  if (typeof Translator === 'undefined') {
    return { success: false, error: 'Translator API not available' };
  }

  try {
    Logger.info('Starting model download...');

    // Create session WITHOUT monitor - simpler approach
    // @ts-ignore
    const session = await Translator.create({
      sourceLanguage: message.sourceLang,
      targetLanguage: message.targetLang
    });

    Logger.info('Translator session created successfully');

    // Perform a test translation to verify model works
    const testResult = await session.translate('test');
    Logger.info(`Test translation successful: "${testResult}"`);

    // Clean up
    await session.destroy();
    Logger.info('Model verified and ready');

    return { success: true };
  } catch (error) {
    Logger.error('Model download/verification failed:', error);
    return { success: false, error: String(error) };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_MODEL_AVAILABILITY') {
    handleCheckAvailability(message)
      .then(sendResponse)
      .catch(error => {
        Logger.error('Availability check error:', error);
        sendResponse({ availability: 'unavailable', error: String(error) });
      });
    return true; // Will respond asynchronously
  } else if (message.type === 'DOWNLOAD_MODEL') {
    handleDownloadModel(message)
      .then(sendResponse)
      .catch(error => {
        Logger.error('Download error:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true; // Will respond asynchronously
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    Logger.info('Settings changed, reinitializing processor');

    // Dispose old processor
    if (processor) {
      processor.dispose();
    }

    // Reinitialize with new settings
    initializeProcessor();
  }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (processor) {
    processor.dispose();
  }
});
