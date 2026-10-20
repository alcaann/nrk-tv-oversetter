# Media

Regenerates the walkthrough and store images from the real extension on live
tv.nrk.no, so they never drift from the UI. Re-run after any visible change.

```bash
npm run build
node tools/media/record-tutorial.cjs       # docs/tutorial/: 01-06 screenshots, tutorial.mp4, tutorial.gif, clean-*.png
node tools/media/render-store-assets.cjs   # store/assets/: promo tiles, from the clean-*.png frames
```

Needs `ffmpeg` on PATH, plus everything the [harness](../harness/README.md) needs. The
recording uses the harness profile, so the translation model should already be
downloaded there (run any harness scenario once).

- **tutorial-overlay.js** is injected into the page: step callouts, arrows, a
  highlight ring and a visible cursor (headless screencasts draw none). It never
  takes pointer events, so the page behaves as for a real user.
- **record-tutorial.cjs** plays a first-time user through the steps, recording
  with Chrome's screencast, then assembles the MP4 and GIF with ffmpeg. The
  screenshots are 1280x800, the Chrome Web Store size.
