/**
 * Interface for extension storage operations
 */
export interface IStorageService {
  /**
   * Get a value from storage
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in storage
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Get all settings
   */
  getAll(): Promise<ExtensionSettings>;

  /**
   * Save all settings
   */
  saveAll(settings: ExtensionSettings): Promise<void>;
}

export type DisplayMode = 'dual' | 'learning';

export interface ExtensionSettings {
  enabled: boolean;
  targetLanguage: string;
  sourceLanguage: string;
  translationEngine: 'edge' | 'google' | 'deepl' | 'custom';
  /**
   * 'dual': translation drawn under NRK's subtitles on the video (the original
   * behaviour). 'learning': caption history in a side panel, translation on hover.
   * Choosing a mode applies a preset to the two flags below (see core/modes.ts).
   */
  mode: DisplayMode;
  /** Show NRK's own Norwegian subtitles on the video */
  showOriginal: boolean;
  /** Show the translated line on the video */
  showTranslation: boolean;
  /** Learning panel folded away to a tab */
  panelCollapsed: boolean;
  /**
   * False only on a fresh install, until the viewer answers the first-run card on
   * the player. Defaults to true so people updating never see it.
   */
  onboarded: boolean;
  /** Pause playback while the pointer is over the history panel */
  pauseOnHover: boolean;
  /** 'relative' scales with NRK's own subtitle size; 'absolute' uses a fixed pixel value */
  fontSizeMode: 'relative' | 'absolute';
  /** Multiplier applied to NRK's computed subtitle size when fontSizeMode is 'relative' */
  fontSizeScale: number;
  /** Fixed size in pixels, used when fontSizeMode is 'absolute' */
  fontSize: number;
  position: 'below' | 'above' | 'overlay';
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  targetLanguage: 'en',
  sourceLanguage: 'no',
  translationEngine: 'edge',
  showOriginal: true,
  showTranslation: true,
  mode: 'dual',
  panelCollapsed: false,
  pauseOnHover: true,
  onboarded: true,
  fontSizeMode: 'relative',
  fontSizeScale: 0.75,
  fontSize: 16,
  position: 'below'
};
