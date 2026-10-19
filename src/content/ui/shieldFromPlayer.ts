const PLAYER_EVENTS = ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'];

/**
 * Keep clicks on our controls from reaching NRK's player, which would otherwise
 * also toggle play/pause or fullscreen. Listeners still fire on the target itself.
 */
export function shieldFromPlayer(element: HTMLElement): void {
  for (const type of PLAYER_EVENTS) {
    element.addEventListener(type, (event) => event.stopPropagation());
  }
}
