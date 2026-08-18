# Microsoft Edge Add-ons listing

Paste each section into the corresponding field. Written for **v0.2.0**.

Largely the same as the [Chrome listing](chrome-web-store.md), with the language
support framed the other way round — Edge is the stronger browser for this extension
and the listing should say so rather than treating it as the fallback.

---

## Short description

```
Translate Norwegian subtitles on NRK TV into 145+ languages, in real-time and on your device. Works offline.
```

---

## Detailed description

```
NRK TV Oversetter translates Norwegian subtitles on NRK TV (tv.nrk.no) into your preferred language in real-time while you watch.

Translation runs entirely on your device using the translation model built into Microsoft Edge. Nothing you watch is sent anywhere.

KEY FEATURES

- Real-time subtitle translation as you watch
- 145+ languages on Edge 148 and later, including Arabic, Hebrew, Hindi, Thai, Turkish, Ukrainian, Vietnamese, Korean, Tamil and Telugu. The list is read from your browser, so it is always accurate for your setup
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

The first time you use a language, Edge downloads that translation model. This happens automatically and the popup shows live progress. If nothing happens, pause and play the video again — the browser needs a click on the page before it will start a download.

CUSTOMISATION

Right-click the extension icon and choose "Options" to set the translation size, choose where translations appear, and hide the Norwegian original if you only want the translation.

REQUIREMENTS

- Microsoft Edge 148 or later, which is where the built-in Translator API became available
- An internet connection for the one-time model download; offline afterwards
- Norwegian subtitles enabled on the NRK TV video

PRIVACY

No subtitle text, browsing history, or personal data is collected or transmitted. Translation happens locally in your browser.

SUPPORT

Please report bugs and request languages on GitHub:
https://github.com/alcaann/nrk-tv-oversetter/issues

Store reviews are difficult to reply to, so a GitHub issue gets a much faster and more useful answer.

This extension is not affiliated with NRK.
```

---

## Other fields

| Field | Value |
| --- | --- |
| Category | Accessibility (alt: Productivity) |
| Language | English |
| Support URL | `https://github.com/alcaann/nrk-tv-oversetter/issues` |
| Website | *not set* — requires domain verification |
| Privacy policy | `https://github.com/alcaann/nrk-tv-oversetter/blob/main/PRIVACY.md` |

## Before submitting

- [ ] Confirm the real language count on Edge 148+. The console logs
      `Language cache ready: N target languages available` — if N is not near 145,
      correct both the short and detailed descriptions before publishing.
- [ ] Retake screenshots in Edge if the UI differs.
- [ ] Update the install table in the main [README](../README.md) with the listing URL.
