# NRK TV Oversetter

Browser extension that translates Norwegian subtitles on NRK TV in real-time using Chrome/Edge's built-in Translator API.

## Browser Support

**✅ Chrome Stable** | **✅ Edge Canary** | **❌ Edge Stable** (Translator API not available)

## Features

- Real-time Norwegian subtitle translation
- Multiple target languages (English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese)
- Customizable display (font size, position)
- Offline translation after model download
- Live subtitle log viewer

## Quick Start

```bash
# Build
npm install
npm run build

# Load in browser
# Chrome: chrome://extensions → Enable Developer mode → Load unpacked
# Edge Canary: edge://extensions → Enable Developer mode → Load unpacked
```

## Usage

1. Open [NRK TV](https://tv.nrk.no)
2. Click extension icon → Download translation model (first time only)
3. Enable extension and play video with subtitles
4. Translations appear below Norwegian subtitles in yellow

**Settings**: Right-click extension → Options

## How It Works

Uses **dual detection** for reliable subtitle capture on NRK TV:

- **MutationObserver**: Watches DOM changes in subtitle container
- **Polling (500ms)**: Catches updates missed by observer (NRK uses Lit framework)
- **Primary selector**: `span[class*="subtitle"]`
- **Translation**: Chrome/Edge built-in Translator API (offline after model download)

**If NRK changes their site**, update selectors in [SubtitleProcessor.ts:131](src/content/SubtitleProcessor.ts)

See [docs/CAPTION_DETECTOR.md](docs/CAPTION_DETECTOR.md) for detection details.

## Development

**Commands:**
```bash
npm run build          # Full build (TypeScript + assets + bundling)
npm run clean          # Remove dist/
npm run copy-assets    # Copy HTML/CSS to dist/
npm run bundle-content # Bundle content script
```

**Architecture** ([full docs](docs/ARCHITECTURE.md)):
- `src/content/SubtitleProcessor.ts` - Subtitle detection & processing
- `src/core/translation/` - Translation engines (factory pattern)
- `src/ui/` - Popup & options pages
- `src/core/interfaces/` - TypeScript interfaces for extensibility

**Add new translation engine:**
1. Implement `ITranslationEngine` interface
2. Register in `TranslationEngineFactory.ts`
3. Add to UI dropdowns

## Troubleshooting

**No translations?**
- Verify you're using Chrome Stable or Edge Canary (NOT Edge Stable)
- Download translation model via popup first
- Refresh NRK TV page after enabling extension

**Model download stuck?**
- Edge Stable will never work - use Chrome or Edge Canary
- Check browser console (F12) for errors

**Subtitle detection broken?**
- NRK may have changed their HTML structure
- Update selectors in `SubtitleProcessor.ts` (~line 131)
- See [CAPTION_DETECTOR.md](docs/CAPTION_DETECTOR.md) for guide

## License

MIT
