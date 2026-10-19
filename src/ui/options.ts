import { StorageService } from '../utils/StorageService.js';
import { ExtensionSettings } from '../core/interfaces/IStorageService.js';
import { getSupportedLanguages, populateLanguageSelect } from '../core/languages.js';
import { currentMode, settingsForMode } from '../core/modes.js';
import { renderModePicker } from './modePicker.js';

/**
 * Options page controller. Every control saves as soon as it changes, and the
 * page follows changes made elsewhere (popup, NRK's subtitle menu, the panel).
 */

const storage = new StorageService();

const targetLanguage = document.getElementById('target-language') as HTMLSelectElement;
const showOriginal = document.getElementById('show-original') as HTMLInputElement;
const showTranslation = document.getElementById('show-translation') as HTMLInputElement;
const positionBelow = document.getElementById('position-below') as HTMLInputElement;
const positionAbove = document.getElementById('position-above') as HTMLInputElement;
const fontModeRelative = document.getElementById('font-mode-relative') as HTMLInputElement;
const fontModeAbsolute = document.getElementById('font-mode-absolute') as HTMLInputElement;
const fontScale = document.getElementById('font-scale') as HTMLInputElement;
const fontScaleValue = document.getElementById('font-scale-value') as HTMLElement;
const fontScaleGroup = document.getElementById('font-scale-group') as HTMLDivElement;
const fontSizeGroup = document.getElementById('font-size-group') as HTMLDivElement;
const fontSize = document.getElementById('font-size') as HTMLInputElement;
const pauseOnHover = document.getElementById('pause-on-hover') as HTMLInputElement;
const saved = document.getElementById('saved') as HTMLSpanElement;

const selectMode = renderModePicker(document.getElementById('modes') as HTMLElement, (choice) => {
  save(settingsForMode(choice));
});

let savedTimer: number | undefined;

async function save(changes: Partial<ExtensionSettings>) {
  await storage.update(changes);
  saved.classList.add('show');
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => saved.classList.remove('show'), 1500);
}

function render(settings: ExtensionSettings) {
  selectMode(currentMode(settings));
  showOriginal.checked = settings.showOriginal;
  showTranslation.checked = settings.showTranslation;
  positionBelow.checked = settings.position !== 'above';
  positionAbove.checked = settings.position === 'above';
  fontModeRelative.checked = settings.fontSizeMode !== 'absolute';
  fontModeAbsolute.checked = settings.fontSizeMode === 'absolute';
  fontScale.value = String(settings.fontSizeScale);
  fontSize.value = String(settings.fontSize);
  pauseOnHover.checked = settings.pauseOnHover;
  updateFontModeVisibility();
}

/** Only one of the two size controls is meaningful at a time */
function updateFontModeVisibility() {
  const isAbsolute = fontModeAbsolute.checked;
  fontSizeGroup.hidden = !isAbsolute;
  fontScaleGroup.hidden = isAbsolute;
  fontScaleValue.textContent = `${Math.round(parseFloat(fontScale.value) * 100)}%`;
}

async function load() {
  const settings = await storage.getAll();
  render(settings);

  // Read from the browser rather than hardcoded, so the list matches what it supports
  const languages = await getSupportedLanguages(settings.sourceLanguage);
  populateLanguageSelect(targetLanguage, languages, settings.targetLanguage);
  const description = document.getElementById('target-language-description');
  if (description) {
    description.textContent = `${languages.length} languages available in this browser.`;
  }
}

targetLanguage.addEventListener('change', () => save({ targetLanguage: targetLanguage.value }));
showOriginal.addEventListener('change', () => save({ showOriginal: showOriginal.checked }));
showTranslation.addEventListener('change', () => save({ showTranslation: showTranslation.checked }));
pauseOnHover.addEventListener('change', () => save({ pauseOnHover: pauseOnHover.checked }));
[positionBelow, positionAbove].forEach((radio) =>
  radio.addEventListener('change', () => save({ position: positionAbove.checked ? 'above' : 'below' }))
);
[fontModeRelative, fontModeAbsolute].forEach((radio) =>
  radio.addEventListener('change', () => {
    updateFontModeVisibility();
    save({ fontSizeMode: fontModeAbsolute.checked ? 'absolute' : 'relative' });
  })
);
fontScale.addEventListener('input', updateFontModeVisibility);
fontScale.addEventListener('change', () => save({ fontSizeScale: parseFloat(fontScale.value) }));
fontSize.addEventListener('change', () => {
  const value = parseInt(fontSize.value, 10);
  if (Number.isFinite(value)) {
    save({ fontSize: value });
  }
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'sync') {
    storage.getAll().then(render);
  }
});

load();
