# NRK TV Oversetter

Watch [NRK TV](https://tv.nrk.no) in Norwegian, with the translation one glance away. Translation runs on your own computer, using the model built into your browser: nothing you watch leaves your device.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/nrk-tv-oversetter/hlnikafacjiekphhloakkbhokhfkpcem)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Choosing a mode on the NRK player, switching from NRK's subtitle menu, and hovering lines in the learning panel](docs/tutorial/tutorial.gif)

*[Watch on YouTube](https://www.youtube.com/watch?v=ma1ASG3NGM8)*

## Two ways to watch

- **Dual subtitles**: the translation sits under NRK's Norwegian subtitle, on the video. Works in fullscreen.
- **Learning panel**: every Norwegian line so far, beside the video. Hover a line to reveal its translation; the video pauses while you read and plays on when you move away.

## Getting started

1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/nrk-tv-oversetter/hlnikafacjiekphhloakkbhokhfkpcem).
2. Open any program on tv.nrk.no and pick a mode on the card that appears. This also downloads the translation model, once.
3. Change mode any time from NRK's own subtitle menu (under **Oversetter**) or the toolbar icon.

Lines are translated ahead of time, so the translation appears together with the Norwegian, even with NRK's subtitles hidden or switched off. Any language your browser can translate into is available (around 40 in Chrome), and it works offline once the model is downloaded.

## Browser support

Works in **Google Chrome** on desktop. **Microsoft Edge** on Linux does not work at the moment because of a bug in Edge's built-in translator ([MSEdgeExplainers#1424](https://github.com/MicrosoftEdge/MSEdgeExplainers/issues/1424)); Edge on Windows and macOS is untested.

## Troubleshooting

- **No translation?** Click **Download now** if the player or panel shows it (the browser only downloads a model after a click), or reload the tab after installing or updating.
- **"The browser could not load the model"** or a stuck download: click **Retry**, or restart the browser. On Edge for Linux, use Chrome (see above).
- **Panel empty, or a language missing?** [Open an issue](https://github.com/alcaann/nrk-tv-oversetter/issues/new/choose) with a link to the program. The language list comes from your browser.

## Privacy

No subtitle text, browsing history or personal data is sent anywhere. See [PRIVACY.md](PRIVACY.md). This extension is not affiliated with NRK.

## Development

```bash
npm install
npm run build      # then chrome://extensions → Developer mode → Load unpacked → repo root
npm run package    # store zip in release/
```

The extension reads NRK's subtitle track directly from the video, translates ahead of the playhead with the browser's [Translator API](https://developer.chrome.com/docs/ai/translator-api), and draws the result on the video or in the panel. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), the [test harness](tools/harness/README.md) that checks it against live tv.nrk.no, [CONTRIBUTING.md](CONTRIBUTING.md) and the [CHANGELOG](CHANGELOG.md).

## License

[MIT](LICENSE)
