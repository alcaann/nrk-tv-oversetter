/** Feed the options page's live subtitle log, if it is open */
export function sendSubtitleLog(type: string, data: Record<string, unknown>): void {
  chrome.runtime
    .sendMessage({ type: 'SUBTITLE_LOG', logType: type, data: { ...data, timestamp: new Date().toISOString() } })
    .catch(() => {
      // Nothing listening - expected when the options page is closed
    });
}
