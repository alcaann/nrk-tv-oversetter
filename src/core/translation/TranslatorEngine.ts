import { ITranslationEngine, PrepareResult } from '../interfaces/ITranslationEngine.js';
import { setModelStatus } from '../modelStatus.js';

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
  /**
   * Cached by promise rather than by resolved session.
   *
   * Creating a session is what triggers the model download, which can take a long
   * time. Subtitles keep arriving during it, and if we cached only the finished
   * session every one of them would see an empty cache and start its own download.
   */
  private sessions: Map<string, Promise<any>> = new Map();

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

      let sessionPromise = this.sessions.get(sessionKey);

      if (!sessionPromise && !this.hasUserActivation()) {
        // The model still needs downloading and we have no user gesture to do it
        // with. Stay quiet - the page's gesture listener will start it.
        setModelStatus(sessionKey, { state: 'downloadable' });
        throw new Error('AWAITING_USER_GESTURE');
      }

      if (!sessionPromise) {
        sessionPromise = this.createSession(sourceLang, targetLang, sessionKey);

        // Stored before awaiting, so concurrent subtitles join this download
        // instead of each starting one of their own
        this.sessions.set(sessionKey, sessionPromise);

        // A failed creation must not be cached, or the pair is broken until reload
        sessionPromise.catch(() => {
          if (this.sessions.get(sessionKey) === sessionPromise) {
            this.sessions.delete(sessionKey);
          }
        });
      }

      const session = await sessionPromise;
      const translatedText = await session.translate(text);

      return translatedText;
    } catch (error) {
      console.error('[TranslatorEngine] Translation error:', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  /**
   * Chrome only allows a model download to start while the page has transient user
   * activation. Checking for it up front avoids throwing NotAllowedError on every
   * subtitle, and lets the caller wait for a click instead.
   */
  private hasUserActivation(): boolean {
    const activation = (navigator as any).userActivation;
    // If the browser does not expose the API, assume it is fine and let create() rule
    return activation ? activation.isActive === true : true;
  }

  async prepare(sourceLang: string, targetLang: string): Promise<PrepareResult> {
    // @ts-ignore
    if (typeof Translator === 'undefined') {
      return 'unavailable';
    }

    const sessionKey = `${sourceLang}-${targetLang}`;
    if (this.sessions.has(sessionKey)) {
      return 'ready';
    }

    // @ts-ignore
    const availability = await Translator.availability({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    if (availability === 'unavailable') {
      setModelStatus(sessionKey, { state: 'unavailable' });
      return 'unavailable';
    }

    if (availability !== 'available' && !this.hasUserActivation()) {
      // Downloading would throw. Tell the UI so it can ask for a click.
      setModelStatus(sessionKey, { state: 'downloadable' });
      return 'needs-gesture';
    }

    const sessionPromise = this.createSession(sourceLang, targetLang, sessionKey);
    this.sessions.set(sessionKey, sessionPromise);

    try {
      await sessionPromise;
      return 'ready';
    } catch (error) {
      // Leave the pair uncached so it can be retried
      if (this.sessions.get(sessionKey) === sessionPromise) {
        this.sessions.delete(sessionKey);
      }
      console.warn(`[TranslatorEngine] Could not prepare ${sessionKey}:`, error);
      setModelStatus(sessionKey, { state: 'downloadable' });
      return 'needs-gesture';
    }
  }

  /**
   * Create a translator session, downloading the language pack if needed.
   */
  private async createSession(sourceLang: string, targetLang: string, sessionKey: string): Promise<any> {
    // @ts-ignore
    const availability = await Translator.availability({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    console.log(`[TranslatorEngine] Availability for ${sessionKey}:`, availability);

    if (availability === 'unavailable') {
      setModelStatus(sessionKey, { state: 'unavailable' });
      throw new Error(`Translation from ${sourceLang} to ${targetLang} is not available.`);
    }

    // This context is the only one that gets a truthful answer, so publish it
    setModelStatus(sessionKey, { state: availability === 'available' ? 'available' : 'downloading' });

    if (availability === 'downloadable' || availability === 'downloading') {
      console.log(`[TranslatorEngine] Model is ${availability}. Creating the session downloads it.`);
    }

    // @ts-ignore
    const session = await Translator.create({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      monitor: (m: any) => {
        m.addEventListener('downloadprogress', (event: any) => {
          const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          console.log(`[TranslatorEngine] Downloading ${sessionKey}: ${percent}%`);
          setModelStatus(sessionKey, { state: 'downloading', progress: percent });
        });
      }
    });

    console.log(`[TranslatorEngine] Created session for ${sessionKey}`);
    setModelStatus(sessionKey, { state: 'available' });
    return session;
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
    for (const [key, sessionPromise] of this.sessions.entries()) {
      try {
        const session = await sessionPromise;
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
