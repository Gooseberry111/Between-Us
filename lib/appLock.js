import * as SecureStore from "expo-secure-store";

/*
 * ==========================================
 * APP LOCK
 * ==========================================
 *
 * Face ID, Touch ID or fingerprint before the app opens,
 * for a space this private. Off until switched on in
 * Profile; the choice lives on this phone only.
 *
 * In Expo Go on iPhone, Apple keeps Face ID for real apps,
 * so the phone asks for its passcode instead.
 */

const KEY = "between-us.app-lock";

/* A native module: a build without it simply has no lock. */
let Auth = null;

try {
  Auth = require("expo-local-authentication");
} catch {
  Auth = null;
}

const listeners = new Set();

export function onLockSettingChanged(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/* Whether this phone can lock the app at all. */
export async function lockAvailable() {
  if (!Auth) return false;

  try {
    return (await Auth.hasHardwareAsync()) && (await Auth.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function lockEnabled() {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}

/* Resolves true when the person proves it is them. */
export async function unlock(promptMessage = "Open Between Us") {
  if (!Auth) return true;

  try {
    const result = await Auth.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
    });

    return Boolean(result?.success);
  } catch {
    return false;
  }
}

/*
 * Switching it on asks first, so nobody locks themselves
 * out with a face or finger the phone does not know.
 */
export async function setLockEnabled(enabled) {
  if (enabled) {
    if (!(await lockAvailable())) {
      throw new Error(
        "Set up Face ID, Touch ID or a fingerprint on this phone first.",
      );
    }

    if (!(await unlock("Turn on the lock"))) return false;
  }

  await SecureStore.setItemAsync(KEY, enabled ? "1" : "0");

  listeners.forEach((listener) => listener(enabled));

  return true;
}
