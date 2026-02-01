import { ITranslationEngine } from '../interfaces/ITranslationEngine.js';

/**
 * Translation engine using the built-in Chrome/Edge Translator API
 *
 * This uses the browser's built-in translation capabilities, which work offline
 * after the initial model download.
 *
 * Supported in:
 * - Google Chrome (stable)
 * - Microsoft Edge (stable and Canary)
 * - Other Chromium-based browsers
 *
 * Documentation: https://developer.chrome.com/docs/ai/translator-api
 */
export class TranslatorEngine implements ITranslationEngine {
  private sessions: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    // The Translator API will be initialized when needed
    console.log('[TranslatorEngine] Initialized');
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // Check if the Translator API exists
    // @ts-ignore - Translator API types not yet in @types/chrome
    if (typeof Translator === 'undefined') {
      throw new Error('Translator API is not available. Make sure you are using a compatible browser (Chrome/Edge).');
    }

    try {
      // Create a unique key for this language pair
      const sessionKey = `${sourceLang}-${targetLang}`;

      // Check if we already have a session for this language pair
      if (!this.sessions.has(sessionKey)) {
        // Check availability first
        // @ts-ignore
        const availability = await Translator.availability({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang
        });

        console.log(`[TranslatorEngine] Availability for ${sessionKey}:`, availability);

        if (availability === 'unavailable') {
          throw new Error(`Translation from ${sourceLang} to ${targetLang} is not available.`);
        }

        if (availability === 'downloadable' || availability === 'downloading') {
          console.log(`[TranslatorEngine] Model is ${availability}. Creating session will trigger download.`);
        }

        // Create a new translator session
        // @ts-ignore
        const session = await Translator.create({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang
        });

        console.log(`[TranslatorEngine] Created session for ${sessionKey}`);
        this.sessions.set(sessionKey, session);
      }

      // Get the session and translate
      const session = this.sessions.get(sessionKey);
      const translatedText = await session.translate(text);

      return translatedText;
    } catch (error) {
      console.error('[TranslatorEngine] Translation error:', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    // Check if the Translator API is available
    // @ts-ignore
    return typeof Translator !== 'undefined';
  }

  getName(): string {
    return 'Built-in Browser Translation';
  }

  async dispose(): Promise<void> {
    // Destroy all active sessions
    for (const [key, session] of this.sessions.entries()) {
      try {
        await session.destroy();
        console.log(`[TranslatorEngine] Destroyed session: ${key}`);
      } catch (error) {
        console.error(`[TranslatorEngine] Error destroying session ${key}:`, error);
      }
    }
    this.sessions.clear();
    console.log('[TranslatorEngine] Disposed');
  }
}
