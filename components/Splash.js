import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { T } from "../lib/theme";
import { Glow, motionAllowed } from "./ui";

/*
 * ==========================================
 * SPLASH
 * ==========================================
 *
 * What the app opens on: the two rings from the icon,
 * yours and theirs, drifting in from either side until
 * they overlap, one slow breath, then the name.
 *
 * The launch screen underneath is the same light ground,
 * so there is no flash between the two. Reduce Motion
 * gets the finished picture straight away.
 */

const SIZE = 74;
const OVERLAP = SIZE * 0.34;
const APART = 46;

export default function Splash({ leaving }) {
  const meet = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let live = true;

    motionAllowed().then((allowed) => {
      if (!live) return;

      if (!allowed) {
        meet.setValue(1);
        word.setValue(1);
        return;
      }

      Animated.sequence([
        Animated.spring(meet, {
          toValue: 1,
          friction: 7,
          tension: 38,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(breath, {
              toValue: 1.07,
              duration: 420,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(breath, {
              toValue: 1,
              duration: 520,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(word, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    return () => {
      live = false;
    };
  }, [meet, breath, word]);

  /* Fade the whole thing away once the app is ready. */
  useEffect(() => {
    if (!leaving) return;

    Animated.timing(fade, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [leaving, fade]);

  const slide = (direction) =>
    meet.interpolate({
      inputRange: [0, 1],
      outputRange: [direction * APART, 0],
    });

  return (
    <Animated.View
      style={[styles.screen, { opacity: fade }]}
      pointerEvents={leaving ? "none" : "auto"}
    >
      <Glow height={520} />

      <View style={styles.centre}>
        <Animated.View
          style={[styles.mark, { transform: [{ scale: breath }] }]}
        >
          <Animated.View
            style={[
              styles.ring,
              styles.ringYou,
              {
                opacity: meet,
                transform: [{ translateX: slide(-1) }],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.ring,
              styles.ringThem,
              {
                opacity: meet,
                transform: [{ translateX: slide(1) }],
              },
            ]}
          />
        </Animated.View>

        <Animated.Text
          style={[
            styles.word,
            {
              opacity: word,
              transform: [
                {
                  translateY: word.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Between Us
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: T.appBackground,
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
  },

  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
  },

  ringYou: {
    backgroundColor: "rgba(217,87,122,0.14)",
    borderColor: T.you,
    marginRight: -OVERLAP,
  },

  ringThem: {
    backgroundColor: "rgba(74,45,92,0.12)",
    borderColor: T.accent,
  },

  word: {
    fontFamily: "ui-serif",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600",
    letterSpacing: -0.6,
    color: T.label,
    marginTop: 26,
  },
});
