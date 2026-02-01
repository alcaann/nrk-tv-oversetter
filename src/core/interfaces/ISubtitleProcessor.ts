/**
 * Interface for processing subtitles on the page
 */
export interface ISubtitleProcessor {
  /**
   * Initialize the subtitle processor and start observing subtitle changes
   */
  initialize(): void;

  /**
   * Process a subtitle element and add translation
   * @param element - The DOM element containing the subtitle
   */
  processSubtitle(element: HTMLElement): Promise<void>;

  /**
   * Clean up and stop observing
   */
  dispose(): void;
}

export interface SubtitleElement {
  element: HTMLElement;
  originalText: string;
  translatedText?: string;
  timestamp?: number;
}
