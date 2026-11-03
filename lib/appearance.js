import { DevSettings } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";

import { APPEARANCE, APPEARANCE_KEY } from "./theme";

/*
 * ==========================================
 * APPEARANCE
 * ==========================================
 *
 * System, Light or Dark, kept on this phone. The whole
 * app is styled as it opens, so a change saves the choice
 * and reloads -- a blink, then the new look everywhere.
 */

export const APPEARANCES = ["system", "light", "dark"];

export function currentAppearance() {
  return APPEARANCE;
}

export async function setAppearance(value) {
  if (!APPEARANCES.includes(value) || value === APPEARANCE) return;

  await SecureStore.setItemAsync(APPEARANCE_KEY, value);

  try {
    await Updates.reloadAsync();
  } catch {
    /* In development there is no update to reload into. */
    try {
      DevSettings.reload();
    } catch {
      /* It applies the next time the app opens. */
    }
  }
}
