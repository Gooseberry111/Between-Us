/*
 * ==========================================
 * MENU
 * ==========================================
 *
 * The side menu is mounted once at the root; any screen's
 * ☰ button opens it through here.
 */

const listeners = new Set();

export function onMenu(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function openMenu() {
  listeners.forEach((listener) => listener(true));
}

export function closeMenu() {
  listeners.forEach((listener) => listener(false));
}
