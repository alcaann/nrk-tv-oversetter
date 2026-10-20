# Changelog

## 0.3.0

### New

- **Learning panel**: every Norwegian line so far, beside the video. Translations stay hidden until you hover a line; the video pauses while the pointer is in the panel and resumes when it leaves. Click a line's time to replay it.
- **Two modes**, dual subtitles (the previous behaviour, still the default for existing users) and learning panel, chosen in one click.
- **Modes in NRK's own subtitle menu**, under "Oversetter", so they can be changed in fullscreen.
- **First-run setup on the player**: new installs start switched off and ask how you want the subtitles. Picking a mode also starts the model download.
- **Redesigned popup and settings page**. Settings save as you change them.

### Improved

- Subtitles are read from NRK's subtitle track instead of being scraped from the page. Translations are ready when the line is spoken (previously 0.25 to 0.75 s late), the previous line's translation no longer flashes after a seek, and the extension works with NRK's subtitles hidden or switched off.
- The model download explains itself: progress, a **Download now** button where a click is needed, and **Retry** with the browser's own error message if it fails.
- A download with no progress for 90 seconds is abandoned and can be retried, instead of blocking every translation.
- NRK's "Valgt undertekst" notice is no longer translated as dialogue.

### Fixed

- A single click could start two model downloads; the second one failing tore down the first, so the download appeared to restart at 100%.
- Settings changes no longer rebuild everything, and the options page no longer overwrites settings it does not show.

### Removed

- The translation engine selector (there is only the built-in engine).
- The live subtitle log on the settings page; the learning panel replaces it.

### Known issues

- Microsoft Edge on Linux: Edge's built-in translator does not work ([MSEdgeExplainers#1424](https://github.com/MicrosoftEdge/MSEdgeExplainers/issues/1424)). Use Chrome. Edge on Windows and macOS is untested.

## 0.2.0

- Language list read from the browser, automatic model downloads with progress in the popup, lifecycle fixes.
