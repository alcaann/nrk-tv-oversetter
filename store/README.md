# Store listing copy

Ready-to-paste text for the extension's store listings. Keep these in step with the
code — the listing is the only description most users ever read, and a stale one
generates support requests and poor reviews. The 3-star review complaining about
missing Arabic was a listing that promised nine languages long after the browser
could do far more.

| File | Listing |
| --- | --- |
| [chrome-web-store.md](chrome-web-store.md) | [Chrome Web Store](https://chromewebstore.google.com/detail/nrk-tv-oversetter/hlnikafacjiekphhloakkbhokhfkpcem) |
| [edge-add-ons.md](edge-add-ons.md) | Microsoft Edge Add-ons (on hold: Edge's translator is broken on Linux, [MSEdgeExplainers#1424](https://github.com/MicrosoftEdge/MSEdgeExplainers/issues/1424)) |

## When to update these

Anything that changes what a user sees or has to do:

- The supported language set, or how it is determined
- Model download behaviour
- Minimum browser versions
- Settings that appear in the popup or options page

## Notes

- **Support link:** the GitHub repository is set as the *support* link, not the
  official website — the latter requires domain verification, which we do not have.
- **Images:** screenshots are recorded from the real extension on tv.nrk.no by
  `tools/media/record-tutorial.cjs` into [docs/tutorial/](../docs/tutorial/), at
  the 1280x800 Chrome expects; promo tiles are rendered into [assets/](assets/) by
  `tools/media/render-store-assets.cjs`. Re-run both after UI changes.
- **Version:** the store rejects a submission whose version is not higher than the
  published one. The repo is at 0.3.0.
