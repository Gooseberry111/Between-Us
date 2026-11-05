import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { onHugAnswer } from "../lib/hugs";
import { T, themedStyles, useTheme } from "../lib/theme";
import { motionAllowed } from "./ui";

/*
 * ==========================================
 * HOW YOUR HUG WAS TAKEN
 * ==========================================
 *
 * Played on the sender's phone once their partner answers.
 *
 *   rejected   a whole heart swells, shudders, cracks down
 *              the middle, and the two halves fall away --
 *              with a heavy buzz as it breaks
 *   accepted   the heart swells and bursts into small hearts
 *
 * Mounted once at the root, played through lib/hugs.
 */

const HOLD_MS = 2600;
const SPARKS = [
  { x: -80, y: -90, delay: 0 },
  { x: 70, y: -110, delay: 80 },
  { x: -120, y: -10, delay: 140 },
  { x: 110, y: -20, delay: 200 },
  { x: -40, y: -140, delay: 260 },
  { x: 30, y: -150, delay: 320 },
];

export default function HugAnswerOverlay() {
  useTheme();

  const [answer, setAnswer] = useState(null);

  const shown = useRef(new Animated.Value(0)).current;
  const swell = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const split = useRef(new Animated.Value(0)).current;

  useEffect(
    () =>
      onHugAnswer(({ kind, from }) => {
        setAnswer({ kind, from: from || "Your person", at: Date.now() });
      }),
    [],
  );

  useEffect(() => {
    if (!answer) return undefined;

    [shown, swell, shake, split].forEach((value) => value.setValue(0));

    const broken = answer.kind === "declined";
    let timer = null;

    motionAllowed().then((allowed) => {
      if (!allowed) {
        shown.setValue(1);
        swell.setValue(1);
        split.setValue(broken ? 1 : 0);
      } else if (broken) {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(shown, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.spring(swell, {
              toValue: 1,
              friction: 5,
              tension: 80,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(shake, {
            toValue: 1,
            duration: 420,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(split, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(shown, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(swell, {
            toValue: 1,
            friction: 4,
            tension: 70,
            useNativeDriver: true,
          }),
          Animated.timing(split, {
            toValue: 1,
            duration: 1400,
            delay: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    if (broken) {
      setTimeout(
        () =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          ),
        250,
      );
      setTimeout(
        () =>
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
            () => {},
          ),
        650,
      );
      setTimeout(
        () =>
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          ).catch(() => {}),
        700,
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }

    timer = setTimeout(close, HOLD_MS + (broken ? 600 : 0));

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);

  const close = () => {
    Animated.timing(shown, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setAnswer(null));
  };

  if (!answer) return null;

  const broken = answer.kind === "declined";

  const scale = swell.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
  const jitter = shake.interpolate({
    inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    outputRange: [0, -7, 7, -6, 6, -5, 5, -3, 3, -1, 0],
  });

  const half = (direction) => ({
    opacity: split.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [1, 1, 0],
    }),
    transform: [
      {
        translateX: split.interpolate({
          inputRange: [0, 1],
          outputRange: [0, direction * 46],
        }),
      },
      {
        translateY: split.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 160],
        }),
      },
      {
        rotate: split.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${direction * 28}deg`],
        }),
      },
    ],
  });

  return (
    <Animated.View style={[styles.root, { opacity: shown }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />

      <View style={styles.centre} pointerEvents="none">
        <Animated.View
          style={[
            styles.stage,
            { transform: [{ scale }, { translateX: broken ? jitter : 0 }] },
          ]}
        >
          {broken ? (
            <>
              {/* Whole until the crack. */}
              <Animated.Text
                style={[
                  styles.heart,
                  {
                    opacity: split.interpolate({
                      inputRange: [0, 0.02, 1],
                      outputRange: [1, 0, 0],
                    }),
                  },
                ]}
              >
                ❤️
              </Animated.Text>

              {/* Then the two halves, each clipped from a broken heart. */}
              <Animated.View
                style={[
                  styles.halfLeft,
                  half(-1),
                  {
                    opacity: split.interpolate({
                      inputRange: [0, 0.02, 0.7, 1],
                      outputRange: [0, 1, 1, 0],
                    }),
                  },
                ]}
              >
                <Text style={styles.heart}>💔</Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.halfRight,
                  half(1),
                  {
                    opacity: split.interpolate({
                      inputRange: [0, 0.02, 0.7, 1],
                      outputRange: [0, 1, 1, 0],
                    }),
                  },
                ]}
              >
                <Text style={[styles.heart, styles.heartShifted]}>💔</Text>
              </Animated.View>
            </>
          ) : (
            <>
              <Text style={styles.heart}>🤗</Text>

              {SPARKS.map((spark, index) => (
                <Animated.Text
                  key={index}
                  style={[
                    styles.spark,
                    {
                      opacity: split.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0, 1, 0],
                      }),
                      transform: [
                        {
                          translateX: split.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, spark.x],
                          }),
                        },
                        {
                          translateY: split.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, spark.y],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  💕
                </Animated.Text>
              ))}
            </>
          )}
        </Animated.View>

        <Text style={styles.title}>
          {broken
            ? `${answer.from} rejected your hug`
            : `${answer.from} accepted your hug`}
        </Text>

        <Text style={styles.text}>
          {broken ? "Maybe later. Give it a little time." : "They felt it."}
        </Text>
      </View>
    </Animated.View>
  );
}

const HEART = 96;

const styles = themedStyles(() => ({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 320,
    backgroundColor: T.dark ? "rgba(0,0,0,0.6)" : "rgba(20,12,28,0.42)",
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },

  stage: {
    width: HEART + 40,
    height: HEART + 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  heart: {
    fontSize: HEART,
    lineHeight: HEART * 1.2,
    textAlign: "center",
  },

  heartShifted: {
    marginLeft: -HEART * 0.6,
  },

  halfLeft: {
    position: "absolute",
    left: 20,
    width: HEART * 0.6,
    overflow: "hidden",
  },

  halfRight: {
    position: "absolute",
    left: 20 + HEART * 0.6,
    width: HEART * 0.6,
    overflow: "hidden",
  },

  spark: {
    position: "absolute",
    fontSize: 26,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },

  text: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
}));
