import { Logger } from '../utils/Logger.js';
import { getLanguageName, getSupportedLanguages } from '../core/languages.js';
import { ModelStatusEntry, onLocalModelStatus, pairKey } from '../core/modelStatus.js';
import { StorageService } from '../utils/StorageService.js';
import { ExtensionSettings } from '../core/interfaces/IStorageService.js';
import { TranslationEngineFactory } from '../core/translation/TranslationEngineFactory.js';
import { CaptionTracker } from './captions/CaptionTracker.js';
import { Caption } from './captions/types.js';
import { TranslationQueue } from './translation/TranslationQueue.js';
import { TranslationStatus, describeStatus, pendingText } from './translation/TranslationStatus.js';
import { HistoryPanel } from './ui/HistoryPanel.js';
import { OverlayRenderer, setNativeSubtitlesHidden } from './ui/OverlayRenderer.js';
import { NrkMenuIntegration } from './ui/NrkMenuIntegration.js';
import { currentMode, settingsForMode } from '../core/modes.js';

/**
 * Content script entry point.
 *
 *   CaptionTracker  ->  what is said, and when (from NRK's subtitle track)
 *   TranslationQueue -> translations, worked out ahead of the playhead
 *   HistoryPanel / OverlayRenderer -> what the viewer sees
 *
 * Settings are applied in place. Tearing everything down on each change would
 * throw away the caption history, and the panel itself writes settings.
 */

Logger.info('NRK TV Oversetter content script loaded');

const storage = new StorageService();

class Controller {
  private settings: ExtensionSettings;
  private tracker = new CaptionTracker();
  private queue: TranslationQueue;
  private panel: HistoryPanel;
  private overlay: OverlayRenderer;
  private video: HTMLVideoElement | null = null;
  private forced = false;
  private engineGeneration = 0;
  /** Latest model status for the current language pair, reported by the engine */
  private modelStatus: ModelStatusEntry | null = null;
  private stopModelStatus: () => void;

  private readonly onTime = () => this.tick();

  constructor(settings: ExtensionSettings) {
    this.settings = settings;
    this.queue = new TranslationQueue(
      () => this.video?.currentTime ?? 0,
      (caption, translation) => this.onTranslated(caption, translation),
      () => this.onTranslationStateChange()
    );
    this.overlay = new OverlayRenderer(settings);
    this.panel = new HistoryPanel(settings, {
      onSeek: (time) => {
        if (this.video) {
          this.video.currentTime = time;
        }
      },
      onSettingsChange: (changes) => {
        storage.update(changes);
      },
      onDownloadRequest: () => this.queue.downloadNow(),
    });

    this.stopModelStatus = onLocalModelStatus((key, entry) => {
      if (key === pairKey(this.settings.sourceLanguage, this.settings.targetLanguage)) {
        this.modelStatus = entry;
        this.onTranslationStateChange();
      }
    });

    this.tracker.subscribe({
      onReset: (video) => this.onReset(video),
      onCaptions: (added) => {
        this.panel.addCaptions(added, this.tracker.captions);
        this.queue.request(added);
      },
      onActive: (active) => {
        this.panel.setActive(active);
        this.renderOverlay();
      },
      onForcedChange: (forced) => {
        this.forced = forced;
        this.applyNativeVisibility();
      },
    });
  }

  async start(): Promise<void> {
    this.panel.mount();
    this.applyNativeVisibility();
    await this.configureEngine();
    this.tracker.start();
  }

  dispose(): void {
    this.engineGeneration++;
    this.stopModelStatus();
    this.tracker.stop();
    this.queue.dispose();
    this.panel.dispose();
    this.overlay.dispose();
    this.video?.removeEventListener('timeupdate', this.onTime);
    this.video?.removeEventListener('seeked', this.onTime);
    setNativeSubtitlesHidden(false);
  }

  async updateSettings(settings: ExtensionSettings): Promise<void> {
    const previous = this.settings;
    this.settings = settings;
    this.panel.updateSettings(settings);
    this.overlay.updateSettings(settings);
    this.applyNativeVisibility();

    const pairChanged =
      previous.translationEngine !== settings.translationEngine ||
      previous.sourceLanguage !== settings.sourceLanguage ||
      previous.targetLanguage !== settings.targetLanguage;
    if (pairChanged) {
      this.modelStatus = null;
      await this.configureEngine();
      // Old translations are in the wrong language now
      this.queue.request(this.tracker.captions);
    }
  }

