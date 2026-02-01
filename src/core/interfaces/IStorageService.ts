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
  fontSize: number;
  position: 'below' | 'above' | 'overlay';
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  targetLanguage: 'en',
  sourceLanguage: 'no',
  translationEngine: 'edge',
  showOriginal: true,
  fontSize: 16,
  position: 'below'
};
