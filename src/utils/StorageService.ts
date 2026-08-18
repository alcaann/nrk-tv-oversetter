import { IStorageService, ExtensionSettings, DEFAULT_SETTINGS } from '../core/interfaces/IStorageService.js';

/**
 * Chrome storage API wrapper for extension settings
 */
export class StorageService implements IStorageService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.sync.get(key);
      return result[key] ?? null;
    } catch (error) {
      console.error('[StorageService] Error getting key:', key, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error('[StorageService] Error setting key:', key, error);
      throw error;
    }
  }

  async getAll(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.sync.get(null);
      const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...result };

      // Installs from before fontSizeMode existed only stored a pixel value. If that
      // user had changed it from the default, they chose that size deliberately, so
      // keep them on a fixed size instead of silently switching them to relative.
      if (
        result.fontSizeMode === undefined &&
        typeof result.fontSize === 'number' &&
        result.fontSize !== DEFAULT_SETTINGS.fontSize
      ) {
        settings.fontSizeMode = 'absolute';
      }

      return settings;
    } catch (error) {
      console.error('[StorageService] Error getting all settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async saveAll(settings: ExtensionSettings): Promise<void> {
    try {
      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('[StorageService] Error saving all settings:', error);
      throw error;
    }
  }
}
