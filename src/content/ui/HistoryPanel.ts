import { Caption } from '../captions/types.js';
import { ExtensionSettings } from '../../core/interfaces/IStorageService.js';

const PANEL_WIDTH = 360;

export interface HistoryPanelCallbacks {
  onSeek(time: number): void;
  onSettingsChange(changes: Partial<ExtensionSettings>): void;
}

interface Row {
  caption: Caption;
  element: HTMLLIElement;
  translation: HTMLDivElement;
}

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: ${PANEL_WIDTH}px;
  z-index: 2147483000; display: flex; flex-direction: column;
  background: #141414; color: #eee; border-left: 1px solid #2a2a2a;
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.panel[hidden] { display: none; }
header {
  display: flex; align-items: center; gap: 6px; padding: 10px 12px;
  border-bottom: 1px solid #2a2a2a; flex: none;
}
header h1 { font-size: 14px; font-weight: 600; margin: 0 auto 0 0; letter-spacing: .02em; }
button {
  font: inherit; font-size: 12px; color: #bbb; background: #222; border: 1px solid #333;
  border-radius: 6px; padding: 3px 8px; cursor: pointer;
}
button:hover { color: #fff; border-color: #555; }
button[aria-pressed="true"] { color: #111; background: #ffd700; border-color: #ffd700; }
ol { position: relative; list-style: none; margin: 0; padding: 8px 0 40vh; overflow-y: auto; flex: 1; overscroll-behavior: contain; }
li { padding: 6px 12px 8px; border-left: 3px solid transparent; }
li[hidden] { display: none; }
li.active { border-left-color: #ffd700; background: #1d1d1d; }
li:hover { background: #222; }
.time {
  float: right; margin-left: 8px; padding: 0 4px; border: 0; background: none;
  color: #666; font-size: 11px; font-variant-numeric: tabular-nums;
}
.time:hover { color: #ffd700; background: none; }
.no { white-space: pre-line; }
.en {
  white-space: pre-line; color: #ffd700; font-size: 14px; margin-top: 2px;
  filter: blur(5px); opacity: .45; transition: filter .12s, opacity .12s; user-select: none;
}
li:hover .en, .reveal-all .en { filter: none; opacity: 1; user-select: text; }
.en.pending { color: #666; }
footer { flex: none; padding: 6px 12px; font-size: 11px; color: #777; border-top: 1px solid #2a2a2a; }
.empty { padding: 24px 16px; color: #777; font-size: 13px; }
.tab {
  position: fixed; top: 50%; right: 0; transform: translateY(-50%); z-index: 2147483000;
  writing-mode: vertical-rl; padding: 12px 4px; border-radius: 6px 0 0 6px;
  background: #222; color: #ddd; border: 1px solid #333; border-right: 0;
}
`;

/**
 * Side panel listing every line spoken so far.
 *
 * Norwegian is always visible; the translation stays blurred until the pointer is
 * over its line, so you can watch in Norwegian and peek only when you need to.
 * Moving into the panel pauses the video and leaving resumes it - but only if it
 * was the panel that paused it.
 */
export class HistoryPanel {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private panel!: HTMLDivElement;
  private list!: HTMLOListElement;
  private empty!: HTMLDivElement;
  private footer!: HTMLElement;
  private tab!: HTMLButtonElement;
  private toggles: Record<string, HTMLButtonElement> = {};

  private rows = new Map<string, Row>();
  private ordered: Row[] = [];
  private activeIds = new Set<string>();
  private video: HTMLVideoElement | null = null;
  private pausedByPanel = false;
  private hovering = false;
  /** The viewer scrolled away from the newest line, so stop following it */
  private detached = false;
  private lastTime = 0;

  private readonly onFullscreenChange = () => this.placeHost();

  constructor(
    private settings: ExtensionSettings,
    private readonly callbacks: HistoryPanelCallbacks
  ) {
    this.host = document.createElement('div');
    this.host.id = 'nrk-oversetter-panel';
    this.root = this.host.attachShadow({ mode: 'open' });
    this.build();
  }

  mount(): void {
    this.placeHost();
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.applySettings();
  }

  dispose(): void {
    this.resumeIfWePaused();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.documentElement.classList.remove('nrk-ov-panel-open');
    this.host.remove();
  }

  updateSettings(settings: ExtensionSettings): void {
    this.settings = settings;
    this.applySettings();
  }

  /** The panel only appears while there is a player on the page */
  setVideo(video: HTMLVideoElement | null): void {
    this.video = video;
    this.pausedByPanel = false;
    this.applySettings();
  }

  reset(): void {
    this.rows.clear();
    this.ordered = [];
    this.activeIds.clear();
    this.list.replaceChildren();
    this.lastTime = 0;
    this.detached = false;
    this.updateEmpty();
  }

  /** `timeline` is the tracker's full, sorted list; used to place new rows */
  addCaptions(added: Caption[], timeline: readonly Caption[]): void {
    for (const caption of added) {
      if (this.rows.has(caption.id)) {
        continue;
      }
      const row = this.createRow(caption);
      const index = timeline.indexOf(caption);
      // Rows are kept in timeline order; find the first later row that exists
      let before: Row | undefined;
      for (let i = index + 1; i < timeline.length && !before; i++) {
        before = this.rows.get(timeline[i].id);
      }
      this.rows.set(caption.id, row);
      if (before) {
        this.list.insertBefore(row.element, before.element);
        this.ordered.splice(this.ordered.indexOf(before), 0, row);
      } else {
        this.list.appendChild(row.element);
        this.ordered.push(row);
      }
      row.element.hidden = caption.start > this.lastTime;
    }
    this.updateEmpty();
  }

  setTranslation(caption: Caption, translation: string): void {
    const row = this.rows.get(caption.id);
    if (row) {
      row.translation.textContent = translation;
      row.translation.classList.remove('pending');
    }
  }

  setActive(active: readonly Caption[]): void {
    for (const id of this.activeIds) {
      this.rows.get(id)?.element.classList.remove('active');
    }
    this.activeIds = new Set(active.map((c) => c.id));
    for (const caption of active) {
      const row = this.rows.get(caption.id);
      if (row) {
        row.element.classList.add('active');
        row.element.hidden = false;
      }
    }
    this.updateEmpty();
    this.followPlayhead();
  }

  /** Reveal lines whose start has been reached; hide ones after a backwards seek */
  tick(time: number): void {
    this.lastTime = time;
    let changed = false;
    for (const row of this.ordered) {
      const hidden = row.caption.start > time && !this.activeIds.has(row.caption.id);
      if (row.element.hidden !== hidden) {
        row.element.hidden = hidden;
        changed = true;
      }
    }
    if (changed) {
      this.updateEmpty();
      this.followPlayhead();
    }
  }

  setStatus(text: string): void {
    this.footer.textContent = text;
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = STYLES;

    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    this.panel.innerHTML = `
      <header>
        <h1>Undertekster</h1>
        <button data-toggle="showOriginal" title="Show NRK's Norwegian subtitles on the video">NO</button>
        <button data-toggle="showTranslation" title="Show the translation on the video">EN</button>
        <button data-toggle="pauseOnHover" title="Pause while the pointer is over this panel">Pause on hover</button>
        <button data-action="collapse" title="Hide panel">»</button>
      </header>
      <div class="empty">Lines will appear here as they are spoken.</div>
      <ol></ol>
      <footer></footer>`;
    this.list = this.panel.querySelector('ol')!;
    this.empty = this.panel.querySelector('.empty')!;
    this.footer = this.panel.querySelector('footer')!;

    this.panel.querySelectorAll<HTMLButtonElement>('button[data-toggle]').forEach((button) => {
      const key = button.dataset.toggle as 'showOriginal' | 'showTranslation' | 'pauseOnHover';
      this.toggles[key] = button;
      button.addEventListener('click', () => this.callbacks.onSettingsChange({ [key]: !this.settings[key] }));
    });
    this.panel.querySelector('[data-action="collapse"]')!.addEventListener('click', () => {
      this.callbacks.onSettingsChange({ panelEnabled: false });
    });

    this.tab = document.createElement('button');
    this.tab.className = 'tab';
    this.tab.textContent = 'Undertekster «';
    this.tab.title = 'Show subtitle history';
    this.tab.addEventListener('click', () => this.callbacks.onSettingsChange({ panelEnabled: true }));

    this.list.addEventListener('scroll', () => {
      const latest = this.latestVisibleRow();
      if (latest) {
        const row = latest.element.getBoundingClientRect();
        const list = this.list.getBoundingClientRect();
        this.detached = row.bottom < list.top || row.top > list.bottom;
      }
    });
    this.panel.addEventListener('pointerenter', () => this.onEnter());
    this.panel.addEventListener('pointerleave', () => this.onLeave());

    this.root.append(style, this.panel, this.tab);
    this.updateEmpty();
  }

  private createRow(caption: Caption): Row {
    const element = document.createElement('li');
    const time = document.createElement('button');
    time.className = 'time';
    time.textContent = formatTime(caption.start);
    time.title = 'Replay from this line';
    time.addEventListener('click', () => this.callbacks.onSeek(caption.start));
    const original = document.createElement('div');
    original.className = 'no';
    original.textContent = caption.text;
    original.lang = 'no';
    const translation = document.createElement('div');
    translation.className = 'en pending';
    translation.textContent = '…';
    element.append(time, original, translation);
    return { caption, element, translation };
  }

  private applySettings(): void {
    const present = this.video !== null;
    const open = present && this.settings.panelEnabled;
    this.panel.hidden = !open;
    this.tab.hidden = !present || open;
    document.documentElement.style.setProperty('--nrk-ov-panel-width', `${PANEL_WIDTH}px`);
    document.documentElement.classList.toggle('nrk-ov-panel-open', open && !document.fullscreenElement);
    for (const [key, button] of Object.entries(this.toggles)) {
      button.setAttribute('aria-pressed', String(Boolean(this.settings[key as keyof ExtensionSettings])));
    }
    if (!open) {
      this.resumeIfWePaused();
    }
  }

  /** In fullscreen only the fullscreen element is drawn, so the panel has to move into it */
  private placeHost(): void {
    const parent = document.fullscreenElement || document.body;
    if (this.host.parentElement !== parent) {
      parent.appendChild(this.host);
    }
    this.applySettings();
  }

  private onEnter(): void {
    this.hovering = true;
    if (this.settings.pauseOnHover && this.video && !this.video.paused) {
      this.video.pause();
      this.pausedByPanel = true;
    }
  }

  private onLeave(): void {
    this.hovering = false;
    this.resumeIfWePaused();
    this.followPlayhead();
  }

  private resumeIfWePaused(): void {
    if (this.pausedByPanel && this.video && this.video.paused) {
      this.video.play().catch(() => {
        // The page may refuse without activation; the viewer can press play
      });
    }
    this.pausedByPanel = false;
  }

  /** Keep the newest line in view, unless the viewer is reading back through history */
  private followPlayhead(): void {
    const target = this.latestVisibleRow();
    if (!target || this.hovering || this.detached) {
      return;
    }
    // Set scrollTop directly: scrollIntoView would also scroll NRK's page
    const element = target.element;
    this.list.scrollTop = element.offsetTop - this.list.clientHeight / 2 + element.offsetHeight / 2;
  }

  private latestVisibleRow(): Row | undefined {
    for (let i = this.ordered.length - 1; i >= 0; i--) {
      if (!this.ordered[i].element.hidden) {
        return this.ordered[i];
      }
    }
    return undefined;
  }

  private updateEmpty(): void {
    this.empty.hidden = this.ordered.some((r) => !r.element.hidden);
  }
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
