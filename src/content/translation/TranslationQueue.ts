import { Caption } from '../captions/types.js';
import { ITranslationEngine } from '../../core/interfaces/ITranslationEngine.js';
import { Logger } from '../../utils/Logger.js';
import { sendSubtitleLog } from '../../utils/subtitleLog.js';

/** Translate captions up to this far ahead of the playhead, so hover is instant */
const LOOKAHEAD_S = 60;

/** Interactions that grant the transient activation Chrome needs to download a model */
const GESTURE_EVENTS: string[] = ['pointerdown', 'keydown'];

export type TranslatedListener = (caption: Caption, translation: string) => void;

/**
 * Translates captions one at a time, nearest the playhead first.
 *
 * The track hands us cues well before they are spoken, so translating ahead means
 * the English is usually ready before the line appears. Results are cached by text:
 * NRK repeats short lines ("Ja.", "Hva?") constantly.
 *
 * If the model still needs downloading and Chrome wants a user gesture for that,
 * the queue parks itself until the next click or key press rather than failing
 * every line.
 */
export class TranslationQueue {
  private engine: ITranslationEngine | null = null;
  private sourceLang = '';
  private targetLang = '';
  private cache = new Map<string, string>();
  private pending = new Map<string, Caption>();
  private busy = false;
  private waitingForGesture = false;
  private gestureHandler: (() => void) | null = null;
  private generation = 0;

  constructor(
    private readonly playhead: () => number,
    private readonly onTranslated: TranslatedListener,
    private readonly onStateChange: () => void = () => {}
  ) {}

  /** Point the queue at an engine and language pair. Clears the cache if the pair changed. */
  configure(engine: ITranslationEngine | null, sourceLang: string, targetLang: string): void {
    const changed = engine !== this.engine || sourceLang !== this.sourceLang || targetLang !== this.targetLang;
    if (!changed) {
      return;
    }
    this.generation++;
    this.engine = engine;
    this.sourceLang = sourceLang;
    this.targetLang = targetLang;
    this.cache.clear();
    this.busy = false;
    this.waitingForGesture = false;
    this.removeGestureListener();
    if (engine) {
      this.warm();
    }
  }

  /** True while the model download is waiting for a click or key press */
  get needsGesture(): boolean {
    return this.waitingForGesture;
  }

  get(caption: Caption): string | undefined {
    return this.cache.get(caption.text);
  }

  request(captions: readonly Caption[]): void {
    for (const caption of captions) {
      if (this.cache.has(caption.text)) {
        this.onTranslated(caption, this.cache.get(caption.text)!);
      } else {
        this.pending.set(caption.id, caption);
      }
    }
    this.pump();
  }

  /** Forget queued work, e.g. when a new program starts. The cache is kept. */
  clear(): void {
    this.pending.clear();
  }

  /** Call as the playhead moves, so captions entering the lookahead get picked up */
  pump(): void {
    if (this.busy || this.waitingForGesture || !this.engine) {
      return;
    }
    const next = this.pickNext();
    if (!next) {
      return;
    }
    this.pending.delete(next.id);
    this.busy = true;
    const generation = this.generation;

    this.engine
      .translate(next.text, this.sourceLang, this.targetLang)
      .then((translation) => {
        if (generation !== this.generation) {
          return;
        }
        this.cache.set(next.text, translation);
        sendSubtitleLog('translation_complete', { original: next.text, translated: translation });
        this.onTranslated(next, translation);
      })
      .catch((error) => {
        if (generation !== this.generation) {
          return;
        }
        if (String(error).includes('AWAITING_USER_GESTURE')) {
          this.pending.set(next.id, next);
          this.parkUntilGesture();
          return;
        }
        // Dropped rather than retried, so a broken engine cannot spin
        Logger.error('Failed to translate caption:', error);
        sendSubtitleLog('translation_error', { original: next.text, error: String(error) });
      })
      .finally(() => {
        if (generation === this.generation) {
          this.busy = false;
          this.pump();
        }
      });
  }

  dispose(): void {
    this.generation++;
    this.pending.clear();
    this.removeGestureListener();
  }

  private pickNext(): Caption | null {
    const now = this.playhead();
    let best: Caption | null = null;
    let bestScore = Infinity;
    for (const caption of this.pending.values()) {
      if (this.cache.has(caption.text)) {
        this.pending.delete(caption.id);
        this.onTranslated(caption, this.cache.get(caption.text)!);
        continue;
      }
      if (caption.start > now + LOOKAHEAD_S) {
        continue;
      }
      const score = Math.abs(caption.start - now);
      if (score < bestScore) {
        best = caption;
        bestScore = score;
      }
    }
    return best;
  }

  /** Start the model download now rather than at the first caption */
  private warm(): void {
    const engine = this.engine;
    const generation = this.generation;
    engine
      ?.prepare(this.sourceLang, this.targetLang)
      .then((result) => {
        if (generation === this.generation && result === 'needs-gesture') {
          Logger.info('Model download is waiting for you to interact with the page');
          this.parkUntilGesture();
        }
      })
      .catch(() => {
        if (generation === this.generation) {
          this.parkUntilGesture();
        }
      });
  }

  private parkUntilGesture(): void {
    if (!this.waitingForGesture) {
      this.waitingForGesture = true;
      this.onStateChange();
    }
    if (this.gestureHandler) {
      return;
    }
    const handler = () => {
      this.removeGestureListener();
      const generation = this.generation;
      // prepare() runs inside the gesture, which is what lets the download start
      this.engine
        ?.prepare(this.sourceLang, this.targetLang)
        .then((result) => {
          if (generation !== this.generation) {
            return;
          }
          if (result === 'ready') {
            this.waitingForGesture = false;
            this.onStateChange();
            this.pump();
          } else if (result === 'needs-gesture') {
            this.parkUntilGesture();
          }
        })
        .catch(() => generation === this.generation && this.parkUntilGesture());
    };
    this.gestureHandler = handler;
    for (const event of GESTURE_EVENTS) {
      document.addEventListener(event, handler, { capture: true });
    }
  }

  private removeGestureListener(): void {
    if (!this.gestureHandler) {
      return;
    }
    for (const event of GESTURE_EVENTS) {
      document.removeEventListener(event, this.gestureHandler, { capture: true });
    }
    this.gestureHandler = null;
  }
}
