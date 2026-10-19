import { DisplayMode, ExtensionSettings } from './interfaces/IStorageService.js';

/** What the viewer picks in the popup, the options page or NRK's subtitle menu */
export type ModeChoice = 'off' | DisplayMode;

export interface ModeOption {
  value: ModeChoice;
  label: string;
  description: string;
}

export const MODE_OPTIONS: ModeOption[] = [
  { value: 'off', label: 'Off', description: 'NRK as usual' },
  { value: 'dual', label: 'Dual subtitles', description: 'Translation under the Norwegian, on the video' },
  { value: 'learning', label: 'Learning panel', description: 'Norwegian on the side, translation on hover' },
];

export function currentMode(settings: ExtensionSettings): ModeChoice {
  return settings.enabled ? settings.mode : 'off';
}

/**
 * The settings a choice stands for. Each mode starts from a sensible preset for
 * what is drawn on the video; the panel's NO/EN buttons fine-tune it afterwards.
 */
export function settingsForMode(choice: ModeChoice): Partial<ExtensionSettings> {
  switch (choice) {
    case 'off':
      return { enabled: false };
    case 'dual':
      return { enabled: true, mode: 'dual', showOriginal: true, showTranslation: true };
    case 'learning':
      return { enabled: true, mode: 'learning', showOriginal: false, showTranslation: false, panelCollapsed: false };
  }
}
