import { StorageService } from '../utils/StorageService.js';
import { ExtensionSettings } from '../core/interfaces/IStorageService.js';

/**
 * Popup UI controller
 */

const storage = new StorageService();

// DOM elements
const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement;
const targetLanguage = document.getElementById('target-language') as HTMLSelectElement;
const translationEngine = document.getElementById('translation-engine') as HTMLSelectElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const openSettings = document.getElementById('open-settings') as HTMLButtonElement;
const modelStatusContainer = document.getElementById('model-status') as HTMLDivElement;
const modelStatusText = document.getElementById('model-status-text') as HTMLSpanElement;
const downloadModelButton = document.getElementById('download-model') as HTMLButtonElement;
const modelInfo = document.getElementById('model-info') as HTMLDivElement;

// Load current settings
async function loadSettings() {
  const settings = await storage.getAll();
  updateUI(settings);
  checkModelAvailability(settings);
}

function updateUI(settings: ExtensionSettings) {
  toggleEnabled.checked = settings.enabled;
  targetLanguage.value = settings.targetLanguage;
  translationEngine.value = settings.translationEngine;

  // Update status
  if (settings.enabled) {
    statusElement.className = 'status enabled';
    statusText.textContent = `Active - Translating to ${getLanguageName(settings.targetLanguage)}`;
  } else {
    statusElement.className = 'status disabled';
    statusText.textContent = 'Translation Disabled';
  }
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'zh': 'Chinese'
  };
  return languages[code] || code;
}

// Event listeners
toggleEnabled.addEventListener('change', async () => {
  await storage.set('enabled', toggleEnabled.checked);
  const settings = await storage.getAll();
  updateUI(settings);
});

targetLanguage.addEventListener('change', async () => {
  await storage.set('targetLanguage', targetLanguage.value);
  const settings = await storage.getAll();
  updateUI(settings);
});

translationEngine.addEventListener('change', async () => {
  await storage.set('translationEngine', translationEngine.value);
});

openSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

downloadModelButton.addEventListener('click', async () => {
  downloadModelButton.disabled = true;
  downloadModelButton.textContent = 'Downloading...';
  modelStatusText.textContent = 'Initiating download...';

  // Query for NRK TV tabs
  const tabs = await chrome.tabs.query({ url: '*://tv.nrk.no/*' });

  if (tabs.length === 0) {
    modelStatusText.textContent = 'Please open tv.nrk.no first';
    downloadModelButton.disabled = false;
    downloadModelButton.textContent = 'Download Translation Model';
    return;
  }

  // Send message to content script to download model
  try {
    const settings = await storage.getAll();
    const response = await chrome.tabs.sendMessage(tabs[0].id!, {
      type: 'DOWNLOAD_MODEL',
      sourceLang: settings.sourceLanguage,
      targetLang: settings.targetLanguage
    });

    // Check if download was successful
    if (response && response.success) {
      modelStatusText.textContent = '✓ Model downloaded successfully!';
      modelInfo.textContent = 'Translation model is ready to use.';

      // Re-check availability to update UI
      setTimeout(() => {
        checkModelAvailability(settings);
      }, 1000);
    } else {
      const errorMsg = response?.error || 'Unknown error';
      modelStatusText.textContent = `Download failed: ${errorMsg}`;
      modelInfo.textContent = 'Please try again or check the console for errors.';
      downloadModelButton.disabled = false;
      downloadModelButton.textContent = 'Retry Download';
    }
  } catch (error) {
    console.error('Failed to trigger download:', error);
    modelStatusText.textContent = 'Download failed. Try again.';
    modelInfo.textContent = String(error);
    downloadModelButton.disabled = false;
    downloadModelButton.textContent = 'Retry Download';
  }
});

// Check model availability
async function checkModelAvailability(settings: ExtensionSettings) {
  if (settings.translationEngine !== 'edge') {
    modelStatusContainer.style.display = 'none';
    return;
  }

  // Query for NRK TV tabs to check model status
  const tabs = await chrome.tabs.query({ url: '*://tv.nrk.no/*' });

  if (tabs.length === 0) {
    modelStatusContainer.style.display = 'block';
    modelStatusText.textContent = 'Open tv.nrk.no to check model status';
    downloadModelButton.style.display = 'none';
    modelInfo.style.display = 'none';
    return;
  }

  try {
    // Send message to content script to check availability
    const response = await chrome.tabs.sendMessage(tabs[0].id!, {
      type: 'CHECK_MODEL_AVAILABILITY',
      sourceLang: settings.sourceLanguage,
      targetLang: settings.targetLanguage
    });

    if (response && response.availability) {
      const availability = response.availability;

      if (availability === 'available') {
        modelStatusContainer.style.display = 'block';
        modelStatusText.textContent = '✓ Translation model ready';
        downloadModelButton.style.display = 'none';
        modelInfo.style.display = 'none';
      } else if (availability === 'downloadable' || availability === 'downloading') {
        modelStatusContainer.style.display = 'block';
        modelStatusText.textContent = availability === 'downloading' ? 'Model is downloading...' : 'Translation model not downloaded';
        downloadModelButton.style.display = 'block';
        downloadModelButton.disabled = availability === 'downloading';
        modelInfo.style.display = 'block';
      } else if (availability === 'unavailable') {
        modelStatusContainer.style.display = 'block';
        modelStatusText.textContent = '⚠ Translation not supported for this language pair';
        downloadModelButton.style.display = 'none';
        modelInfo.textContent = `${settings.sourceLanguage} → ${settings.targetLanguage} translation is not available in Edge.`;
        modelInfo.style.display = 'block';
      }
    } else {
      modelStatusContainer.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to check model availability:', error);
    modelStatusContainer.style.display = 'none';
  }
}

// Initialize
loadSettings();
