/*
 * ==========================================
 * LIVE
 * ==========================================
 *
 * When something arrives while the app is open -- their
 * move, a note, a date to say yes to -- the system banner
 * stays quiet and the screen showing it refreshes instead.
 * The root's notification listener calls `announce`; any
 * screen can `onLive` to hear it.
 */

const listeners = new Set();

export function onLive(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function announce(type, data = {}) {
  listeners.forEach((listener) => {
    try {
      listener(type, data);
    } catch {
      /* one screen's trouble is not another's */
    }
  });
}
