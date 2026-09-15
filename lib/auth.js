/*
 * ==========================================
 * AUTH STORAGE KEYS
 * ==========================================
 *
 * Shared so the welcome screen and the auth guard
 * cannot drift apart on the spelling of a key.
 */

/*
 * Set once someone has signed in on this device.
 * It only records that an account exists here, never
 * who it belongs to, so the welcome screen can offer
 * "sign in" instead of pitching the app again.
 */
export const RETURNING_USER_KEY = "betweenus_has_account";