  private async configureEngine(): Promise<void> {
    const generation = ++this.engineGeneration;
    try {
      const engine = await TranslationEngineFactory.getEngine(this.settings.translationEngine);
      if (generation === this.engineGeneration) {
        this.queue.configure(engine, this.settings.sourceLanguage, this.settings.targetLanguage);
      }
    } catch (error) {
      Logger.error('Failed to initialize translation engine:', error);
      this.queue.configure(null, this.settings.sourceLanguage, this.settings.targetLanguage);
    }
  }

  private onReset(video: HTMLVideoElement | null): void {
    if (video !== this.video) {
      this.video?.removeEventListener('timeupdate', this.onTime);
      this.video?.removeEventListener('seeked', this.onTime);
      video?.addEventListener('timeupdate', this.onTime);
      video?.addEventListener('seeked', this.onTime);
      this.video = video;
    }
    this.panel.setVideo(video);
    this.panel.reset();
    this.queue.clear();
    this.overlay.show([]);
    this.updateStatus();
  }

  private onTranslated(caption: Caption, translation: string): void {
    this.panel.setTranslation(caption, translation);
    if (this.tracker.activeCaptions.some((c) => c.id === caption.id)) {
      this.renderOverlay();
    }
  }

  private tick(): void {
    if (!this.video) {
      return;
    }
    this.panel.tick(this.video.currentTime);
    this.queue.pump();
    this.updateStatus();
  }

  private renderOverlay(): void {
    const active = this.tracker.activeCaptions;
    const lines = active
      .map((caption) => this.queue.get(caption))
      .filter((text): text is string => Boolean(text));

    // A line is on screen but its translation cannot come yet: say why, instead
    // of leaving the viewer wondering whether the extension is working at all
    const message = describeStatus(this.translationStatus(), getLanguageName(this.settings.targetLanguage));
    if (!lines.length && active.length && message) {
      const hint = message.action ? ' Click anywhere on the page to start it.' : '';
      this.overlay.show([message.text + hint], true);
      return;
    }
    this.overlay.show(lines);
  }

  private onTranslationStateChange(): void {
    this.updateStatus();
    this.renderOverlay();
  }

  private translationStatus(): TranslationStatus {
    switch (this.modelStatus?.state) {
      case 'unavailable':
        return { kind: 'unavailable' };
      case 'stalled':
        return { kind: 'stalled' };
      case 'downloading':
        return { kind: 'downloading', progress: this.modelStatus.progress };
    }
    return this.queue.needsGesture ? { kind: 'needs-click' } : { kind: 'ready' };
  }

  /**
   * NRK's own subtitles show only if the viewer wants them AND had them on in the
   * player. If we switched the track on ourselves, it was off for a reason.
   */
  private applyNativeVisibility(): void {
    setNativeSubtitlesHidden(!this.settings.showOriginal || this.forced);
  }

  private updateStatus(): void {
    this.panel.setStatus(`Source: ${this.tracker.sourceName} · ${this.tracker.captions.length} lines loaded`);
    const status = this.translationStatus();
    this.panel.setTranslationStatus(
      describeStatus(status, getLanguageName(this.settings.targetLanguage)),
      pendingText(status),
      status.kind === 'downloading' ? status.progress ?? 0 : undefined
    );
  }
}

let controller: Controller | null = null;
/** Guards against overlapping starts when settings change quickly */
let generation = 0;

/** Runs even while the extension is off, so it can be switched back on from the player */
const menu = new NrkMenuIntegration((choice) => storage.update(settingsForMode(choice)));
menu.start();

async function applySettings(): Promise<void> {
  const current = ++generation;
  const settings = await storage.getAll();
  if (current !== generation) {
    return;
  }
  menu.setCurrent(currentMode(settings));

  if (!settings.enabled) {
    controller?.dispose();
    controller = null;
    Logger.info('Extension is disabled');
    return;
  }

  if (controller) {
    await controller.updateSettings(settings);
    return;
  }

  controller = new Controller(settings);
  await controller.start();
  warmLanguageCache(settings);
}

/**
 * Populate the supported-language cache from here.
 *
 * The popup and options page usually manage this themselves, but the Translator API
 * is only guaranteed to be reachable from a page context like this one. Probing here
 * means the language list is correct even if those pages cannot probe directly.
 * Cheap after the first run - getSupportedLanguages() returns early from cache.
 */
function warmLanguageCache(settings: ExtensionSettings): void {
  getSupportedLanguages(settings.sourceLanguage)
    .then((languages) => {
      Logger.info(`Language cache ready: ${languages.length} target languages available`);
    })
    .catch((error) => {
      Logger.warn('Could not build language cache:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applySettings());
} else {
  applySettings();
}

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'sync') {
    applySettings();
  }
});

window.addEventListener('beforeunload', () => controller?.dispose());
