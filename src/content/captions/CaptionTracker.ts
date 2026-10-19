import { Caption, CaptionSource } from './types.js';
import { TextTrackSource } from './TextTrackSource.js';
import { DomSource } from './DomSource.js';
import { Logger } from '../../utils/Logger.js';

/** How often to check whether the player's <video> was added, removed or replaced */
const WATCH_MS = 1000;
/** How long a video may go without subtitle tracks before we fall back to the DOM */
const TRACK_GRACE_MS = 8000;

export interface CaptionTrackerListener {
  /** A different program (or no program) is now playing; drop what you hold */
  onReset(video: HTMLVideoElement | null): void;
  onCaptions(added: Caption[]): void;
  onActive(active: Caption[]): void;
  /** We switched NRK's subtitles on behind the viewer's back (they had them off) */
  onForcedChange(forced: boolean): void;
}

/**
 * Single owner of "what is being said in this program, and when".
 *
 * Finds the player's video (tv.nrk.no is a single-page app, so it comes and goes
 * without page loads), picks the best caption source for it, and keeps an ordered
 * timeline of every caption seen. Consumers subscribe instead of each scraping the
 * page themselves.
 */
export class CaptionTracker {
  private video: HTMLVideoElement | null = null;
  private source: CaptionSource | null = null;
  private videoSince = 0;
  private programSrc = '';
  private watchTimer: number | null = null;
  private byId = new Map<string, Caption>();
  /** Sorted by start time */
  private timeline: Caption[] = [];
  private active: Caption[] = [];
  private listeners: CaptionTrackerListener[] = [];

  private readonly onLoadStart = () => this.checkProgram();

  subscribe(listener: CaptionTrackerListener): void {
    this.listeners.push(listener);
  }

  get currentVideo(): HTMLVideoElement | null {
    return this.video;
  }

  get captions(): readonly Caption[] {
    return this.timeline;
  }

  get activeCaptions(): readonly Caption[] {
    return this.active;
  }

  get sourceName(): string {
    return this.source?.name ?? 'none';
  }

  start(): void {
    this.watch();
    this.watchTimer = window.setInterval(() => this.watch(), WATCH_MS);
  }

  stop(): void {
    if (this.watchTimer !== null) {
      window.clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    this.attach(null);
  }

  private findVideo(): HTMLVideoElement | null {
    return (document.querySelector('tv-player video') as HTMLVideoElement) || document.querySelector('video');
  }

  private watch(): void {
    const video = this.findVideo();
    if (video !== this.video) {
      this.attach(video);
      return;
    }
    if (!video) {
      return;
    }

    // Upgrade to the track as soon as the player adds one; fall back to the DOM
    // only once it clearly is not going to add one
    const hasTracks = TextTrackSource.hasSubtitleTracks(video);
    if (hasTracks && !(this.source instanceof TextTrackSource)) {
      this.useSource(new TextTrackSource(video, (forced) => this.emit((l) => l.onForcedChange(forced))));
    } else if (!hasTracks && !this.source && Date.now() - this.videoSince > TRACK_GRACE_MS) {
      Logger.warn('No subtitle track on the video; reading subtitles from the page instead');
      this.useSource(new DomSource(video));
    }
  }

  private attach(video: HTMLVideoElement | null): void {
    this.useSource(null);
    this.video?.removeEventListener('loadstart', this.onLoadStart);
    this.video = video;
    this.videoSince = Date.now();
    this.programSrc = video?.currentSrc ?? '';
    this.reset();
    if (video) {
      Logger.info('Video found, waiting for captions');
      video.addEventListener('loadstart', this.onLoadStart);
      this.watch();
    }
  }

  /** NRK reuses the <video> between episodes; a new source URL means a new program */
  private checkProgram(): void {
    if (!this.video || this.video.currentSrc === this.programSrc) {
      return;
    }
    Logger.info('New program loaded in the player');
    this.programSrc = this.video.currentSrc;
    this.videoSince = Date.now();
    this.useSource(null);
    this.reset();
    this.watch();
  }

  private useSource(source: CaptionSource | null): void {
    if (this.source) {
      this.source.stop();
    }
    this.source = source;
    if (!source) {
      return;
    }
    Logger.info(`Caption source: ${source.name}`);
    source.start({
      onCaptions: (captions) => this.add(captions),
      onActive: (active) => {
        this.active = active.map((c) => this.byId.get(c.id) || c);
        this.emit((l) => l.onActive(this.active));
      },
    });
  }

  private reset(): void {
    this.byId.clear();
    this.timeline = [];
    this.active = [];
    this.emit((l) => l.onReset(this.video));
  }

  private add(captions: Caption[]): void {
    const added: Caption[] = [];
    for (const caption of captions) {
      if (!this.byId.has(caption.id)) {
        this.byId.set(caption.id, caption);
        added.push(caption);
      }
    }
    if (!added.length) {
      return;
    }
    this.timeline.push(...added);
    this.timeline.sort((a, b) => a.start - b.start);
    this.emit((l) => l.onCaptions(added));
  }

  private emit(fn: (listener: CaptionTrackerListener) => void): void {
    for (const listener of this.listeners) {
      try {
        fn(listener);
      } catch (error) {
        Logger.error('Caption listener failed:', error);
      }
    }
  }
}
