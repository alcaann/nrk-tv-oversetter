# Test harness

Drives real Google Chrome, with the unpacked extension loaded, against live
tv.nrk.no, and checks what the extension shows against the ground truth: the
video's own subtitle `TextTrack`.

```bash
npm run harness:scenarios              # build, then run every scenario
node tools/harness/scenarios.cjs seek  # one scenario (after npm run build)
npm run harness:audit                  # one episode, sampled for 60 s
HEADED=1 node tools/harness/scenarios.cjs pause   # watch it in a window
VERBOSE=1 / LOGS=1                     # echo / dump extension console output
BROWSER=microsoft-edge node tools/harness/scenarios.cjs   # run against Edge
```

Requirements: `google-chrome` on PATH (stable 137+), and a connection from a
region where NRK's content plays (the default episode is open to all of Norway).

## How it works

- **launch.cjs** - Branded Chrome ignores `--load-extension`, and Playwright's
  Chromium cannot play NRK's H.264/H.265. So Chrome is started directly with both
  `--remote-debugging-pipe` (to call `Extensions.loadUnpacked`, which only exists
  over the pipe) and `--remote-debugging-port` (for Playwright's `connectOverCDP`).
  The profile is kept in `.harness/profile`, so the translation model downloads
  once.
- **sampler.cjs** - Every 250 ms records the active cue on the track, NRK's
  rendered line, the on-video translation and the history panel's state, then
  reports cues that were missed, shown with the previous line's translation,
  lingering in gaps, or absent from the panel.
- **scenarios.cjs** - `spa-navigation`, `episode-switch`, `subtitle-toggle`,
  `seek`, `pause`, `dual-mode`, `nrk-menu`, `live`, `fullscreen`,
  `fresh-profile` (an empty profile, to exercise the model download) and
  `first-run` (a real fresh install: off, with the mode card on the player).
  Scenarios run in learning mode unless they set their own settings.

Headless Edge downloads the model but never finishes installing it, and after a
restart refuses with `NotSupportedError`, so the Edge download path cannot be
verified end to end here. Use it for everything else.

The user activation Chrome needs to download a model is granted by clicking the
panel footer, which does nothing. Do not click page corners: some NRK pages have
a link there.
