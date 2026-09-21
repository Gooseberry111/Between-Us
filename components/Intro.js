import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
import { DancingScript_600SemiBold } from "@expo-google-fonts/dancing-script";

/*
 * ==========================================
 * INTRO
 * ==========================================
 *
 * The launch screen, with the name written on.
 *
 * The logo settles first, then "Between Us" arrives a
 * letter at a time -- each one fading up from slightly
 * below and behind, the way a hand lays them down --
 * and the app is already loaded behind it by the time
 * the last letter lands.
 *
 * Once per cold start. Coming back from the background
 * should not make anyone sit through it again.
 */

const WORD = "Between Us";

/* How long each letter waits for the one before it. */
const LETTER_GAP = 85;

let alreadyPlayed = false;

export function introHasPlayed() {
  return alreadyPlayed;
}

export default function Intro({ onDone }) {
  const [fontsLoaded] = useFonts({ DancingScript_600SemiBold });

  const letters = useMemo(() => WORD.split(""), []);

  /* One value per letter, plus the logo and the whole screen. */
  const letterValues = useRef(letters.map(() => new Animated.Value(0))).current;
  const logo = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded) return;

    Animated.sequence([
      /* The mark arrives first and settles. */
      Animated.timing(logo, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),

      Animated.delay(120),

      /* Then the name, one letter after another. */
      Animated.stagger(
        LETTER_GAP,
        letterValues.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),

      Animated.timing(rule, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      /* A beat to read it. */
      Animated.delay(380),

      Animated.timing(fade, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;

      alreadyPlayed = true;
      onDone?.();
    });
  }, [fontsLoaded, letterValues, logo, rule, fade, onDone]);

  /* If the font never arrives, don't hold the app hostage. */
  useEffect(() => {
    const bail = setTimeout(() => {
      if (!alreadyPlayed) {
        alreadyPlayed = true;
        onDone?.();
      }
    }, 5000);

    return () => clearTimeout(bail);
  }, [onDone]);

  return (
    <Animated.View style={[styles.screen, { opacity: fade }]}>
      <Animated.Image
        source={require("../assets/logo.png")}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            opacity: logo,
            transform: [
              {
                scale: logo.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.82, 1],
                }),
              },
            ],
          },
        ]}
      />

      {fontsLoaded ? (
        <View style={styles.word}>
          {letters.map((letter, index) => (
            <Animated.Text
              key={`${letter}-${index}`}
              style={[
                styles.letter,
                {
                  opacity: letterValues[index],
                  transform: [
                    {
                      translateY: letterValues[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    },
                    {
                      scale: letterValues[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.86, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter === " " ? " " : letter}
            </Animated.Text>
          ))}
        </View>
      ) : (
        /* Holds the same height so nothing jumps when the
           font lands. */
        <View style={styles.wordPlaceholder} />
      )}

      <Animated.View
        style={[
          styles.rule,
          {
            opacity: rule,
            transform: [
              {
                scaleX: rule.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 1],
                }),
              },
            ],
          },
        ]}
      />
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

  logo: {
    width: 190,
    height: 190,
  },

  word: {
    flexDirection: "row",
    marginTop: 6,
  },

  wordPlaceholder: {
    height: 62,
    marginTop: 6,
  },

  letter: {
    fontFamily: "DancingScript_600SemiBold",
    fontSize: 44,
    lineHeight: 62,
    color: "#D9456B",
  },

  rule: {
    marginTop: 8,
    width: 56,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#F3C6D3",
  },
});
