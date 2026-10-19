import { Caption, CaptionSource, CaptionSourceListener, captionId, cleanCaptionText, isDialogue } from './types.js';
import { Logger } from '../../utils/Logger.js';

/** How often to look for cues the player has loaded ahead of the playhead */
const CUE_SCAN_MS = 1000;
/** Minimum gap between attempts to re-enable a track NRK keeps switching off */
const FORCE_RETRY_MS = 2000;

const SUBTITLE_KINDS = ['subtitles', 'captions'];
const PREFERRED_LANGUAGES = ['no', 'nb', 'nn', 'nor', 'nob', 'nno'];
/** "Norsk – med lydbeskrivelser" carries audio descriptions; plain dialogue is better */
const DESCRIBED_LABEL = /lydbeskriv/i;
/** Where NRK remembers the viewer's subtitle menu choice: "none" or a track label */
const NRK_PREFERENCE_KEY = 'nrk-tv-preferred-subtitle';

/** Whether the viewer has subtitles off in NRK's menu; null if we cannot tell */
function nrkSubtitlesOff(): boolean | null {
  try {
    const raw = window.localStorage.getItem(NRK_PREFERENCE_KEY);
    return raw === null ? null : JSON.parse(raw) === 'none';
  } catch {
    return null;
  }
}

/**
 * Reads captions straight from the video's subtitle TextTrack.
 *
 * NRK's player (hls.js underneath) loads the WebVTT segments into a native track
 * with mode 'hidden' and paints the active cue itself. Reading the track gives us
 * exact timings and cues ahead of the playhead, independent of how NRK renders
 * them.
 *
 * When the viewer has subtitles switched off in NRK's menu every track is
 * 'disabled' and nothing loads. We then set the Norwegian track to 'hidden'
 * ourselves, which makes the player fetch it again; `forced` tells the caller so
 * NRK's renderer can be hidden, honouring the viewer's choice on screen.
 */
export class TextTrackSource implements CaptionSource {
  readonly name = 'text-track';

  private listener: CaptionSourceListener | null = null;
  private track: TextTrack | null = null;
  private known = new WeakMap<TextTrackCue, Caption>();
  private scanTimer: number | null = null;
  private lastForceAt = 0;
  private forced = false;

  private readonly onCueChange = () => this.emitActive();
  private readonly onTracksChanged = () => this.selectTrack();

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onForcedChange: (forced: boolean) => void = () => {}
  ) {}

  /** True once the video exposes at least one subtitle track */
  static hasSubtitleTracks(video: HTMLVideoElement): boolean {
    return Array.from(video.textTracks).some((t) => SUBTITLE_KINDS.includes(t.kind));
  }

  start(listener: CaptionSourceListener): void {
    this.listener = listener;
    this.video.textTracks.addEventListener('change', this.onTracksChanged);
    this.video.textTracks.addEventListener('addtrack', this.onTracksChanged);
    this.video.textTracks.addEventListener('removetrack', this.onTracksChanged);
    this.selectTrack();
    this.scanTimer = window.setInterval(() => {
      // NRK may switch the track off again; re-check before scanning
      if (!this.track || this.track.mode === 'disabled') {
        this.selectTrack();
      }
      // Re-selecting the track we forced fires no event, but NRK records it
      if (this.forced && nrkSubtitlesOff() === false) {
        this.setForced(false);
      }
      this.scanCues();
    }, CUE_SCAN_MS);
  }

  stop(): void {
    this.video.textTracks.removeEventListener('change', this.onTracksChanged);
    this.video.textTracks.removeEventListener('addtrack', this.onTracksChanged);
    this.video.textTracks.removeEventListener('removetrack', this.onTracksChanged);
    this.attach(null);
    if (this.scanTimer !== null) {
      window.clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.setForced(false);
    this.listener = null;
  }

  /**
   * Follow whichever track NRK is using; if it is using none, enable the best
   * Norwegian one ourselves.
   */
  private selectTrack(): void {
    const tracks = Array.from(this.video.textTracks).filter((t) => SUBTITLE_KINDS.includes(t.kind));
    if (tracks.length === 0) {
      this.attach(null);
      return;
    }

    const inUse = tracks.find((t) => t.mode !== 'disabled');
    if (inUse) {
      // Switching to a different track means NRK chose it. Re-selecting the one we
      // forced is caught by the preference check in the scan loop.
      if (inUse !== this.track) {
        this.setForced(false);
      }
      this.attach(inUse);
      return;
    }

    if (Date.now() - this.lastForceAt < FORCE_RETRY_MS) {
      return;
    }
    const preferred = this.pickPreferred(tracks);
    this.lastForceAt = Date.now();
    Logger.info(`Subtitles are off in the player; enabling "${preferred.label}" in the background`);
    preferred.mode = 'hidden';
    this.setForced(true);
    this.attach(preferred);
  }

  private pickPreferred(tracks: TextTrack[]): TextTrack {
    const norwegian = tracks.filter((t) => PREFERRED_LANGUAGES.includes(t.language.toLowerCase()));
    const pool = norwegian.length ? norwegian : tracks;
    return pool.find((t) => !DESCRIBED_LABEL.test(t.label)) || pool[0];
  }

  private attach(track: TextTrack | null): void {
    if (track === this.track) {
      return;
    }
    this.track?.removeEventListener('cuechange', this.onCueChange);
    this.track = track;
    if (track) {
      Logger.info(`Reading captions from track "${track.label}" (${track.language})`);
      track.addEventListener('cuechange', this.onCueChange);
      this.scanCues();
      this.emitActive();
    }
  }

  private setForced(forced: boolean): void {
    if (forced !== this.forced) {
      this.forced = forced;
      this.onForcedChange(forced);
    }
  }

  private toCaption(cue: TextTrackCue): Caption | null {
    const cached = this.known.get(cue);
    if (cached) {
      return cached;
    }
    const text = cleanCaptionText((cue as VTTCue).text ?? '');
    if (!isDialogue(text)) {
      return null;
    }
    const caption: Caption = { id: captionId(cue.startTime, text), start: cue.startTime, end: cue.endTime, text };
    this.known.set(cue, caption);
    return caption;
  }

  private scanCues(): void {
    const cues = this.track?.cues;
    if (!cues || !this.listener) {
      return;
    }
    const fresh: Caption[] = [];
    for (let i = 0; i < cues.length; i++) {
      if (!this.known.has(cues[i])) {
        const caption = this.toCaption(cues[i]);
        if (caption) {
          fresh.push(caption);
        }
      }
    }
    if (fresh.length) {
      this.listener.onCaptions(fresh);
    }
  }

  private emitActive(): void {
    if (!this.listener || !this.track) {
      return;
    }
    const active: Caption[] = [];
    const cues = this.track.activeCues;
    for (let i = 0; cues && i < cues.length; i++) {
      const caption = this.toCaption(cues[i]);
      if (caption) {
        active.push(caption);
      }
    }
    // Cues can become active before the periodic scan has seen them
    if (active.length) {
      this.listener.onCaptions(active);
    }
    this.listener.onActive(active);
  }
}
