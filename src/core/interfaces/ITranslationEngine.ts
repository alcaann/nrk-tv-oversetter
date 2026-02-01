/**
 * Interface for translation engines
 * Allows swapping between different translation providers (Edge API, Google, DeepL, etc.)
 */
export interface ITranslationEngine {
  /**
   * Initialize the translation engine
   */
  initialize(): Promise<void>;

  /**
   * Translate text from source language to target language
   * @param text - The text to translate
   * @param sourceLang - Source language code (e.g., 'no' for Norwegian)
   * @param targetLang - Target language code (e.g., 'en' for English)
   * @returns Translated text
   */
  translate(text: string, sourceLang: string, targetLang: string): Promise<string>;

  /**
   * Check if the translation engine is available/supported
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the name of the translation engine
   */
  getName(): string;

  /**
   * Clean up resources when switching engines
   */
  dispose(): Promise<void>;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  engineUsed: string;
}
