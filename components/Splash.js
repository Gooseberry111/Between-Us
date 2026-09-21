import { StyleSheet, Text, View } from "react-native";

import { GlassBackground } from "./Glass";

/*
 * ==========================================
 * SPLASH
 * ==========================================
 *
 * The first thing the app shows while it works out
 * whether anyone is signed in: the name, on the same
 * ground every other screen uses, so the hand-off to
 * Home is seamless rather than a cut between two
 * different-looking screens.
 */

export default function Splash() {
  return (
    <View style={styles.screen}>
      <GlassBackground>
        <View style={styles.centre}>
          <Text style={styles.word}>Between Us</Text>
        </View>
      </GlassBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFF8F5",
    zIndex: 200,
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  word: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#D9456B",
  },
});
