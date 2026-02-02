# Architecture Overview

## Project Structure

```
nrk-tv-oversetter/
├── src/
│   ├── background/
│   │   └── service-worker.ts          # Background service worker (minimal logic)
│   ├── content/
│   │   ├── SubtitleProcessor.ts       # Core subtitle detection & translation (321 LOC)
│   │   ├── subtitle-injector.ts       # Content script entry point (119 LOC)
│   │   └── subtitle-styles.css        # Styles for translated subtitle elements
│   ├── core/
│   │   ├── interfaces/                # TypeScript interfaces for extensibility
│   │   │   ├── ITranslationEngine.ts  # Translation engine contract
│   │   │   ├── ISubtitleProcessor.ts  # Subtitle processor contract
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
├── scripts/
│   ├── bundle-content-script.js       # IIFE bundler for content script
│   └── copy-assets.js                 # Copies HTML/CSS to dist/
├── dist/                              # Build output (git-ignored)
└── docs/
    ├── CAPTION_DETECTOR.md            # How subtitle detection works
    └── ARCHITECTURE.md                # This file
```

## File Size Analysis

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| SubtitleProcessor.ts | 321 | ✅ Good | Core logic, well-structured |
| options.html | ~130 | ✅ Good | Now uses external CSS |
| popup.html | ~70 | ✅ Good | Now uses external CSS |
| options.css | 324 | ✅ Good | Separated for maintainability |
| popup.css | 185 | ✅ Good | Separated for maintainability |

**Previous state**: options.html (455 LOC) and popup.html (258 LOC) had massive inline `<style>` blocks
**Current state**: CSS extracted to separate files for better maintainability and LLM context usage

## Core Components

### 1. SubtitleProcessor (Content Script)
**File**: [`src/content/SubtitleProcessor.ts`](../src/content/SubtitleProcessor.ts)

**Responsibilities**:
- Detect subtitle elements on NRK TV pages
- Extract original text (excluding translations)
- Translate subtitles via TranslationEngine
- Inject translated subtitle elements into DOM

**Detection Strategy** (see [CAPTION_DETECTOR.md](CAPTION_DETECTOR.md)):
- **MutationObserver**: Primary detection for DOM changes
- **Polling (500ms)**: Fallback for Lit framework updates that bypass MutationObserver
- **Re-querying**: Container re-queried each poll to handle NRK replacing elements

**Key Methods**:
- `findSubtitleContainer()`: Selector matching (update here if NRK changes HTML)
- `processSubtitle()`: Translation pipeline
- `getOriginalText()`: Filters out translation elements

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
  fontSize: number,             // Default: 20
  showOriginal: boolean         // Default: true (not implemented)
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

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User visits tv.nrk.no                                    │
│    └─> Content script (subtitle-injector.ts) loads          │
│        └─> Initializes SubtitleProcessor                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SubtitleProcessor starts detection                       │
│    ├─> MutationObserver watches subtitle container          │
│    └─> Polling checks text changes every 500ms              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Subtitle detected                                         │
│    ├─> Extract original text (filter out translations)      │
│    ├─> Check cache (avoid re-processing)                    │
│    └─> Send log to Options page (if open)                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. TranslationEngine.translate()                             │
│    ├─> Get/create session for language pair                 │
│    ├─> Call session.translate(text)                         │
│    └─> Return translated text                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Inject translation into DOM                               │
│    ├─> Create <div class="nrk-oversetter-translation">      │
│    ├─> Position above/below original                        │
│    └─> Send completion log to Options page                  │
└─────────────────────────────────────────────────────────────┘
```

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
2. Interfaces (IStorageService, ISubtitleProcessor, ITranslationEngine)
3. TranslatorEngine.js
4. TranslationEngineFactory.js
5. StorageService.js
6. SubtitleProcessor.js
7. subtitle-injector.js (entry point)

### Full Build
```bash
npm run build
```
Runs: `tsc && npm run copy-assets && npm run bundle-content`

## Extension Manifest (manifest.json)

**Key fields**:
- `manifest_version`: 3
- `permissions`: `["storage", "activeTab"]`
- `host_permissions`: `["*://*.nrk.no/*"]`
- `content_scripts`: Injects bundled script on `tv.nrk.no`
- `background.service_worker`: Minimal background worker
- `action.default_popup`: Popup UI
- `options_ui.page`: Options page

## Design Patterns

### 1. Factory Pattern
**TranslationEngineFactory**: Allows easy swapping of translation engines (Edge Translator API, Google Translate, DeepL, custom)

### 2. Interface Segregation
All core components implement interfaces (`ITranslationEngine`, `ISubtitleProcessor`, `IStorageService`) for:
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

2. **Update selectors** in `SubtitleProcessor.findSubtitleContainer()`:
```typescript
const possibleSelectors = [
  'span[class*="subtitle"]',  // NRK
  '.newsite-caption',         // New site
  ...
];
```

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
- `activeTab`: Access NRK TV tabs
- `host_permissions`: Only `*.nrk.no/*`

## Future Improvements

### Potential Refactoring
- **SubtitleProcessor**: Could be split into smaller classes:
  - `SubtitleDetector` (MutationObserver + polling)
  - `SubtitleTranslator` (translation pipeline)
  - `SubtitleRenderer` (DOM injection)
- **UI components**: Consider using a small framework (Preact, Svelte) for better state management

### Feature Ideas
- Translation caching (avoid re-translating seen subtitles)
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
