# Store listing copy

Ready-to-paste text for the extension's store listings. Keep these in step with the
code — the listing is the only description most users ever read, and a stale one
generates support requests and poor reviews. The 3-star review complaining about
missing Arabic was a listing that promised nine languages long after the browser
could do far more.

| File | Listing |
| --- | --- |
| [chrome-web-store.md](chrome-web-store.md) | [Chrome Web Store](https://chromewebstore.google.com/detail/nrk-tv-oversetter/hlnikafacjiekphhloakkbhokhfkpcem) |
| [edge-add-ons.md](edge-add-ons.md) | Microsoft Edge Add-ons (not yet submitted) |

## When to update these

Anything that changes what a user sees or has to do:

- The supported language set, or how it is determined
- Model download behaviour
- Minimum browser versions
- Settings that appear in the popup or options page

## Notes

- **Support link:** the GitHub repository is set as the *support* link, not the
  official website — the latter requires domain verification, which we do not have.
- **Screenshots:** masters live outside the repo; optimised copies are in
  [docs/assets/](../docs/assets/). Chrome expects 1280x800.
- **Version:** the store rejects a submission whose version is not higher than the
  published one. The store currently has 0.1.2; the repo is at 0.2.0.
