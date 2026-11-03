import { useEffect } from "react";
import { AppState, Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

import { APPEARANCE, APPEARANCE_KEY, applyScheme } from "./theme";

/*
 * ==========================================
 * APPEARANCE
 * ==========================================
 *
 * System, Light or Dark, kept on this phone. A change
 * saves the choice, sets (or clears) the window's
 * override so keyboards and system sheets follow, and
 * repaints the app on the spot.
 */

export const APPEARANCES = ["system", "light", "dark"];

let chosen = APPEARANCE;

export function savedAppearance() {
  return chosen;
}

const phone = () => (Appearance.getColorScheme() === "dark" ? "dark" : "light");

export function setAppearance(value) {
  if (!APPEARANCES.includes(value)) return;

  chosen = value;

  try {
    SecureStore.setItem(APPEARANCE_KEY, value);
  } catch {
    /* still applies for now */
  }

  try {
    Appearance.setColorScheme(value === "system" ? "unspecified" : value);
  } catch {
    /* the palette still follows */
  }

  if (value !== "system") {
    applyScheme(value);
    return;
  }

  /* Back to the phone's own: it answers once the override
   * has cleared, and the listener below catches it too. */
  applyScheme(phone());
  setTimeout(() => {
    if (chosen === "system") applyScheme(phone());
  }, 250);
}

/*
 * In System mode, follow the phone as it changes (sunset,
 * Control Centre). Changes reported while the app is in
 * the background are ignored -- iOS flips modes there to
 * take its snapshots -- and the real one is read on return.
 */
export function useFollowSystem() {
  useEffect(() => {
    const change = Appearance.addChangeListener(({ colorScheme }) => {
      if (chosen !== "system" || AppState.currentState !== "active") return;

      applyScheme(colorScheme === "dark" ? "dark" : "light");
    });

    const state = AppState.addEventListener("change", (next) => {
      if (next === "active" && chosen === "system") applyScheme(phone());
    });

    return () => {
      change.remove();
      state.remove();
    };
  }, []);
}
