import { Caption, CaptionSource, CaptionSourceListener, captionId, cleanCaptionText, isDialogue } from './types.js';

const POLL_MS = 250;

/**
 * Selectors for NRK's rendered subtitle line, most specific first. Only used when
 * the video has no readable TextTrack - update these if NRK renames the element.
 */
const SUBTITLE_SELECTORS = ['.tv-player-subtitle-text', 'tv-player-subtitles span', 'span[class*="subtitle"]'];

/**
 * Fallback source: watch the subtitle text NRK paints and stamp it with the
 * video's current time. Timings are approximate (start when first seen, end when
 * it disappears) and nothing is known ahead of the playhead, but it keeps the
 * panel working if NRK ever stops using a native track.
 *
 * Plain polling: NRK's Lit renderer swaps the element between lines, so an
 * observer on one element goes stale, and a 250 ms poll is cheap.
 */
export class DomSource implements CaptionSource {
  readonly name = 'dom';

  private timer: number | null = null;
  private current: Caption | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  start(listener: CaptionSourceListener): void {
    this.timer = window.setInterval(() => {
      const text = this.readText();
      if (this.current && this.current.text === text) {
        this.current.end = Math.max(this.current.end, this.video.currentTime);
        return;
      }
      if (this.current) {
        this.current.end = this.video.currentTime;
        this.current = null;
      }
      if (isDialogue(text)) {
        const start = this.video.currentTime;
        this.current = { id: captionId(start, text), start, end: start, text };
        listener.onCaptions([this.current]);
        listener.onActive([this.current]);
      } else {
        listener.onActive([]);
      }
    }, POLL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.current = null;
  }

  private readText(): string {
    for (const selector of SUBTITLE_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        return cleanCaptionText(element.textContent || '');
      }
    }
    return '';
  }
}
