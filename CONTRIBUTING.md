# Contributing

Thanks for taking a look. This is a small, single-maintainer project, so anything from a typo fix to a new translation engine is welcome.

## Reporting bugs and requesting languages

[Open an issue](https://github.com/alcaann/nrk-tv-oversetter/issues/new/choose). Please include:

- Your browser and version (`chrome://version` or `edge://settings/help`)
- The target language you selected
- Anything in the browser console (F12) that looks relevant

If a language you need is missing from the dropdown, say so in an issue. The list is currently hardcoded and shorter than what the browser actually supports — see the roadmap in the [README](README.md#roadmap).

## Setting up

```bash
git clone https://github.com/alcaann/nrk-tv-oversetter.git
cd nrk-tv-oversetter
npm install
npm run build
```

Load the unpacked extension:

1. Go to `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the repository root

`npm run watch` recompiles TypeScript as you edit. You still need `npm run copy-assets` and `npm run bundle-content` (or a full `npm run build`) after changing HTML, CSS, or the content script, then hit **Reload** on the extensions page.

## Testing a change

`npm run harness:scenarios` drives real Chrome with the extension against live tv.nrk.no and checks captions, translations and the panel against the video's subtitle track; see [tools/harness/README.md](tools/harness/README.md). Beyond that, verify by hand:

1. Open a video on [tv.nrk.no](https://tv.nrk.no) with Norwegian subtitles turned on
2. Confirm translations appear below the original subtitles
3. Switch to the learning panel: its footer shows the caption source and how many lines were loaded, and its banner shows the model download state, which is the fastest way to see whether capture or translation is the thing that broke

Please test on both Chrome and Edge 148+ if you can. The two browsers differ in ways that matter: Edge supports far more languages, and Chrome requires a user gesture before the model download can start.

## Pull requests

1. Fork the repository and branch off `main`
2. Make your change
3. Run `npm run build` and confirm it compiles cleanly
4. Test manually as described above
5. Open a pull request describing what you changed and how you verified it

Small, focused pull requests are easier to review than large ones. If you are planning something substantial, open an issue first so we can agree on the approach before you spend time on it.

## Project layout

| Path | Responsibility |
| --- | --- |
| [src/content/captions/](src/content/captions/) | Caption capture (subtitle track, DOM fallback) |
| [src/content/translation/](src/content/translation/) | Translation queue |
| [src/content/ui/](src/content/ui/) | History panel and on-video translation |
| [src/content/subtitle-injector.ts](src/content/subtitle-injector.ts) | Content script entry point and message handling |
| [src/core/translation/](src/core/translation/) | Translation engines behind a factory |
| [src/core/interfaces/](src/core/interfaces/) | Interfaces — implement these to extend the extension |
| [src/ui/](src/ui/) | Popup and options pages |
| [src/utils/](src/utils/) | Storage wrapper and logging |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the fuller picture.

## Two things worth knowing

**NRK controls the page.** Captions are read from the video's subtitle track rather than scraped, which survives markup changes, but a player rewrite can still break capture or the hiding of NRK's own subtitles. `npm run harness:scenarios` shows which. [docs/CAPTION_DETECTOR.md](docs/CAPTION_DETECTOR.md) explains how detection works.

**Translation is on-device and stays that way.** The extension uses the browser's built-in Translator API specifically so that nothing a user watches is sent anywhere. Please do not add a cloud translation provider as a default. An opt-in, clearly-disclosed fallback is a reasonable discussion to have in an issue first — a silent one is not.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
