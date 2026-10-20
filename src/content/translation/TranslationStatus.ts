/** Where translation stands, from the viewer's point of view */
export type TranslationStatus =
  | { kind: 'ready' }
  | { kind: 'needs-click' }
  | { kind: 'downloading'; progress?: number }
  | { kind: 'stalled' }
  | { kind: 'failed'; error?: string }
  | { kind: 'unavailable' };

export interface StatusMessage {
  text: string;
  /** Label for a button that (re)starts the download; absent if there is nothing to do */
  action?: string;
}

export function describeStatus(status: TranslationStatus, language: string): StatusMessage | null {
  switch (status.kind) {
    case 'ready':
      return null;
    case 'needs-click':
      return {
        text: `The ${language} translation model needs to download once (it then works offline).`,
        action: 'Download now',
      };
    case 'downloading':
      return {
        text:
          status.progress === undefined
            ? `Downloading the ${language} model…`
            : `Downloading the ${language} model… ${status.progress}%`,
      };
    case 'stalled':
      return {
        text: `The ${language} model download stopped making progress. If retrying does not help, restart the browser.`,
        action: 'Retry',
      };
    case 'failed': {
      const detail = status.error ? ` (${status.error.replace(/\.$/, '')})` : '';
      // Seen on Edge 148 for Linux: every language pair fails, German-English
      // included, so retrying here cannot help. Say so instead of looping.
      const hint = isEdge()
        ? " If Microsoft's own Translator playground fails too, Edge's translator does not work on this device; Chrome does."
        : ' Try again; if it keeps failing, restart the browser.';
      return { text: `The browser could not load the ${language} model${detail}.${hint}`, action: 'Retry' };
    }
    case 'unavailable':
      return { text: `Your browser cannot translate Norwegian into ${language}.` };
  }
}

function isEdge(): boolean {
  return navigator.userAgent.includes('Edg/');
}

/** Short form, for a translation that is not there yet */
export function pendingText(status: TranslationStatus): string {
  switch (status.kind) {
    case 'ready':
      return 'Translating…';
    case 'needs-click':
      return 'Waiting for the model download';
    case 'downloading':
      return status.progress === undefined ? 'Downloading model…' : `Downloading model… ${status.progress}%`;
    case 'stalled':
      return 'Model download stalled';
    case 'failed':
      return 'Model could not be loaded';
    case 'unavailable':
      return 'Translation unavailable';
  }
}
