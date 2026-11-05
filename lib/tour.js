/*
 * ==========================================
 * TOUR
 * ==========================================
 *
 * The walkthrough is mounted once at the root; Home asks
 * for it the first time a couple is linked, and Settings
 * whenever someone wants to see it again.
 */

const listeners = new Set();

export function onTour(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function openTour() {
  listeners.forEach((listener) => listener());
}
