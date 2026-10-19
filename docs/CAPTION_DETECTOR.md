# Caption Capture

## What NRK actually does

NRK's player loads subtitles into a **native `TextTrack`** on the `<video>`
(kind `subtitles`, language `no`, mode `hidden`) from segmented WebVTT, then
paints the active cue itself into `<tv-player-subtitles>` →
`span.tv-player-subtitle-text` (a Lit template).

Consequences:

- Cues are available **with exact timings**, and well ahead of the playhead
  (often 100+ lines at the start of an episode).
- Hiding NRK's rendering does not stop the cues: `visibility: hidden` on
  `tv-player-subtitles` is enough.
- When the viewer picks **Av** (off) in NRK's menu, every track becomes
  `disabled` and nothing loads. Setting the Norwegian track back to `hidden`
  makes the player fetch it again, even across seeks.
- NRK remembers the menu choice in `localStorage["nrk-tv-preferred-subtitle"]`
  (`"none"` or a track label).
- NRK inserts a cue `Valgt undertekst: Norsk` when subtitles are switched on.
  It is a UI notice, not dialogue, and is filtered out.
- The playback manifest
  (`psapi.nrk.no/playback/manifest/program/<id>` → `playable.subtitles[].webVtt`)
  also links the complete VTT file, CORS-open to tv.nrk.no. Not used yet; it is
  the option if a whole-episode transcript is ever wanted up front.

## Sources

Implemented in [src/content/captions/](../src/content/captions/):

| Source | When | Notes |
| --- | --- | --- |
| `TextTrackSource` | The video has a subtitle track (normal case) | Follows the track NRK uses; if none is enabled, forces the Norwegian one (not the audio-described one) to `hidden` and reports `forced` |
| `DomSource` | No subtitle track after 8 s | Polls the rendered line every 250 ms; approximate timings, nothing ahead of the playhead |

`CaptionTracker` re-finds the `<video>` every second (tv.nrk.no is a single-page
app), resets on a new program (`loadstart` with a new `currentSrc`), picks the
source, and keeps the ordered timeline that the panel and translation queue
subscribe to.

## If NRK changes their player

1. Run `npm run harness:scenarios` ([tools/harness/](../tools/harness/README.md)).
   The footer of the panel shows which source is active.
2. If the source fell back to `dom`, NRK stopped using a native track: inspect
   `video.textTracks` in the console.
3. If `dom` finds nothing either, update `SUBTITLE_SELECTORS` in
   [DomSource.ts](../src/content/captions/DomSource.ts).
4. If NRK's subtitles show through while hidden, update the `tv-player-subtitles`
   selector in [subtitle-styles.css](../src/content/subtitle-styles.css).

## Issues found in the previous DOM-scraping detector

The harness ran the old `SubtitleProcessor` through the same scenarios. It was
more robust than expected (no lingering or duplicated translations), but:

- It relied on NRK's subtitles being **switched on and visible**; with them
  off it captured nothing, so "hide the Norwegian, keep the captions" was
  impossible.
- Translation started only when a line appeared, adding 0.25–0.75 s of lag per
  line. The track-based pipeline translates ahead, so the measured latency is 0.
- A seek could briefly show the previous line's translation.
- The translation element was inserted inside NRK's Lit template, which can
  re-render over foreign nodes.
- The first line could be lost while the session was still being created (it
  was marked processed before translation failed with `AWAITING_USER_GESTURE`).
- NRK's `Valgt undertekst: Norsk` notice was translated as if it were dialogue.
- Every settings change tore the processor down and rebuilt it, which would
  wipe any history.
