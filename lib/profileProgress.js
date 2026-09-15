import { questions } from "../components/onboarding/questions";

/*
 * ==========================================
 * PROFILE PROGRESS
 * ==========================================
 *
 * Onboarding can be skipped once the essentials are in,
 * so a profile can exist with questions still unanswered.
 * Home uses this to nudge people back to finish.
 */

export const TOTAL_QUESTIONS = questions.length;

export function isAnswered(value) {
  if (Array.isArray(value)) return value.length > 0;

  return String(value || "").trim().length > 0;
}

export function countAnswered(answers) {
  if (!answers) return 0;

  return questions.filter((question) => isAnswered(answers[question.id]))
    .length;
}

/*
 * The auth guard only checks for a profile once per sign-in,
 * so after onboarding saves it would still think there is no
 * profile and bounce the user straight back. Saving announces
 * itself here instead.
 */
const listeners = new Set();

export function onProfileSaved(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function notifyProfileSaved() {
  listeners.forEach((listener) => listener());
}
