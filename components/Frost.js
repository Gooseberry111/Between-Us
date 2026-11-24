import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

import { T, themedStyles, useTheme } from "../lib/theme";

/*
 * ==========================================
 * FROST
 * ==========================================
 *
 * A thin pane of glass: what is behind stays there, softly
 * out of focus, rather than washed out. Used behind the
 * wheels on Home. Lighter than the menu's pane and with no
 * wash of colour, so it reads as glass, not fog.
 *
 * iPhone gets a real blur. Android blurs only through a
 * target outside the view (the menu's sits outside the
 * app); Home is inside that target, so a blur here would
 * try to blur itself. It gets a clear tinted pane instead.
 */
export default function Frost({ style }) {
  useTheme();

  if (Platform.OS !== "ios") {
    return <View style={[StyleSheet.absoluteFill, styles.clear, style]} />;
  }

  return (
    <BlurView
      style={[StyleSheet.absoluteFill, style]}
      tint={
        T.dark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"
      }
      intensity={60}
    />
  );
}

const styles = themedStyles(() => ({
  clear: {
    backgroundColor: T.dark ? "rgba(18,14,22,0.55)" : "rgba(255,255,255,0.5)",
  },
}));
