import { MODE_OPTIONS, ModeChoice } from '../core/modes.js';

/**
 * Render the Off / Dual / Learning cards into `container`. Returns a setter for
 * the selected card, so the page can follow changes made elsewhere (e.g. from
 * NRK's subtitle menu).
 */
export function renderModePicker(
  container: HTMLElement,
  onChoose: (choice: ModeChoice) => void
): (choice: ModeChoice) => void {
  container.classList.add('modes');
  container.setAttribute('role', 'radiogroup');
  const inputs: HTMLInputElement[] = [];

  for (const option of MODE_OPTIONS) {
    const label = document.createElement('label');
    label.className = 'mode';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'mode';
    input.value = option.value;
    input.addEventListener('change', () => input.checked && onChoose(option.value));

    const title = document.createElement('span');
    title.className = 'mode-label';
    title.textContent = option.label;

    const description = document.createElement('span');
    description.className = 'mode-description';
    description.textContent = option.description;

    label.append(input, title, description);
    container.appendChild(label);
    inputs.push(input);
  }

  return (choice) => {
    for (const input of inputs) {
      input.checked = input.value === choice;
    }
  };
}
