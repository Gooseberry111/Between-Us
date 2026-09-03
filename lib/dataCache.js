/*
 * ==========================================
 * DATA CACHE
 * ==========================================
 *
 * A tiny in-memory cache shared across screens
 * for the lifetime of the app session.
 *
 * The problem it solves: screens you navigate to
 * with router.push() (Goals, Special Dates,
 * Notifications, Connection, completed lists, ...)
 * remount from scratch every visit, so they used
 * to show a blocking "Loading..." spinner every
 * single time even if you were just there a second
 * ago.
 *
 * With this, a screen can show what it fetched last
 * time immediately, then quietly refetch in the
 * background and update once the real data is back.
 * Only a screen's very first-ever load (nothing
 * cached yet) still shows a spinner.
 *
 * This intentionally resets when the app restarts —
 * it's a short-lived "stay fresh across navigation"
 * cache, not persisted storage.
 */

const cache = new Map();

export function getCachedData(key) {
  return cache.has(key) ? cache.get(key) : undefined;
}

export function setCachedData(key, data) {
  cache.set(key, data);
}

export function clearCachedData(key) {
  cache.delete(key);
}
