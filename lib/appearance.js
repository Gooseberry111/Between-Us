import { useEffect } from "react";
import { AppState, Appearance, DevSettings } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";

import { APPEARANCE, APPEARANCE_KEY, SCHEME } from "./theme";

/*
 * ==========================================
 * APPEARANCE
 * ==========================================
 *
 * System, Light or Dark, kept on this phone. The whole
 * app is styled as it opens, so a change saves the choice,
 * sets (or clears) the window's override, and reloads --
 * a blink, then the new look everywhere.
 */

export const APPEARANCES = ["system", "light", "dark"];

/* What was chosen, which can differ from what is showing
 * until the reload lands. */
export function savedAppearance() {
  try {
    const value = SecureStore.getItem(APPEARANCE_KEY);

    return APPEARANCES.includes(value) ? value : "system";
  } catch {
    return APPEARANCE;
  }
}

async function reload() {
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    try {
      DevSettings.reload();
      return true;
    } catch {
      return false;
    }
  }
}

/* Resolves false if the app could not reload itself. */
export async function setAppearance(value) {
  if (!APPEARANCES.includes(value)) return true;

  SecureStore.setItem(APPEARANCE_KEY, value);

  try {
    Appearance.setColorScheme(value === "system" ? "unspecified" : value);
  } catch {
    /* the reload still picks the right palette */
  }

  /* Let the window's new style settle before reading it again. */
  await new Promise((resolve) => setTimeout(resolve, 300));

  return reload();
}

/*
 * In System mode, follow the phone when it changes mode
 * (sunset, Control Centre) -- but only as you come back
 * to the app, never halfway through something you typed.
 */
export function useFollowSystem() {
  useEffect(() => {
    if (APPEARANCE !== "system") return undefined;

    let pending = false;

    const change = Appearance.addChangeListener(({ colorScheme }) => {
      pending = (colorScheme === "dark" ? "dark" : "light") !== SCHEME;
    });

    const state = AppState.addEventListener("change", (next) => {
      if (next === "active" && pending) reload();
    });

    return () => {
      change.remove();
      state.remove();
    };
  }, []);
}
