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

import { onTap } from "../lib/hugs";
import { T } from "../lib/theme";
import { motionAllowed } from "./ui";

/*
 * ==========================================
 * A LITTLE SOMETHING ARRIVING
 * ==========================================
 *
 * A kiss, "miss you", "proud of you", "thinking of you".
 * The emoji rises and swells, a few small copies drift up
 * around it, the phone taps once, and it lets go. Lighter
 * than a hug, and it does not ask for an answer.
 */

export const TAPS = {
  kiss: { emoji: "😘", line: "sent you a kiss" },
  miss: { emoji: "🥺", line: "misses you" },
  proud: { emoji: "🌟", line: "is proud of you" },
  thinking: { emoji: "💭", line: "is thinking of you" },
};

const DRIFTERS = [
  { x: -90, delay: 120, size: 22 },
  { x: 70, delay: 260, size: 26 },
  { x: -40, delay: 400, size: 18 },
  { x: 110, delay: 520, size: 20 },
  { x: -120, delay: 640, size: 16 },
];

const HOLD_MS = 2400;

function Drifter({ emoji, x, delay, size, play }) {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!play) return;

    rise.setValue(0);

    Animated.timing(rise, {
      toValue: 1,
      duration: 1600,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [play, rise, delay]);

  return (
    <Animated.Text
      style={[
        styles.drifter,
        {
          fontSize: size,
          opacity: rise.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0, 1, 0],
          }),
          transform: [
            { translateX: x },
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [40, -220],
              }),
            },
          ],
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

export default function TapOverlay() {
  const [tap, setTap] = useState(null);
  const [motion, setMotion] = useState(true);

  const shown = useRef(new Animated.Value(0)).current;
  const swell = useRef(new Animated.Value(0)).current;

  useEffect(
    () =>
      onTap(({ kind, from }) => {
        if (!TAPS[kind]) return;

        setTap({ kind, from: from || "Your person", at: Date.now() });
      }),
    [],
  );

  useEffect(() => {
    if (!tap) return undefined;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    shown.setValue(0);
    swell.setValue(0);

    motionAllowed().then((allowed) => {
      setMotion(allowed);

      Animated.parallel([
        Animated.timing(shown, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        allowed
          ? Animated.spring(swell, {
              toValue: 1,
              friction: 4,
              tension: 80,
              useNativeDriver: true,
            })
          : Animated.timing(swell, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
      ]).start();
    });

    const timer = setTimeout(close, HOLD_MS);

    return () => clearTimeout(timer);
  }, [tap]);

  const close = () => {
    Animated.timing(shown, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setTap(null));
  };

  if (!tap) return null;

  const { emoji, line } = TAPS[tap.kind];

  return (
    <Animated.View style={[styles.root, { opacity: shown }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={`${tap.from} ${line}. Tap to close.`}
      />

      <View style={styles.centre} pointerEvents="none">
        {motion
          ? DRIFTERS.map((drifter, index) => (
              <Drifter
                key={`${tap.at}-${index}`}
                emoji={emoji}
                play={tap.at}
                {...drifter}
              />
            ))
          : null}

        <Animated.Text
          style={[
            styles.emoji,
            {
              transform: [
                {
                  scale: swell.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {emoji}
        </Animated.Text>

        <Text style={styles.title}>
          {tap.from} {line}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 300,
    backgroundColor: T.dark ? "rgba(14,12,17,0.9)" : "rgba(236,235,242,0.9)",
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  emoji: {
    fontSize: 96,
    lineHeight: 112,
  },

  drifter: {
    position: "absolute",
  },

  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: T.label,
    textAlign: "center",
    marginTop: 18,
  },
});
