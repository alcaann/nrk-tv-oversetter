/**
 * One subtitle line, as NRK delivers it.
 *
 * Times are in seconds on the video's own timeline, so a caption can be placed in
 * history, highlighted while active, and used as a seek target.
 */
export interface Caption {
  /** Stable for the lifetime of the program: start time plus text */
  id: string;
  start: number;
  end: number;
  /** Plain text with markup removed; line breaks preserved */
  text: string;
}

/**
 * Where captions come from. A source only reports what it sees; the tracker decides
 * which source to trust and keeps the timeline.
 */
export interface CaptionSourceListener {
  /** Captions newly known to the source - may be ahead of the playhead */
  onCaptions(captions: Caption[]): void;
  /** The captions active right now (usually zero or one) */
  onActive(captions: Caption[]): void;
}

export interface CaptionSource {
  readonly name: string;
  start(listener: CaptionSourceListener): void;
  stop(): void;
}

/** NRK announces subtitle changes as a cue on the track itself. Not dialogue. */
const PLAYER_NOTICE = /^Valgt undertekst:/i;

export function cleanCaptionText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function isDialogue(text: string): boolean {
  return text.length > 0 && !PLAYER_NOTICE.test(text);
}

export function captionId(start: number, text: string): string {
  return `${start.toFixed(2)}|${text}`;
}
