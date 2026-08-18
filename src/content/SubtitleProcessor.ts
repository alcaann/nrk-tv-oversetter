import { ISubtitleProcessor, SubtitleElement } from '../core/interfaces/ISubtitleProcessor.js';
import { ITranslationEngine } from '../core/interfaces/ITranslationEngine.js';
import { TranslationEngineFactory } from '../core/translation/TranslationEngineFactory.js';
import { StorageService } from '../utils/StorageService.js';
import { Logger } from '../utils/Logger.js';
import { ExtensionSettings } from '../core/interfaces/IStorageService.js';

/**
 * Processes NRK TV subtitles and adds translations
 */
/**
 * Marks a subtitle element we hid for showOriginal, holding its previous inline
 * display value. Kept in the DOM rather than in instance state so that ANY
 * processor can restore it - a processor that gets orphaned by rapid settings
 * changes would otherwise leave the page permanently without subtitles.
 */
const HIDDEN_ORIGINAL_ATTR = 'data-nrk-oversetter-hidden';

/** Interactions that grant the transient activation Chrome needs to download a model */
const GESTURE_EVENTS: string[] = ['pointerdown', 'keydown'];

/** Restore every original this extension hid, whoever hid it. */
function restoreAllHiddenOriginals(): void {
  document.querySelectorAll(`[${HIDDEN_ORIGINAL_ATTR}]`).forEach((el) => {
    const element = el as HTMLElement;
    element.style.display = element.getAttribute(HIDDEN_ORIGINAL_ATTR) || '';
    element.removeAttribute(HIDDEN_ORIGINAL_ATTR);
  });
}

export class SubtitleProcessor implements ISubtitleProcessor {
  private observer: MutationObserver | null = null;
  private processedSubtitles: Set<string> = new Set();
  private translationEngine: ITranslationEngine | null = null;
  private storageService: StorageService;
  private settings: ExtensionSettings | null = null;
  private pollingInterval: number | null = null;
  private lastSubtitleText: string = '';
  private subtitleContainer: HTMLElement | null = null;
  private disposed: boolean = false;
  private gestureHandler: (() => void) | null = null;

  constructor() {
    this.storageService = new StorageService();
  }

  async initialize(): Promise<void> {
    Logger.info('Initializing SubtitleProcessor');

    // Load settings
    this.settings = await this.storageService.getAll();

    if (!this.settings.enabled) {
      Logger.info('Extension is disabled');
      return;
    }

    // Initialize translation engine
    try {
      this.translationEngine = await TranslationEngineFactory.getEngine(this.settings.translationEngine);
      Logger.info(`Translation engine initialized: ${this.translationEngine.getName()}`);
    } catch (error) {
      Logger.error('Failed to initialize translation engine:', error);
      return;
    }

    // Start the model download now rather than waiting for a subtitle, which on
    // quiet footage can be minutes away. If the browser wants a user gesture first,
    // wait for one instead of failing.
    this.warmModel();

    // Start observing subtitle changes
    this.startObserving();
  }

  /**
   * Get the model for the current pair ready, waiting for a user gesture if the
   * browser insists on one before starting a download.
   */
  private warmModel(): void {
    if (!this.settings || !this.translationEngine) {
      return;
    }

    const { sourceLanguage, targetLanguage } = this.settings;

    this.translationEngine
      .prepare(sourceLanguage, targetLanguage)
      .then((result) => {
        if (this.disposed) {
          return;
        }
        if (result === 'needs-gesture') {
          Logger.info('Model download is waiting for you to interact with the page');
          this.armGestureListener();
        }
      })
      .catch(() => {
        // Engine already reported it; the gesture listener will retry
        if (!this.disposed) {
          this.armGestureListener();
        }
      });
  }

