# Architecture Overview

## Project Structure

```
nrk-tv-oversetter/
├── src/
│   ├── background/
│   │   └── service-worker.ts          # Background service worker (minimal logic)
│   ├── content/
│   │   ├── subtitle-injector.ts       # Content script entry point: wires the pieces below
│   │   ├── captions/                  # What is said, and when
│   │   │   ├── CaptionTracker.ts      # Finds the video, picks a source, keeps the timeline
│   │   │   ├── TextTrackSource.ts     # Reads cues from the video's subtitle TextTrack
│   │   │   ├── DomSource.ts           # Fallback: scrapes NRK's rendered line
│   │   │   └── types.ts               # Caption model and text helpers
│   │   ├── translation/
│   │   │   └── TranslationQueue.ts    # Translates ahead of the playhead, cached by text
│   │   ├── ui/
│   │   │   ├── HistoryPanel.ts        # Side panel: caption history, hover to reveal, pause on hover
│   │   │   └── OverlayRenderer.ts     # Translated line on the video
│   │   └── subtitle-styles.css        # Overlay, native-subtitle hiding, page margin for the panel
│   ├── core/
│   │   ├── interfaces/                # TypeScript interfaces for extensibility
│   │   │   ├── ITranslationEngine.ts  # Translation engine contract
│   │   │   └── IStorageService.ts     # Storage service contract + default settings
│   │   └── translation/
│   │       ├── TranslatorEngine.ts            # Built-in Translator API implementation
│   │       └── TranslationEngineFactory.ts    # Engine factory pattern
│   ├── ui/
│   │   ├── popup.html/css/ts          # Extension popup UI (enable/disable, download model)
│   │   └── options.html/css/ts        # Settings page + live subtitle log viewer
│   └── utils/
│       ├── StorageService.ts          # Chrome storage wrapper
│       └── Logger.ts                  # Logging utility with dev mode toggle
├── tools/harness/                 # Real-Chrome test harness (see its README)
├── scripts/
│   ├── bundle-content-script.js       # IIFE bundler for content script
│   └── copy-assets.js                 # Copies HTML/CSS to dist/
├── dist/                              # Build output (git-ignored)
└── docs/
    ├── CAPTION_DETECTOR.md            # How subtitle detection works
    └── ARCHITECTURE.md                # This file
```

## Core Components

### 1. Caption pipeline (content script)

```
CaptionTracker ──captions/active──▶ TranslationQueue ──translations──┐
      │                                                              ▼
      └──────────────captions/active/playhead──────────▶ HistoryPanel, OverlayRenderer
```

- **CaptionTracker** owns the timeline. It reads NRK's subtitle `TextTrack`
  (`TextTrackSource`), forcing it on in the background if the viewer has
  subtitles off, and falls back to scraping the page (`DomSource`). See
  [CAPTION_DETECTOR.md](CAPTION_DETECTOR.md).
- **TranslationQueue** translates captions nearest the playhead first, up to 60 s
  ahead, so translations are ready before the line is spoken. It parks until a
  click if Chrome needs a user gesture to download the model.
- **HistoryPanel** (shadow DOM) lists every line spoken so far: Norwegian
  visible, translation blurred until hovered. Pointer in the panel pauses the
  video, leaving resumes it. Timestamps seek. Moves into the fullscreen element in
  fullscreen.
- **OverlayRenderer** draws the translation on the video as our own child of
  `<tv-player>`, never inside NRK's Lit template.
- Settings are applied in place (`Controller.updateSettings`); the panel writes
  settings itself, so tearing down on change would lose the history.

### 2. TranslatorEngine
**File**: [`src/core/translation/TranslatorEngine.ts`](../src/core/translation/TranslatorEngine.ts)

**Responsibilities**:
- Wrapper around Chrome/Edge built-in Translator API
- Session management (create, reuse, destroy)
- Model availability checking

