/*
 * ==========================================
 * MENU
 * ==========================================
 *
 * The side menu is mounted once at the root; any screen's
 * ☰ button opens it through here.
 */

import { createRef } from "react";

const listeners = new Set();

/* What the menu's frosted glass blurs on Android: the
 * screens, wrapped once at the root. */
export const menuBlurTarget = createRef();

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