  /**
   * Retry the download on the next real interaction. Pressing play is the usual one,
   * but any click or key press grants the activation Chrome asks for.
   */
  private armGestureListener(): void {
    if (this.gestureHandler || this.disposed) {
      return;
    }

    const handler = () => {
      this.removeGestureListener();
      if (!this.disposed) {
        this.warmModel();
      }
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

  private startObserving(): void {
    // Look for NRK TV subtitle container
    const subtitleContainer = this.findSubtitleContainer();

    if (!subtitleContainer) {
      Logger.info('Waiting for video with subtitles... (will retry every 2s)');
      setTimeout(() => {
        // A settings change may have replaced us while we were waiting
        if (!this.disposed) {
          this.startObserving();
        }
      }, 2000);
      return;
    }

    Logger.info('Subtitle container found, starting observation');

    // Store reference to container for polling
    this.subtitleContainer = subtitleContainer;

    // Initialize lastSubtitleText to prevent polling from re-processing initial subtitle
    const currentText = this.getOriginalText(subtitleContainer);
    if (currentText) {
      this.lastSubtitleText = currentText;
    }

    this.scanForExistingSubtitles(subtitleContainer);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              this.processSubtitle(element);
            }
          });
        } else if (mutation.type === 'characterData' || mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          if (target.nodeType === Node.ELEMENT_NODE) {
            this.processSubtitle(target);
          } else if (mutation.type === 'characterData' && target.parentElement) {
            // Character data changes happen on text nodes, process parent element
            this.processSubtitle(target.parentElement);
          }
        }
      }
    });

    this.observer.observe(subtitleContainer, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });

    // Start polling as fallback for subtitle changes that don't trigger mutations
    // NRK uses Lit framework which may update text without firing mutation events
    this.startPolling();
  }

  /**
   * Poll the subtitle container for changes as a fallback
   * This catches subtitle updates that don't trigger MutationObserver
   */
  private startPolling(): void {
    this.pollingInterval = window.setInterval(() => {
      if (this.disposed) {
        return;
      }

      // Re-query container each time in case NRK replaces the element
      const container = this.findSubtitleContainer();
      if (!container) return;

      const currentText = this.getOriginalText(container);

      // Detect ANY change in subtitle text
      if (currentText !== this.lastSubtitleText) {
        // Clear cache on ANY change - new subtitle means old one is gone
        this.processedSubtitles.clear();

        if (!currentText) {
          this.lastSubtitleText = '';
        } else {
          this.lastSubtitleText = currentText;
          this.processSubtitle(container); // Use freshly queried container
        }
      }
    }, 500);
  }

  private findSubtitleContainer(): HTMLElement | null {
    // NRK TV subtitle selectors - ordered by specificity
    const possibleSelectors = [
      '.tv-player-subtitle-text',      // NRK's current subtitle element (exact match)
      'span[class*="subtitle"]',       // fallback if NRK renames the class
      '.nrk-subtitle',
      '.video-subtitle',
      '.vjs-text-track-display',
    ];

    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        // Check if it's a web component with shadow DOM
        if (element.shadowRoot) {
          Logger.warn('Subtitle container has shadow DOM - MutationObserver may not work properly');
        }

        return element;
      }
    }

    return null;
  }

  /**
   * Scan container for existing subtitles and process them
   * This is needed because MutationObserver only detects changes, not existing content
   */
  private scanForExistingSubtitles(container: HTMLElement): void {
    // Only process the container itself, not child elements
    // Processing children recursively can create duplicate translations
    // if NRK's subtitle structure has nested elements
    this.processSubtitle(container);
  }

  async processSubtitle(element: HTMLElement): Promise<void> {
    if (this.disposed || !this.settings || !this.settings.enabled || !this.translationEngine) {
      return;
    }

    // Skip if this is our own translation element
    if (element.classList.contains('nrk-oversetter-translation')) {
      return;
    }

    // Extract only the original text, excluding our translation elements
    const text = this.getOriginalText(element);
    if (!text) {
      return;
    }

    // Skip if already processed
    const elementId = this.getElementId(element, text);
    if (this.processedSubtitles.has(elementId)) {
      return;
    }

    // Mark as processed IMMEDIATELY to prevent duplicate processing
    // (mutation observer can fire multiple times before async translation completes)
    this.processedSubtitles.add(elementId);

    // Send log message to options page
    this.sendLogMessage('subtitle_detected', {
      original: text,
      timestamp: new Date().toISOString()
    });

    try {
      // Translate the subtitle
      const translatedText = await this.translationEngine.translate(
        text,
        this.settings.sourceLanguage,
        this.settings.targetLanguage
      );

      // Send translation log
      this.sendLogMessage('translation_complete', {
        original: text,
        translated: translatedText,
        timestamp: new Date().toISOString()
      });

      // We may have been replaced while the translation was in flight
      if (this.disposed) {
        return;
      }

      // Add translation to the page
      this.addTranslation(element, text, translatedText);

      // Clean up old processed IDs (keep last 100)
      if (this.processedSubtitles.size > 100) {
        const iterator = this.processedSubtitles.values();
        const firstValue = iterator.next().value;
        if (firstValue !== undefined) {
          this.processedSubtitles.delete(firstValue);
        }
      }
    } catch (error) {
      if (String(error).includes('AWAITING_USER_GESTURE')) {
        // Expected while the model is still waiting on a click - not a failure
        this.armGestureListener();
        return;
      }

      Logger.error('Failed to translate subtitle:', error);

      // Send error log
      this.sendLogMessage('translation_error', {
        original: text,
        error: String(error),
        timestamp: new Date().toISOString()
      });
    }
  }

  private sendLogMessage(type: string, data: any): void {
    // Send message to extension (will be received by options page if open)
    chrome.runtime.sendMessage({
      type: 'SUBTITLE_LOG',
      logType: type,
      data: data
    }).catch(() => {
      // Ignore errors if options page is not open
    });
  }

  private getElementId(element: HTMLElement, text: string): string {
    // Use full text for ID to avoid collisions between similar subtitles
    return `${element.tagName}-${text}`;
  }

  /**
   * Extract only the original subtitle text, excluding our translation elements
   */
  private getOriginalText(element: HTMLElement): string {
    // Clone the element to avoid modifying the actual DOM
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove all our translation elements from the clone
    const translationElements = clone.querySelectorAll('.nrk-oversetter-translation');
    translationElements.forEach(el => el.remove());

    // Get the text from the clone (which now only has original subtitle text)
    return clone.textContent?.trim() || '';
  }

  /**
   * Honour the showOriginal setting by hiding or restoring NRK's own subtitle.
   *
   * Only called once a translation is ready, so a failed translation never leaves
   * the viewer with no subtitle at all.
   */
  private applyOriginalVisibility(element: HTMLElement): void {
    if (!this.settings) {
      return;
    }

    if (this.settings.showOriginal) {
      restoreAllHiddenOriginals();
      return;
    }

    if (!element.hasAttribute(HIDDEN_ORIGINAL_ATTR)) {
      element.setAttribute(HIDDEN_ORIGINAL_ATTR, element.style.display);
      element.style.display = 'none';
    }
  }

  /**
   * Work out the translation font size.
   *
   * In 'relative' mode we measure NRK's own subtitle size and scale from it. NRK
   * computes that size from viewport units, so it changes with window size and
   * fullscreen - measuring on every injection keeps our text in proportion instead
   * of drifting against a frozen pixel value.
   */
  private resolveFontSize(subtitleElement: HTMLElement): string {
    if (!this.settings) {
      return '16px';
    }

    if (this.settings.fontSizeMode === 'absolute') {
      return `${this.settings.fontSize}px`;
    }

    const nrkSize = parseFloat(window.getComputedStyle(subtitleElement).fontSize);
    if (!Number.isFinite(nrkSize) || nrkSize <= 0) {
      // Could not measure - fall back to the fixed value rather than guessing
      return `${this.settings.fontSize}px`;
    }

    return `${(nrkSize * this.settings.fontSizeScale).toFixed(2)}px`;
  }

  private addTranslation(element: HTMLElement, original: string, translation: string): void {
    if (!this.settings) return;

    // Look for existing translation element as a sibling
    let translationElement: HTMLElement | null = null;

    if (this.settings.position === 'below' && element.nextElementSibling) {
      if (element.nextElementSibling.classList.contains('nrk-oversetter-translation')) {
        translationElement = element.nextElementSibling as HTMLElement;
      }
    } else if (this.settings.position === 'above' && element.previousElementSibling) {
      if (element.previousElementSibling.classList.contains('nrk-oversetter-translation')) {
        translationElement = element.previousElementSibling as HTMLElement;
      }
    }

    if (!translationElement) {
      translationElement = document.createElement('div');
      translationElement.className = 'nrk-oversetter-translation';
      translationElement.style.cssText = `
        display: block;
        color: #FFD700;
        margin-top: 4px;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      `;

      // Insert as sibling instead of child to avoid modifying subtitle element's DOM
      if (this.settings.position === 'below') {
        element.parentElement?.insertBefore(translationElement, element.nextSibling);
      } else if (this.settings.position === 'above') {
        element.parentElement?.insertBefore(translationElement, element);
      }
    }

    // Re-measured each time so the size tracks fullscreen and window resizes
    translationElement.style.fontSize = this.resolveFontSize(element);
    translationElement.textContent = translation;

    this.applyOriginalVisibility(element);
  }

  dispose(): void {
    this.disposed = true;
    this.removeGestureListener();

    // Remove any translations we injected. Without this, every settings change
    // (which tears down and rebuilds the processor) leaves the previous
    // translation on screen - and switching position stacks a second one.
    document
      .querySelectorAll('.nrk-oversetter-translation')
      .forEach((el) => el.remove());

    // Put NRK's own subtitles back if showOriginal had hidden them
    restoreAllHiddenOriginals();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pollingInterval !== null) {
      window.clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.processedSubtitles.clear();
    this.subtitleContainer = null;
    this.lastSubtitleText = '';
    Logger.info('SubtitleProcessor disposed');
  }
}
