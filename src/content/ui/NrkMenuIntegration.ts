import { MODE_OPTIONS, ModeChoice } from '../../core/modes.js';

/** NRK's subtitle dialog ("Valg for undertekster og tilgjengelighet") */
const DIALOG = 'dialog[data-testid="player-subtitle-settings-dialog"][open]';
const SECTION_ATTR = 'data-nrk-oversetter-menu';
const MENU_POLL_MS = 400;

/** NRK's own radio glyphs, so our options look like theirs */
const RADIO_OFF =
  '<path fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14" clip-rule="evenodd" opacity=".5"></path>';
const RADIO_ON =
  '<path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8"></path><path fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14" clip-rule="evenodd"></path>';

/**
 * Adds our modes to NRK's own subtitle menu, next to "Av / Norsk", so the choice
 * lives where viewers already look for subtitle options - including in fullscreen,
 * where the extension popup is out of reach.
 *
 * The dialog is rendered by NRK on demand and may be re-rendered at any time, so
 * we check for it on a short poll and re-insert our section whenever it is
 * missing. The markup borrows NRK's utility classes to match their styling; if
 * those change, our section still works, it just looks plainer.
 */
export class NrkMenuIntegration {
  private timer: number | null = null;
  private current: ModeChoice = 'off';

  constructor(private readonly onChoose: (choice: ModeChoice) => void) {}

  start(): void {
    this.timer = window.setInterval(() => this.ensureSection(), MENU_POLL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((el) => el.remove());
  }

  setCurrent(choice: ModeChoice): void {
    this.current = choice;
    document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((section) => this.markSelected(section as HTMLElement));
  }

  private ensureSection(): void {
    const dialog = document.querySelector(DIALOG);
    if (!dialog || dialog.querySelector(`[${SECTION_ATTR}]`)) {
      return;
    }
    // The column holding "Undertekst" and "Tilgjengelighet"; we go between them
    const firstSection = dialog.querySelector('.scroll-container > div > div');
    if (!firstSection || !firstSection.parentElement) {
      return;
    }
    firstSection.parentElement.insertBefore(this.buildSection(), firstSection.nextSibling);
  }

  private buildSection(): HTMLElement {
    const section = document.createElement('div');
    section.setAttribute(SECTION_ATTR, '');
    section.className = 'margin-bottom-m';

    const heading = document.createElement('h3');
    heading.className = 'text-style-subhead1 color-white';
    heading.textContent = 'Oversetter';

    const list = document.createElement('ol');
    list.className = 'margin-top-s padding-0 list-style-none display-flex flex-direction-column gap-xxs';
    list.style.cssText = 'padding-left: 0.125rem; padding-right: 0.125rem;';

    for (const option of MODE_OPTIONS) {
      const item = document.createElement('li');
      item.className = 'width-100%';
      item.style.marginRight = '-0.125rem';

      const button = document.createElement('button');
      // Inside NRK's <form method="dialog">: anything but type=button would close it
      button.type = 'button';
      button.dataset.mode = option.value;
      button.className =
        'selectable-button text-style-subhead1 text-style-subhead2 width-100% display-flex justify-content-space-between gap-s';
      button.style.textAlign = 'left';

      const text = document.createElement('span');
      // NRK's buttons never shrink or wrap their label, so a long one pushes the
      // radio past the dialog edge (theirs too). Let ours wrap instead.
      text.style.cssText = 'flex: 1 1 auto; min-width: 0; white-space: normal; overflow-wrap: anywhere;';
      text.textContent = option.label;
      const description = document.createElement('span');
      description.textContent = option.description;
      description.style.cssText = 'display: block; font-size: 0.75em; font-weight: normal; opacity: 0.7;';
      text.appendChild(description);

      const icon = document.createElement('span');
      icon.className = 'pointer-events-none';
      // Long descriptions would otherwise squeeze the radio glyph to nothing
      icon.style.cssText = 'font-size: 1rem; flex: none;';
      icon.innerHTML = `<span role="img" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" width="1.5em" height="1.5em"></svg></span>`;

      button.append(text, icon);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.onChoose(option.value);
      });
      item.appendChild(button);
      list.appendChild(item);
    }

    section.append(heading, list);
    this.markSelected(section);
    return section;
  }

  private markSelected(section: HTMLElement): void {
    section.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((button) => {
      const selected = button.dataset.mode === this.current;
      button.setAttribute('aria-current', String(selected));
      button.toggleAttribute('data-visually-selected', selected);
      const svg = button.querySelector('svg');
      if (svg) {
        svg.innerHTML = selected ? RADIO_ON : RADIO_OFF;
      }
    });
  }
}
