# Chrome Web Store listing

Paste each section into the corresponding field. Written for **v0.2.0**.

---

## Short description

> Max 132 characters.

```
Translate Norwegian subtitles on NRK TV into your language, in real-time and on your device. Works offline.
```

---

## Detailed description

```
This extension translates Norwegian subtitles on NRK TV (tv.nrk.no) into your preferred language in real-time while you watch.

Translation runs entirely on your device using your browser's built-in translation model. Nothing you watch is sent anywhere.

KEY FEATURES

- Real-time subtitle translation as you watch
- Every language your browser supports, including Arabic, Hebrew, Hindi, Thai, Turkish, Ukrainian, Vietnamese, Korean, Tamil, Telugu and many more. The list is read from your browser, so it is always accurate for your setup
- Fully on-device: no accounts, no API keys, no subtitle text leaving your computer
- Works offline once the language model has downloaded
- Show the translation alongside the Norwegian original, or hide the original and show only the translation
- Translation size that scales with NRK's own subtitles, so it stays in proportion in fullscreen and on small windows, or a fixed size if you prefer
- Choose whether translations appear above or below the original
- Live subtitle log to see exactly what is being detected and translated

HOW TO USE

1. Install the extension
2. Visit NRK TV (tv.nrk.no) and play a video with Norwegian subtitles enabled
3. Click the extension icon and choose the language you want
4. Translated subtitles appear below the Norwegian text in yellow

The first time you use a language, your browser downloads that translation model. This happens automatically and the popup shows live progress. Chrome requires a click on the page before it will start a download, so if nothing happens, pause and play the video again.

CUSTOMISATION

Right-click the extension icon and choose "Options" to set the translation size, choose where translations appear, and hide the Norwegian original if you only want the translation.

REQUIREMENTS

- Google Chrome, or Microsoft Edge 148 or later
- An internet connection for the one-time model download; offline afterwards
- Norwegian subtitles enabled on the NRK TV video

Which languages are available depends on your browser.

PRIVACY

No subtitle text, browsing history, or personal data is collected or transmitted. Translation happens locally in your browser.

SUPPORT

Please feel free to report bugs and request languages on GitHub:
https://github.com/alcaann/nrk-tv-oversetter/issues

This extension is not affiliated with NRK.
```

---

## Other fields

| Field | Value |
| --- | --- |
| Category | Accessibility (alt: Productivity) |
| Language | English |
| Support URL | `https://github.com/alcaann/nrk-tv-oversetter/issues` |
| Official website | *not set* — requires domain verification |
| Privacy policy | `https://github.com/alcaann/nrk-tv-oversetter/blob/main/PRIVACY.md` |

## Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's own settings: target language, translation size, position, and whether to show the original subtitle. |
| `*://*.nrk.no/*` | The extension only reads subtitles and inserts translations on NRK TV pages. It is not active on any other site. |

**Remote code:** none. All code is bundled in the package.

**Data collection:** none.
