# Caption Detection System

## How It Works

The subtitle detection system uses a **dual approach** to reliably capture NRK TV subtitles:

### 1. MutationObserver (Primary)
Watches for DOM changes in the subtitle container and processes:
- `childList` mutations: New subtitle elements added
- `characterData` mutations: Text content changes
- `attributes` mutations: Attribute changes

### 2. Polling Fallback (500ms interval)
**Why polling?** NRK uses the Lit web framework which can update text content without triggering MutationObserver events. The polling mechanism:
- Re-queries the subtitle container every 500ms
- Compares current text with last known text
- Detects changes that MutationObserver missed
- Clears the processed cache when text changes

## Subtitle Container Selectors

The detector searches for subtitle containers using these selectors (in priority order):

```typescript
const possibleSelectors = [
  'span[class*="subtitle"]',  // NRK subtitle span (most specific)
  '.nrk-subtitle',
  '.video-subtitle',
  '.vjs-text-track-display',
];
```

**If NRK changes their website**, update this array in [`src/content/SubtitleProcessor.ts`](../src/content/SubtitleProcessor.ts) line ~131.

## Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ 1. Page Load                                    │
│    └─> Initialize SubtitleProcessor             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Find Subtitle Container                      │
│    └─> Query selectors every 2s until found     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Start Dual Detection                         │
│    ├─> MutationObserver (DOM changes)           │
│    └─> Polling (text comparison, 500ms)         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Process Subtitle                             │
│    ├─> Extract original text only               │
│    ├─> Check if already processed (cache)       │
│    ├─> Translate via TranslationEngine          │
│    └─> Inject translation element               │
└─────────────────────────────────────────────────┘
```

## Key Implementation Details

### Duplicate Prevention
- **Cache**: `Set<string>` tracking processed subtitles by `tagName-fullText`
- **Cache clearing**: Cleared on ANY text change (ensures new subtitles are processed)
- **Translation element filtering**: Ignores elements with class `nrk-oversetter-translation`

### Text Extraction
```typescript
// Clone element to avoid modifying DOM
const clone = element.cloneNode(true) as HTMLElement;

// Remove our translation elements from clone
const translationElements = clone.querySelectorAll('.nrk-oversetter-translation');
translationElements.forEach(el => el.remove());

// Get only original text
return clone.textContent?.trim() || '';
```

### Polling Re-query Strategy
The container is **re-queried on every poll** (not cached) because NRK may replace subtitle elements. This ensures we always process the live subtitle container.

## Debugging

To debug subtitle detection:

1. Open NRK TV console (F12)
2. Watch for logs:
   - `"Subtitle container found"` - Container detected
   - `"Waiting for video with subtitles"` - Container not found (still searching)
3. Check Options page live log viewer for subtitle processing events

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Subtitles not detected | Selector doesn't match NRK's HTML | Update `possibleSelectors` array |
| Only first subtitle translated | Cache not clearing | Check polling is running, verify text comparison logic |
| Duplicate translations | Same subtitle processed multiple times | Check cache logic, ensure `lastSubtitleText` is initialized |
| Shadow DOM warning | NRK using web components | MutationObserver may not penetrate shadow DOM - polling will handle it |

## Files Involved

- **[`src/content/SubtitleProcessor.ts`](../src/content/SubtitleProcessor.ts)**: Main detection logic
  - `findSubtitleContainer()`: Selector matching (~line 129)
  - `startPolling()`: Polling mechanism (~line 106)
  - `processSubtitle()`: Processing pipeline (~line 175)
  - `getOriginalText()`: Text extraction (~line 200)

- **[`src/content/subtitle-injector.ts`](../src/content/subtitle-injector.ts)**: Entry point
  - Initializes processor when page loads
  - Handles settings changes (re-initializes processor)

## Performance

- **Polling overhead**: Minimal (500ms interval, simple text comparison)
- **MutationObserver**: Efficient DOM change detection
- **Re-querying**: `querySelector()` is fast, negligible overhead
- **Memory**: Cache limited to 100 entries, old entries auto-removed
