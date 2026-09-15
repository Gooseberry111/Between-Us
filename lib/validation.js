/*
 * ==========================================
 * VALIDATION
 * ==========================================
 */

/* Matches the API, which enforces the same limit. */
export const MINIMUM_AGE = 17;

/*
 * Returns a human message if the birthday is wrong,
 * or null if it is a real, past calendar date.
 *
 * The API only checked the YYYY-MM-DD shape, so a
 * date like 2003-13-45 passed every check until the
 * database refused it -- and onboarding only saves on
 * its final question, so people hit that error after
 * answering everything else.
 */
export function birthdayError(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "Enter your full birthday as YYYY-MM-DD.";
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  /* Rejects impossible dates like February 30th, which
   * JavaScript would otherwise quietly roll forward. */
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "That date doesn't exist. Check the month and day.";
  }

  if (date > new Date()) {
    return "Your birthday can't be in the future.";
  }

  if (year < 1900) {
    return "Check the year — that seems too far back.";
  }

  const today = new Date();
  let age = today.getUTCFullYear() - year;

  if (
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)
  ) {
    age -= 1;
  }

  if (age < MINIMUM_AGE) {
    return `You need to be at least ${MINIMUM_AGE} to use Between Us.`;
  }

  return null;
}
