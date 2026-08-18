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

export interface ExtensionSettings {
  enabled: boolean;
  targetLanguage: string;
  sourceLanguage: string;
  translationEngine: 'edge' | 'google' | 'deepl' | 'custom';
  showOriginal: boolean;
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
  fontSizeMode: 'relative',
  fontSizeScale: 0.75,
  fontSize: 16,
  position: 'below'
};
