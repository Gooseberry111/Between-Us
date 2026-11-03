/*
 * ==========================================
 * HUGS
 * ==========================================
 *
 * A tiny signal for "play the hug". Anything can ask for
 * it -- a push arriving, a tap on the notification, an
 * unread hug on Home -- and the one overlay at the root
 * plays it.
 */

const listeners = new Set();

export function onHug(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function playHug({ from } = {}) {
  listeners.forEach((listener) => listener({ from }));
}

/*
 * The smaller signals -- a kiss, "miss you", "proud of
 * you", "thinking of you" -- play the same way, through
 * their own overlay.
 */
const tapListeners = new Set();

export function onTap(listener) {
  tapListeners.add(listener);

  return () => tapListeners.delete(listener);
}

export function playTap({ kind, from } = {}) {
  tapListeners.forEach((listener) => listener({ kind, from }));
}
