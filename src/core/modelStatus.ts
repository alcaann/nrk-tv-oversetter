/**
 * Shared record of what we know about each translation model.
 *
 * Chrome masks Translator.availability() per origin: every pair reports
 * 'downloadable' until the *calling* origin has created a translator for it. Sessions
 * are created in the content script on tv.nrk.no, so only that context ever learns
 * the truth. The popup is a different origin and would be told 'downloadable'
 * indefinitely if it asked for itself.
 *
 * So the content script records what it learns here, and the popup reads it. That
 * also means the popup can show a real answer with no NRK tab open, instead of
 * telling the user to go and open one.
 */

export type ModelState = 'available' | 'downloading' | 'downloadable' | 'unavailable';

export interface ModelStatusEntry {
  state: ModelState;
  /** 0-100, only meaningful while state is 'downloading' */
  progress?: number;
  updatedAt: number;
}

export type ModelStatusMap = Record<string, ModelStatusEntry>;

const STORAGE_KEY = 'modelStatus';

/** Message broadcast so an open popup can follow a download as it happens */
export const MODEL_STATUS_MESSAGE = 'MODEL_STATUS';

export interface ModelStatusMessage {
  type: typeof MODEL_STATUS_MESSAGE;
  pairKey: string;
  entry: ModelStatusEntry;
}

export function pairKey(sourceLang: string, targetLang: string): string {
  return `${sourceLang}-${targetLang}`;
}

export async function readModelStatus(): Promise<ModelStatusMap> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return (stored[STORAGE_KEY] as ModelStatusMap) || {};
  } catch {
    return {};
  }
}

export async function getModelStatus(key: string): Promise<ModelStatusEntry | null> {
  const all = await readModelStatus();
  return all[key] || null;
}

/**
 * Record what we now know about a pair, and tell any open popup about it.
 *
 * Progress updates are broadcast but deliberately not persisted on every tick -
 * writing to storage several times a second during a download is wasteful, and a
 * stale percentage is useless after the fact anyway.
 */
export async function setModelStatus(
  key: string,
  entry: Omit<ModelStatusEntry, 'updatedAt'>
): Promise<void> {
  const full: ModelStatusEntry = { ...entry, updatedAt: Date.now() };

  broadcast(key, full);

  if (entry.state === 'downloading') {
    return;
  }

  try {
    const all = await readModelStatus();
    all[key] = full;
    await chrome.storage.local.set({ [STORAGE_KEY]: all });
  } catch {
    // Status is advisory - failing to persist it is not worth surfacing
  }
}

function broadcast(key: string, entry: ModelStatusEntry): void {
  try {
    const message: ModelStatusMessage = {
      type: MODEL_STATUS_MESSAGE,
      pairKey: key,
      entry
    };
    chrome.runtime.sendMessage(message).catch(() => {
      // Nothing listening (no popup open) - expected, and harmless
    });
  } catch {
    // Messaging unavailable in this context
  }
}
