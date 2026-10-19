import { ModeChoice } from '../../core/modes.js';
import { shieldFromPlayer } from './shieldFromPlayer.js';

const PROMPT_POLL_MS = 1000;

const PROMPT_STYLES = `
:host { all: initial; }
.card {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  width: min(440px, calc(100% - 32px)); z-index: 3;
  padding: 16px 18px; border-radius: 12px;
  background: rgba(20, 20, 20, 0.94); color: #eee; border: 1px solid #333;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
h2 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
p { margin: 0 0 12px; color: #aaa; font-size: 13px; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
button {
  font: inherit; cursor: pointer; text-align: left;
  padding: 10px 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #eee;
}
button:hover, button:focus-visible { border-color: #ffd700; outline: none; }
button strong { display: block; font-size: 14px; }
button span { display: block; font-size: 12px; color: #999; margin-top: 2px; }
.later { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.later small { color: #888; font-size: 12px; }
.later button { flex: none; padding: 6px 12px; text-align: center; white-space: nowrap; }
`;

/**
 * Shown once, on a fresh install, the first time a player appears: offers the two
 * modes or "Not now". Choosing a mode is a real click on the page, which is the
 * user activation Chrome needs to download the translation model, so the download
 * can start straight away rather than waiting for some later, unexplained click.
 */
export class FirstRunPrompt {
  private host: HTMLDivElement | null = null;
  private timer: number | null = null;
  private language = 'English';

  constructor(private readonly onChoose: (choice: ModeChoice) => void) {}

  show(language: string): void {
    this.language = language;
    if (this.timer === null) {
      this.attach();
      this.timer = window.setInterval(() => this.attach(), PROMPT_POLL_MS);
    }
  }

  hide(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.host?.remove();
    this.host = null;
  }

  /** The player comes and goes with navigation; follow it */
  private attach(): void {
    const player = document.querySelector('tv-player');
    if (!player) {
      return;
    }
    if (!this.host) {
      this.host = this.build();
    }
    if (this.host.parentElement !== player) {
      player.appendChild(this.host);
    }
  }

  private build(): HTMLDivElement {
    const host = document.createElement('div');
    host.id = 'nrk-oversetter-first-run';
    shieldFromPlayer(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${PROMPT_STYLES}</style>
      <div class="card" role="dialog" aria-label="NRK TV Oversetter">
        <h2>Translate the subtitles into ${escapeHtml(this.language)}?</h2>
        <p>The translation runs on your computer. It downloads once, then works offline.</p>
        <div class="choices">
          <button data-choice="dual"><strong>Dual subtitles</strong><span>${escapeHtml(this.language)} under the Norwegian, on the video</span></button>
          <button data-choice="learning"><strong>Learning panel</strong><span>Norwegian on the side, ${escapeHtml(this.language)} when you hover</span></button>
        </div>
        <div class="later">
          <small>You can change this later under "Oversetter" in the subtitle menu.</small>
          <button data-choice="off">Not now</button>
        </div>
      </div>`;
    root.querySelectorAll<HTMLButtonElement>('button[data-choice]').forEach((button) => {
      button.addEventListener('click', () => this.onChoose(button.dataset.choice as ModeChoice));
    });
    return host;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
