import { apiFetch } from "./api";
import { isAnswered } from "./profileProgress";

/*
 * ==========================================
 * YOUR ANSWERS
 * ==========================================
 *
 * The answers from onboarding, as one object, and the
 * two calls that read and write them. Onboarding walks
 * through them in order; the Your Answers page changes
 * any one in place. Saving always sends the whole set,
 * because that is what the API stores.
 */

export const EMPTY_ANSWERS = {
  firstName: "",
  lastName: "",
  nickname: "",
  birthday: "",
  gender: "",
  country: "",
  relationshipStatus: "",
  personalityType: "",
  communicationStyle: "",
  conflictStyle: "",
  affectionStyle: "",
  loveLanguages: [],
  favoriteFood: "",
  favoriteSnack: "",
  favoriteDrink: "",
  favoriteColor: "",
  musicGenre: "",
  movieGenre: "",
  focusAreas: [],
};

/* Resolves to { exists, answers } with every key present. */
export async function loadAnswers(userId) {
  const response = await apiFetch(`/users/${userId}/onboarding`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Unable to load your answers.");
  }

  const answers = { ...EMPTY_ANSWERS };

  if (data?.exists) {
    Object.keys(EMPTY_ANSWERS).forEach((key) => {
      if (isAnswered(data.answers?.[key])) answers[key] = data.answers[key];
    });
  }

  return { exists: Boolean(data?.exists), answers };
}

export async function saveAnswers({ userId, email, answers }) {
  const response = await apiFetch(`/onboarding`, {
    method: "POST",
    body: JSON.stringify({
      clerk_id: userId,
      email: email || "",
      ...Object.fromEntries(
        Object.keys(EMPTY_ANSWERS).map((key) => [key, answers[key]]),
      ),
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Unable to save your answers.");
  }

  return data;
}
