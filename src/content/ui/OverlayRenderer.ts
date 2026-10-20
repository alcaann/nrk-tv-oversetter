import { ExtensionSettings } from '../../core/interfaces/IStorageService.js';
import { shieldFromPlayer } from './shieldFromPlayer.js';

/** A status line drawn in the translation's place, optionally with a button */
export interface OverlayNotice {
  action?: { label: string; run: () => void };
}

/** Kept from the original renderer so the options page and harness still recognise it */
const OVERLAY_CLASS = 'nrk-oversetter-translation';
const NRK_SUBTITLES = 'tv-player-subtitles';
const NRK_LINE = '.tv-player-subtitle-text';
/** Set on NRK's subtitle layer while the controls are showing; it then moves up */
const NRK_DISPLACED = 'displace-subtitles';
/** NRK's own distance for that move, which follows the player size */
const NRK_CONTROLS_HEIGHT = '--active-controls-height';
/** Our copy of that distance, added to our own bottom offset */
const DISPLACE_VAR = '--nrk-ov-displace';
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
 *
 * When the controls show, NRK moves its subtitle layer up to make room; we watch
 * for that and move with it, by the same distance.
 */
export class OverlayRenderer {
  private element: HTMLDivElement | null = null;
  private lifted: HTMLElement | null = null;
  private lines: string[] = [];
  private notice: OverlayNotice | null = null;
  private watchedLayer: HTMLElement | null = null;
  private layerObserver = new MutationObserver(() => this.followControls());

  constructor(private settings: ExtensionSettings) {}

  updateSettings(settings: ExtensionSettings): void {
    this.settings = settings;
    this.render();
  }

  /**
   * The translations of whatever is on screen right now; empty during a gap.
   * `notice` marks a status line (e.g. the model is still downloading) rather
   * than a translation; it is drawn more quietly and may carry a button.
   */
  show(lines: string[], notice: OverlayNotice | null = null): void {
    this.lines = lines;
    this.notice = notice;
    this.render();
  }

  dispose(): void {
    this.element?.remove();
    this.element = null;
    this.unlift();
    this.layerObserver.disconnect();
    this.watchedLayer = null;
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
    element.classList.toggle('is-notice', this.notice !== null);
    const action = this.notice?.action;
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.addEventListener('click', action.run);
      element.appendChild(button);
    }
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
    shieldFromPlayer(element);
    player.appendChild(element);
    this.element = element;
    return element;
  }

  private position(player: HTMLElement, element: HTMLDivElement): void {
    const nativeLayer = player.querySelector(NRK_SUBTITLES) as HTMLElement | null;
    const nativeVisible = this.settings.showOriginal && nativeLayer && !document.documentElement.classList.contains('nrk-ov-hide-native');

    this.watchLayer(nativeLayer);
    this.followControls();
    element.style.top = '';
    element.style.bottom = withDisplacement(BOTTOM_MARGIN);

    if (!nativeVisible || !nativeLayer) {
      this.unlift();
      return;
    }

    if (this.settings.position === 'above') {
      this.unlift();
      const line = nativeLayer.querySelector(NRK_LINE);
      if (line) {
        // Measured from NRK's layer, which carries its own displacement
        const layerRect = nativeLayer.getBoundingClientRect();
        const lineRect = line.getBoundingClientRect();
        element.style.bottom = withDisplacement(`${layerRect.bottom - lineRect.top + GAP_PX}px`);
      }
      return;
    }

    // Below: we take the bottom slot and push NRK's line up by our height
    this.lifted = nativeLayer;
    nativeLayer.style.transform = `translateY(-${element.offsetHeight + GAP_PX}px)`;
  }

  /** NRK can replace its subtitle layer, e.g. on a new episode */
  private watchLayer(layer: HTMLElement | null): void {
    if (layer === this.watchedLayer) {
      return;
    }
    this.layerObserver.disconnect();
    this.watchedLayer = layer;
    if (layer) {
      this.layerObserver.observe(layer, { attributes: true, attributeFilter: ['class'] });
    }
  }

  private followControls(): void {
    const layer = this.watchedLayer;
    if (!this.element || !layer) {
      return;
    }
    const distance = layer.classList.contains(NRK_DISPLACED)
      ? window.getComputedStyle(layer).getPropertyValue(NRK_CONTROLS_HEIGHT).trim()
      : '';
    this.element.style.setProperty(DISPLACE_VAR, distance || '0px');
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

function withDisplacement(offset: string): string {
  return `calc(${offset} + var(${DISPLACE_VAR}, 0px))`;
}

/** Show or hide NRK's own subtitle rendering. Captions keep flowing either way. */
export function setNativeSubtitlesHidden(hidden: boolean): void {
  document.documentElement.classList.toggle('nrk-ov-hide-native', hidden);
}
