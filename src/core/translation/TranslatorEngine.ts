import { ITranslationEngine, PrepareResult } from '../interfaces/ITranslationEngine.js';
import { setModelStatus } from '../modelStatus.js';

/**
 * Chrome's model download sometimes stops making progress and never finishes.
 * Without a deadline, every translation waits on it forever. After this long with
 * no progress event we abandon it, report 'stalled', and let a click retry.
 */
const STALL_MS = 90_000;
/** Unpacking after 100% fires no events and can legitimately take a while */
const STALL_AFTER_COMPLETE_MS = 180_000;
const STALL_CHECK_MS = 5_000;

/** Thrown (inside a 'Translation failed' error) when a download was abandoned */
export const MODEL_STALLED = 'MODEL_STALLED';

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
  private preparing: Map<string, Promise<PrepareResult>> = new Map();

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

  /**
   * Concurrent prepare() calls for one pair share a single attempt. One click can
   * trigger several (the page-wide gesture listener and a Download button both
   * react to it); a second Translator.create() fails because the first already
   * used the click's activation, and must not tear down the download in flight.
   */
  prepare(sourceLang: string, targetLang: string): Promise<PrepareResult> {
    const sessionKey = `${sourceLang}-${targetLang}`;
    const inFlight = this.preparing.get(sessionKey);
    if (inFlight) {
      return inFlight;
    }
    const attempt = this.prepareOnce(sourceLang, targetLang, sessionKey).finally(() => {
      this.preparing.delete(sessionKey);
    });
    this.preparing.set(sessionKey, attempt);
    return attempt;
  }

  private async prepareOnce(sourceLang: string, targetLang: string, sessionKey: string): Promise<PrepareResult> {
    // @ts-ignore
    if (typeof Translator === 'undefined') {
      return 'unavailable';
    }

    // A session already exists or is downloading: ready means ready, so wait for it
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      try {
        await existing;
        return 'ready';
      } catch {
        // Its creator reported the failure and uncached it; fall through to retry
      }
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
      if (String(error).includes(MODEL_STALLED)) {
        // Already reported as stalled
      } else if ((error as any)?.name === 'NotAllowedError') {
        // Only the user activation was missing
        setModelStatus(sessionKey, { state: 'downloadable' });
      } else {
        // Asking again for a click would loop forever; say what the browser said
        setModelStatus(sessionKey, { state: 'failed', error: String((error as any)?.message || error) });
      }
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

    const abort = new AbortController();
    let lastProgressAt = Date.now();
    let complete = false;
    const watchdog = setInterval(() => {
      const limit = complete ? STALL_AFTER_COMPLETE_MS : STALL_MS;
      if (Date.now() - lastProgressAt > limit) {
        abort.abort();
      }
    }, STALL_CHECK_MS);

    let session: any;
    try {
      // @ts-ignore
      session = await Translator.create({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        signal: abort.signal,
        monitor: (m: any) => {
          m.addEventListener('downloadprogress', (event: any) => {
            const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
            lastProgressAt = Date.now();
            complete = percent >= 100;
            console.log(`[TranslatorEngine] Downloading ${sessionKey}: ${percent}%`);
            setModelStatus(sessionKey, { state: 'downloading', progress: percent });
          });
        }
      });
    } catch (error) {
      if (abort.signal.aborted) {
        console.warn(`[TranslatorEngine] Download of ${sessionKey} stalled; abandoned so it can be retried`);
        setModelStatus(sessionKey, { state: 'stalled' });
        throw new Error(MODEL_STALLED);
      }
      throw error;
    } finally {
      clearInterval(watchdog);
    }

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
