import { ExtensionSettings } from '../../core/interfaces/IStorageService.js';

/** Kept from the original renderer so the options page and harness still recognise it */
const OVERLAY_CLASS = 'nrk-oversetter-translation';
const NRK_SUBTITLES = 'tv-player-subtitles';
const NRK_LINE = '.tv-player-subtitle-text';
/** NRK anchors its line at 95% of the player height */
const BOTTOM_MARGIN = '5%';
const GAP_PX = 4;

/**
 * Draws the translated line on the video.
 *
 * Lives as our own child of <tv-player>, positioned absolutely, rather than being
 * slipped into NRK's subtitle markup: that markup is a Lit template, which can
 * re-render over foreign nodes. To sit "below" NRK's line we take its place at the
 * bottom and lift NRK's subtitle layer by our height with a transform on its host.
 */
export class OverlayRenderer {
  private element: HTMLDivElement | null = null;
  private lifted: HTMLElement | null = null;
  private lines: string[] = [];

  constructor(private settings: ExtensionSettings) {}

  updateSettings(settings: ExtensionSettings): void {
    this.settings = settings;
    this.render();
  }

  /** The translations of whatever is on screen right now; empty during a gap */
  show(lines: string[]): void {
    this.lines = lines;
    this.render();
  }

  dispose(): void {
    this.element?.remove();
    this.element = null;
    this.unlift();
  }

  private render(): void {
    const text = this.lines.join('\n');
    if (!this.settings.showTranslation || !text) {
      if (this.element) {
        this.element.style.display = 'none';
      }
      this.unlift();
      return;
    }

    const player = document.querySelector('tv-player') as HTMLElement | null;
    if (!player) {
      return;
    }
    const element = this.ensureElement(player);
    element.textContent = text;
    element.style.display = 'block';
    element.style.fontSize = this.resolveFontSize(player);
    this.position(player, element);
  }

  private ensureElement(player: HTMLElement): HTMLDivElement {
    if (this.element && this.element.parentElement === player) {
      return this.element;
    }
    this.element?.remove();
    const element = document.createElement('div');
    element.className = OVERLAY_CLASS;
    player.appendChild(element);
    this.element = element;
    return element;
  }

  private position(player: HTMLElement, element: HTMLDivElement): void {
    const nativeLayer = player.querySelector(NRK_SUBTITLES) as HTMLElement | null;
    const nativeVisible = this.settings.showOriginal && nativeLayer && !document.documentElement.classList.contains('nrk-ov-hide-native');

    element.style.top = '';
    element.style.bottom = BOTTOM_MARGIN;

    if (!nativeVisible || !nativeLayer) {
      this.unlift();
      return;
    }

    if (this.settings.position === 'above') {
      this.unlift();
      const line = nativeLayer.querySelector(NRK_LINE);
      if (line) {
        const playerRect = player.getBoundingClientRect();
        const lineRect = line.getBoundingClientRect();
        element.style.bottom = `${playerRect.bottom - lineRect.top + GAP_PX}px`;
      }
      return;
    }

    // Below: we take the bottom slot and push NRK's line up by our height
    this.lifted = nativeLayer;
    nativeLayer.style.transform = `translateY(-${element.offsetHeight + GAP_PX}px)`;
  }

  private unlift(): void {
    if (this.lifted) {
      this.lifted.style.transform = '';
      this.lifted = null;
    }
  }

  /**
   * In 'relative' mode, scale from NRK's own subtitle size, which follows the
   * viewport and fullscreen. Measured on every render so it never goes stale.
   */
  private resolveFontSize(player: HTMLElement): string {
    if (this.settings.fontSizeMode === 'absolute') {
      return `${this.settings.fontSize}px`;
    }
    const reference = player.querySelector(NRK_SUBTITLES) || player;
    const nrkSize = parseFloat(window.getComputedStyle(reference).fontSize);
    if (!Number.isFinite(nrkSize) || nrkSize <= 0) {
      return `${this.settings.fontSize}px`;
    }
    return `${(nrkSize * this.settings.fontSizeScale).toFixed(2)}px`;
  }
}

/** Show or hide NRK's own subtitle rendering. Captions keep flowing either way. */
export function setNativeSubtitlesHidden(hidden: boolean): void {
  document.documentElement.classList.toggle('nrk-ov-hide-native', hidden);
}
