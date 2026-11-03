/*
 * ==========================================
 * FAR APART
 * ==========================================
 *
 * Time zones and the countdown to the next time you
 * meet, shared by Home and the Far Apart screen.
 */

export function myTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function timeIn(zone) {
  try {
    return new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: zone || undefined,
    });
  } catch {
    return null;
  }
}

export function daysUntil(iso) {
  if (!iso) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000,
  );
}
