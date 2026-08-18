import { StorageService } from '../utils/StorageService.js';
import { ExtensionSettings } from '../core/interfaces/IStorageService.js';
import { getLanguageName, getSupportedLanguages, populateLanguageSelect } from '../core/languages.js';
import {
  MODEL_STATUS_MESSAGE,
  ModelState,
  getModelStatus,
  pairKey
} from '../core/modelStatus.js';

/**
 * Popup UI controller
 */

const storage = new StorageService();

/** The pair the panel is currently showing, so we ignore updates for others */
let currentPair = '';

// DOM elements
const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement;
const targetLanguage = document.getElementById('target-language') as HTMLSelectElement;
const translationEngine = document.getElementById('translation-engine') as HTMLSelectElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const openSettings = document.getElementById('open-settings') as HTMLButtonElement;
const modelStatusContainer = document.getElementById('model-status') as HTMLDivElement;
const modelStatusDot = document.getElementById('model-status-dot') as HTMLSpanElement;
const modelStatusText = document.getElementById('model-status-text') as HTMLSpanElement;
const modelInfo = document.getElementById('model-info') as HTMLDivElement;
const progressTrack = document.getElementById('progress-track') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;

// Load current settings
async function loadSettings() {
  const settings = await storage.getAll();

  // Populated from what the browser actually supports, not a hardcoded list
  const languages = await getSupportedLanguages(settings.sourceLanguage);
  populateLanguageSelect(targetLanguage, languages, settings.targetLanguage);

  // The stored language may no longer be offered; keep storage in step with the UI
  if (targetLanguage.value && targetLanguage.value !== settings.targetLanguage) {
    settings.targetLanguage = targetLanguage.value;
    await storage.set('targetLanguage', targetLanguage.value);
  }

  updateUI(settings);
  renderModelStatus(settings);
}

function updateUI(settings: ExtensionSettings) {
  toggleEnabled.checked = settings.enabled;
  targetLanguage.value = settings.targetLanguage;
  translationEngine.value = settings.translationEngine;

  if (settings.enabled) {
    statusElement.className = 'status enabled';
    statusText.textContent = `Active - Translating to ${getLanguageName(settings.targetLanguage)}`;
  } else {
    statusElement.className = 'status disabled';
    statusText.textContent = 'Translation Disabled';
  }
}

/**
 * Show what we know about the current language pair.
 *
 * There is no download button any more: selecting a language is the trigger, and
 * the model downloads by itself the first time a subtitle needs translating. All
 * this does is explain what is happening while that occurs.
 */
async function renderModelStatus(settings: ExtensionSettings) {
  if (settings.translationEngine !== 'edge') {
    modelStatusContainer.style.display = 'none';
    return;
  }

  modelStatusContainer.style.display = 'block';
  currentPair = pairKey(settings.sourceLanguage, settings.targetLanguage);

  const entry = await getModelStatus(currentPair);
  applyModelStatus(entry ? entry.state : null, entry ? entry.progress : undefined, settings);
}

function applyModelStatus(
  state: ModelState | null,
  progress: number | undefined,
  settings: ExtensionSettings
) {
  const language = getLanguageName(settings.targetLanguage);
  const showProgress = state === 'downloading';

  progressTrack.style.display = showProgress ? 'block' : 'none';
  if (showProgress) {
    progressBar.style.width = `${progress ?? 0}%`;
  }

  switch (state) {
    case 'available':
      modelStatusDot.className = 'model-status-dot ready';
      modelStatusText.textContent = `${language} model ready`;
      modelInfo.textContent = 'Translations run on your device, offline.';
      break;

    case 'downloading':
      modelStatusDot.className = 'model-status-dot working';
      modelStatusText.textContent =
        progress === undefined
          ? `Downloading ${language} model...`
          : `Downloading ${language} model - ${progress}%`;
      modelInfo.textContent = 'Subtitles will start once this finishes.';
      break;

    case 'unavailable':
      modelStatusDot.className = 'model-status-dot error';
      modelStatusText.textContent = `${language} is not supported`;
      modelInfo.textContent = 'Your browser cannot translate into this language.';
      break;

    default:
      // Never seen this pair before. It downloads by itself on first use, so this
      // is information rather than an instruction.
      modelStatusDot.className = 'model-status-dot idle';
      modelStatusText.textContent = `${language} model not downloaded yet`;
      modelInfo.textContent =
        'Pause and play the video again (or click the page) to start the download.';
      break;
  }
}

// Follow downloads live while the popup is open
chrome.runtime.onMessage.addListener((message: any) => {
  if (message && message.type === MODEL_STATUS_MESSAGE && message.pairKey === currentPair) {
    storage.getAll().then((settings) => {
      applyModelStatus(message.entry.state, message.entry.progress, settings);
    });
  }
});

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
  // Model state is per language pair, so it has to be re-read here
  renderModelStatus(settings);
});

translationEngine.addEventListener('change', async () => {
  await storage.set('translationEngine', translationEngine.value);
  const settings = await storage.getAll();
  renderModelStatus(settings);
});

openSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Initialize
loadSettings();