**API Usage**:
```typescript
// Check if model is available
const availability = await Translator.availability({ sourceLanguage: 'no', targetLanguage: 'en' });

// Create session
const session = await Translator.create({ sourceLanguage: 'no', targetLanguage: 'en' });

// Translate
const result = await session.translate(text);
```

**Note**: Model download requires user gesture (handled in popup.ts)

### 3. StorageService
**File**: [`src/utils/StorageService.ts`](../src/utils/StorageService.ts)

**Responsibilities**:
- Wrapper around `chrome.storage.sync`
- Provides default settings via `DEFAULT_SETTINGS` in IStorageService.ts

**Settings Structure**:
```typescript
{
  enabled: boolean,
  sourceLanguage: string,      // Default: 'no' (Norwegian)
  targetLanguage: string,       // Default: 'en' (English)
  translationEngine: string,    // Default: 'edge'
  position: 'above' | 'below',  // Default: 'below'
  fontSizeMode, fontSizeScale, fontSize,
  showOriginal: boolean,        // NRK's Norwegian subtitles on the video
  showTranslation: boolean,     // Translated line on the video
  panelEnabled: boolean,        // History panel open (collapsed to a tab otherwise)
  pauseOnHover: boolean         // Pause while the pointer is over the panel
}
```

### 4. UI Components

#### Popup (popup.html/css/ts)
- Enable/disable extension toggle
- Target language selector
- Translation engine selector
- Model download button (shows if model not available)

#### Options Page (options.html/css/ts)
- Full settings configuration
- **Live Subtitle Log Viewer**: Real-time feed of detected/translated subtitles
- Info box about Translator API

**Log Viewer**: Receives messages from content script via `chrome.runtime.sendMessage()`

## Data Flow

1. The content script loads on tv.nrk.no and starts a `Controller` (if enabled).
2. `CaptionTracker` finds the player's `<video>` and reads its subtitle track;
   new cues are added to the timeline as the player loads them.
3. `TranslationQueue` translates them, nearest the playhead first.
4. On each `timeupdate` the panel reveals lines whose start has been reached;
   `cuechange` marks the active line and updates the on-video translation.
5. The options page's live log still receives `SUBTITLE_LOG` messages.

## Build Process

### TypeScript Compilation
```bash
tsc
```
- Compiles all `.ts` files to JavaScript in `dist/` (preserving directory structure)

### Asset Copying
```bash
npm run copy-assets
```
- Copies HTML and CSS files from `src/ui/` to `dist/ui/`
- Copies CSS files from `src/content/` to `dist/content/`

### Content Script Bundling
```bash
npm run bundle-content
```
- Uses custom IIFE bundler ([`scripts/bundle-content-script.js`](../scripts/bundle-content-script.js))
- Bundles all content script dependencies into single file
- **Why custom bundler?** Manifest V3 content scripts must be single file, webpack/rollup add overhead

**Bundle order** (dependencies first):
1. Logger.js
2. Interfaces (IStorageService, ITranslationEngine)
3. TranslatorEngine.js
4. TranslationEngineFactory.js
5. StorageService.js
6. content/captions/*, content/translation/*, content/ui/*
7. subtitle-injector.js (entry point)

The bundler strips `import`/`export` and concatenates into one scope, so imports
must stay on one line and top-level names must be unique across files.

### Full Build
```bash
npm run build
```
Runs: `tsc && npm run copy-assets && npm run bundle-content`

## Extension Manifest (manifest.json)

**Key fields**:
- `manifest_version`: 3
- `permissions`: `["storage"]`
- `host_permissions`: `["*://*.nrk.no/*"]`
- `content_scripts`: Injects bundled script on `tv.nrk.no`
- `background.service_worker`: Minimal background worker
- `action.default_popup`: Popup UI
- `options_ui.page`: Options page

## Design Patterns

### 1. Factory Pattern
**TranslationEngineFactory**: Allows easy swapping of translation engines (Edge Translator API, Google Translate, DeepL, custom)

### 2. Interface Segregation
Core services implement interfaces (`ITranslationEngine`, `IStorageService`, `CaptionSource`) for:
- Testability
- Extensibility
- Clear contracts

### 3. Observer Pattern
- **MutationObserver**: Watches DOM for subtitle changes
- **chrome.storage.onChanged**: Reacts to settings changes
- **chrome.runtime.onMessage**: Content ↔ Popup/Options communication

### 4. Singleton (Factory)
TranslationEngineFactory caches engine instances to avoid recreating sessions

## Extensibility Points

### Adding a New Translation Engine

1. **Create engine class** implementing `ITranslationEngine`:
```typescript
// src/core/translation/MyEngine.ts
export class MyEngine implements ITranslationEngine {
  async initialize(): Promise<void> { /* ... */ }
  async translate(text: string, src: string, target: string): Promise<string> { /* ... */ }
  async isAvailable(): Promise<boolean> { /* ... */ }
  getName(): string { return 'My Engine'; }
  async dispose(): Promise<void> { /* ... */ }
}
```

2. **Register in factory** ([`TranslationEngineFactory.ts`](../src/core/translation/TranslationEngineFactory.ts)):
```typescript
case 'my-engine':
  engine = new MyEngine();
  break;
