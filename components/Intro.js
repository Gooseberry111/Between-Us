import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { DancingScript_600SemiBold } from "@expo-google-fonts/dancing-script";

/*
 * ==========================================
 * INTRO
 * ==========================================
 *
 * "Between Us" drawn on, left to right, as though
 * someone is writing it.
 *
 * There is no handwriting engine here: the words are
 * laid out once, measured, and then revealed through a
 * widening window with a soft nib travelling along the
 * leading edge. Against a script face that reads as
 * writing, and it costs one font file rather than a
 * native drawing library.
 *
 * It plays once per cold start. Coming back to the app
 * from the background should not make anyone sit
 * through it again.
 */

let alreadyPlayed = false;

export function introHasPlayed() {
  return alreadyPlayed;
}

export default function Intro({ onDone }) {
  const [fontsLoaded] = useFonts({ DancingScript_600SemiBold });

  const [textWidth, setTextWidth] = useState(0);

  const reveal = useRef(new Animated.Value(0)).current;
  const nib = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!fontsLoaded || !textWidth) return;

    /* Writing speed scales with the width, so the stroke
     * moves at the same pace on a small phone as a large one. */
    const duration = Math.min(2000, Math.max(1100, textWidth * 5));

    Animated.sequence([
      Animated.delay(180),

      Animated.parallel([
        Animated.timing(reveal, {
          toValue: 1,
          duration,
          easing: Easing.bezier(0.35, 0, 0.25, 1),
          useNativeDriver: false,
        }),
        Animated.timing(nib, {
          toValue: 1,
          duration,
          easing: Easing.bezier(0.35, 0, 0.25, 1),
          useNativeDriver: true,
        }),
      ]),

      /* A beat to read it. */
      Animated.delay(420),

      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;

      alreadyPlayed = true;

      onDone?.();
    });
  }, [fontsLoaded, textWidth, reveal, nib, fade, lift, onDone]);

  /* If the font never arrives, don't hold the app hostage. */
  useEffect(() => {
    const bail = setTimeout(() => {
      if (!alreadyPlayed) {
        alreadyPlayed = true;
        onDone?.();
      }
    }, 4500);

    return () => clearTimeout(bail);
  }, [onDone]);

  return (
    <Animated.View
      style={[
        styles.screen,
        {
          opacity: fade,
          transform: [
            {
              scale: lift.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.04],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.centre}>
        {/* Measured once, off-view, so the window knows how
            wide the words are before anything moves. */}
        <Text
          style={[styles.word, styles.measure]}
          onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
        >
          Between Us
        </Text>

        {fontsLoaded && textWidth ? (
          <View style={{ width: textWidth }}>
            <Animated.View
              style={[
                styles.window,
                {
                  width: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, textWidth],
                  }),
                },
              ]}
            >
              <Text style={[styles.word, { width: textWidth }]}>
                Between Us
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.nib,
                {
                  transform: [
                    {
                      translateX: nib.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, textWidth],
                      }),
                    },
                  ],
                  opacity: reveal.interpolate({
                    inputRange: [0, 0.9, 1],
                    outputRange: [1, 1, 0],
                  }),
                },
              ]}
            />
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.ruleWrap,
            {
              opacity: reveal.interpolate({
                inputRange: [0, 0.65, 1],
                outputRange: [0, 0, 1],
              }),
            },
          ]}
        >
          <View style={styles.rule} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFF8F5",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },

  centre: {
    alignItems: "center",
  },

  word: {
    fontFamily: "DancingScript_600SemiBold",
    fontSize: 46,
    lineHeight: 64,
    color: "#D9456B",
  },

  /* Laid out for measurement only. */
  measure: {
    position: "absolute",
    opacity: 0,
  },

  window: {
    overflow: "hidden",
    height: 64,
  },

  nib: {
    position: "absolute",
    top: 46,
    left: -2,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D9456B",
  },

  ruleWrap: {
    marginTop: 10,
  },

  rule: {
    width: 54,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#F3C6D3",
  },
});
