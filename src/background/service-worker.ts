import { Logger } from '../utils/Logger.js';

/**
 * Background service worker
 * Handles extension lifecycle and background tasks
 */

Logger.info('Background service worker started');

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    Logger.info('Extension installed');

    // Set default settings
    chrome.storage.sync.set({
      enabled: true,
      targetLanguage: 'en',
      sourceLanguage: 'no',
      translationEngine: 'edge',
      showOriginal: true,
      fontSize: 16,
      position: 'below'
    });

    // Open options page on first install
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    Logger.info('Extension updated');
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.info('Message received:', message);

  switch (message.type) {
    case 'GET_STATUS':
      chrome.storage.sync.get(['enabled'], (result) => {
        sendResponse({ enabled: result.enabled ?? true });
      });
      return true; // Keep channel open for async response

    case 'TOGGLE_EXTENSION':
      chrome.storage.sync.get(['enabled'], (result) => {
        const newState = !result.enabled;
        chrome.storage.sync.set({ enabled: newState }, () => {
          sendResponse({ enabled: newState });
        });
      });
      return true;

    default:
      Logger.warn('Unknown message type:', message.type);
  }
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('tv.nrk.no')) {
    Logger.info('NRK TV page loaded, content script should be active');
  }
});
