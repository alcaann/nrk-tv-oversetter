import { StorageService } from '../utils/StorageService.js';
import { ExtensionSettings } from '../core/interfaces/IStorageService.js';
import { getSupportedLanguages, populateLanguageSelect } from '../core/languages.js';

/**
 * Options page controller
 */

const storage = new StorageService();

// DOM elements
const sourceLanguage = document.getElementById('source-language') as HTMLSelectElement;
const targetLanguage = document.getElementById('target-language') as HTMLSelectElement;
const translationEngine = document.getElementById('translation-engine') as HTMLSelectElement;
const positionBelow = document.getElementById('position-below') as HTMLInputElement;
const positionAbove = document.getElementById('position-above') as HTMLInputElement;
const fontModeRelative = document.getElementById('font-mode-relative') as HTMLInputElement;
const fontModeAbsolute = document.getElementById('font-mode-absolute') as HTMLInputElement;
const fontScale = document.getElementById('font-scale') as HTMLInputElement;
const fontScaleValue = document.getElementById('font-scale-value') as HTMLSpanElement;
const fontScaleGroup = document.getElementById('font-scale-group') as HTMLDivElement;
const fontSizeGroup = document.getElementById('font-size-group') as HTMLDivElement;
const fontSize = document.getElementById('font-size') as HTMLInputElement;
const showOriginal = document.getElementById('show-original') as HTMLInputElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;

// Load current settings
async function loadSettings() {
  const settings = await storage.getAll();

  sourceLanguage.value = settings.sourceLanguage;

  // Read from the browser rather than hardcoded, so the list matches what it supports
  const languages = await getSupportedLanguages(settings.sourceLanguage);
  populateLanguageSelect(targetLanguage, languages, settings.targetLanguage);

  const description = document.getElementById('target-language-description');
  if (description) {
    description.textContent =
      `The language you want subtitles translated to - ${languages.length} available in this browser`;
  }
  translationEngine.value = settings.translationEngine;
  fontSize.value = settings.fontSize.toString();
  fontScale.value = settings.fontSizeScale.toString();

  if (settings.fontSizeMode === 'absolute') {
    fontModeAbsolute.checked = true;
  } else {
    fontModeRelative.checked = true;
  }
  updateFontModeVisibility();
  showOriginal.checked = settings.showOriginal;

  if (settings.position === 'below') {
    positionBelow.checked = true;
  } else {
    positionAbove.checked = true;
  }
}

// Save settings
async function saveSettings() {
  const position = positionBelow.checked ? 'below' : 'above';

  const settings: ExtensionSettings = {
    enabled: true, // Keep current enabled state
    sourceLanguage: sourceLanguage.value,
    targetLanguage: targetLanguage.value,
    translationEngine: translationEngine.value as any,
    position: position as any,
    fontSizeMode: fontModeAbsolute.checked ? 'absolute' : 'relative',
    fontSizeScale: parseFloat(fontScale.value),
    fontSize: parseInt(fontSize.value),
    showOriginal: showOriginal.checked
  };

  // Merge with existing settings to preserve 'enabled' state
  const currentSettings = await storage.getAll();
  settings.enabled = currentSettings.enabled;

  await storage.saveAll(settings);

  // Show save confirmation
  saveStatus.classList.add('show', 'success');
  setTimeout(() => {
    saveStatus.classList.remove('show');
  }, 2000);
}

/**
 * Only one of the two size controls is meaningful at a time, so hide the other.
 */
function updateFontModeVisibility() {
  const isAbsolute = fontModeAbsolute.checked;
  fontSizeGroup.style.display = isAbsolute ? '' : 'none';
  fontScaleGroup.style.display = isAbsolute ? 'none' : '';
  fontScaleValue.textContent = `${Math.round(parseFloat(fontScale.value) * 100)}%`;
}

// Event listeners
saveButton.addEventListener('click', saveSettings);

[fontModeRelative, fontModeAbsolute].forEach((radio) => {
  radio.addEventListener('change', updateFontModeVisibility);
});

fontScale.addEventListener('input', () => {
  fontScaleValue.textContent = `${Math.round(parseFloat(fontScale.value) * 100)}%`;
});

// Auto-save on change (optional - can be removed if you prefer manual save only)
[sourceLanguage, targetLanguage, translationEngine, positionBelow, positionAbove, fontSize, fontScale, fontModeRelative, fontModeAbsolute, showOriginal].forEach(element => {
  element.addEventListener('change', () => {
    // Optional: Enable auto-save
    // saveSettings();
  });
});

// Initialize
loadSettings();

// ========== Real-Time Log Viewer ==========

const logViewer = document.getElementById('log-viewer') as HTMLDivElement;
const clearLogButton = document.getElementById('clear-log') as HTMLButtonElement;
const pauseLogButton = document.getElementById('pause-log') as HTMLButtonElement;
const logStatus = document.getElementById('log-status') as HTMLSpanElement;

let logPaused = false;
let logCount = 0;

// Listen for subtitle log messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBTITLE_LOG' && !logPaused) {
    addLogEntry(message.logType, message.data);
  }
});

function addLogEntry(logType: string, data: any) {
  // Remove empty message if this is the first log
  const emptyMsg = logViewer.querySelector('.log-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  // Create log entry
  const entry = document.createElement('div');
  entry.className = `log-entry ${logType.replace('_', '-')}`;

  const time = new Date(data.timestamp).toLocaleTimeString();

  let content = '';

  switch (logType) {
    case 'subtitle_detected':
      content = `
        <div class="log-time">${time}</div>
        <div class="log-type detected">Subtitle Detected</div>
        <div class="log-text">
          <span class="log-original">${escapeHtml(data.original)}</span>
        </div>
      `;
      break;

    case 'translation_complete':
      content = `
        <div class="log-time">${time}</div>
        <div class="log-type translated">Translation Complete</div>
        <div class="log-text">
          <div><strong>Original:</strong> <span class="log-original">${escapeHtml(data.original)}</span></div>
          <div><strong>Translated:</strong> <span class="log-translated">${escapeHtml(data.translated)}</span></div>
        </div>
      `;
      break;

    case 'translation_error':
      content = `
        <div class="log-time">${time}</div>
        <div class="log-type error">Translation Error</div>
        <div class="log-text">
          <div><strong>Text:</strong> <span class="log-original">${escapeHtml(data.original)}</span></div>
          <div class="log-error"><strong>Error:</strong> ${escapeHtml(data.error)}</div>
        </div>
      `;
      break;
  }

  entry.innerHTML = content;
  logViewer.appendChild(entry);

  // Keep only last 100 entries
  const entries = logViewer.querySelectorAll('.log-entry');
  if (entries.length > 100) {
    entries[0].remove();
  }

  // Auto-scroll to bottom
  logViewer.scrollTop = logViewer.scrollHeight;

  // Update status
  logCount++;
  logStatus.textContent = `${logCount} entries`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Clear log button
clearLogButton.addEventListener('click', () => {
  logViewer.innerHTML = '<div class="log-empty">Log cleared. Waiting for new subtitles...</div>';
  logCount = 0;
  logStatus.textContent = 'Log cleared';
});

// Pause/Resume log button
pauseLogButton.addEventListener('click', () => {
  logPaused = !logPaused;

  if (logPaused) {
    pauseLogButton.textContent = 'Resume';
    pauseLogButton.classList.add('paused');
    logStatus.textContent = 'Paused';
  } else {
    pauseLogButton.textContent = 'Pause';
    pauseLogButton.classList.remove('paused');
    logStatus.textContent = `${logCount} entries`;
  }
});
