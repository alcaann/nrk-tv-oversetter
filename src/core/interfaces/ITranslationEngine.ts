/**
 * Interface for translation engines
 * Allows swapping between different translation providers (Edge API, Google, DeepL, etc.)
 */
/**
 * Outcome of preparing a language pair.
 *
 * 'needs-gesture' is not an error: Chrome refuses to start a model download unless
 * the page has transient user activation, so the download has to wait for the user
 * to click something. Pressing play counts.
 */
export type PrepareResult = 'ready' | 'needs-gesture' | 'unavailable';

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
   * Warm up a language pair ahead of the first translation.
   *
   * For on-device engines this is what starts the model download, so calling it
   * early means the download begins when the user picks a language rather than
   * whenever a subtitle happens to appear - which on quiet footage can be minutes.
   */
  prepare(sourceLang: string, targetLang: string): Promise<PrepareResult>;

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
