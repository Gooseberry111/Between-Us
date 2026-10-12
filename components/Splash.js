import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { T } from "../lib/theme";

/*
 * ==========================================
 * SPLASH
 * ==========================================
 *
 * The first thing the app shows while it works out
 * whether anyone is signed in.
 *
 * The mark is the idea of the app rather than a logo:
 * two circles, yours and theirs, overlapping. The
 * ground is the Bubblegum gradient -- your purple,
 * through the accent, into the sky.
 */

export default function Splash() {
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={T.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.centre}>
        <View style={styles.mark}>
          <View style={[styles.circle, styles.circleYou]} />

          <View style={[styles.circle, styles.circleThem]} />
        </View>

        <Text style={styles.word}>Between Us</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.accent,
    zIndex: 200,
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  mark: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
  },

  circleYou: {
    backgroundColor: "rgba(255,255,255,0.18)",
    marginRight: -22,
  },

  circleThem: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  word: {
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -0.6,
    color: "#FFFFFF",
  },
});