```

3. **Update UI dropdowns** (popup.html, options.html):
```html
<option value="my-engine">My Engine</option>
```

### Supporting New Streaming Sites

1. **Update manifest.json**:
```json
"content_scripts": [{
  "matches": ["*://tv.nrk.no/*", "*://newsite.com/*"],
  ...
}]
```

2. **Add a caption source** implementing `CaptionSource` ([types.ts](../src/content/captions/types.ts)) and choose it in `CaptionTracker.watch()`. Prefer reading the site's `TextTrack` if it has one.

## Debugging Tips

### Console Logs
- **Development mode**: `Logger.isDevelopment = true` (shows info/debug logs)
- **Production**: Only errors/warnings shown
- **Logs**: Prefixed with `[NRK-Oversetter]`

### Live Log Viewer
- Open Options page → "Real-Time Subtitle Log"
- Shows detected subtitles, translations, errors
- Must be open BEFORE playing video

### Common Issues
See [CAPTION_DETECTOR.md](CAPTION_DETECTOR.md) "Common Issues & Solutions" section

## Performance Considerations

### Polling Overhead
- 500ms interval: Minimal CPU usage
- Re-querying selector: `querySelector()` is fast (~0.1ms)
- Text comparison: Simple string equality check

### Memory Management
- **Processed cache**: Limited to 100 entries (old entries auto-removed)
- **Translation sessions**: Reused per language pair, destroyed on dispose

### Bundle Size
- Content script bundle: ~22 KB (reasonable for browser extension)
- No external dependencies (native browser APIs only)

## Security

### Content Security Policy
- No eval() or inline scripts
- All code compiled from TypeScript

### Data Privacy
- No data sent to external servers (Translator API is local)
- Settings stored in `chrome.storage.sync` (user-controlled)

### Permissions
- `storage`: Settings persistence
- `host_permissions`: Only `*.nrk.no/*`

## Future Improvements

### Potential Refactoring
- **UI components**: Consider using a small framework (Preact, Svelte) for better state management

### Feature Ideas
- Keyboard shortcuts (toggle on/off)
- Custom subtitle styling
- Export/import settings
- Multiple streaming sites support

## Maintenance Checklist

When NRK updates their website:
1. ✅ Check subtitle container selector ([CAPTION_DETECTOR.md](CAPTION_DETECTOR.md))
2. ✅ Test MutationObserver still fires
3. ✅ Verify polling detects changes
4. ✅ Check injected translations don't break layout

When updating dependencies:
1. ✅ Test build process
2. ✅ Verify bundled content script still works
3. ✅ Check TypeScript compilation

When adding features:
1. ✅ Update interfaces if needed
2. ✅ Add to TodoWrite for tracking
3. ✅ Update README and docs
4. ✅ Test in both Chrome and Edge
