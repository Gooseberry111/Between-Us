import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

/*
 * ==========================================
 * PLAYFUL
 * ==========================================
 *
 * The soft half of the palette. The brown stays the
 * house colour -- it carries the text and the buttons
 * -- while these pastels mark one thing from another
 * at a glance: dates are blush, dreams are sky, goals
 * are sage. Colour as signposting, not decoration.
 */

export const PASTELS = {
  blush: { bg: "#F7E2E6", ink: "#8C4F5E", soft: "#FCF2F4" },
  sage: { bg: "#DFEADB", ink: "#4F6F52", soft: "#F2F7F0" },
  butter: { bg: "#F8E8C8", ink: "#8A6B32", soft: "#FCF6E9" },
  sky: { bg: "#DCE7F2", ink: "#4A6280", soft: "#F1F5FA" },
  lilac: { bg: "#E6DFEF", ink: "#63537C", soft: "#F5F2F9" },
  clay: { bg: "#F0E0D6", ink: "#B8345A", soft: "#FAF3EE" },
};

/*
 * A press that gives a little. Everything tappable on
 * Home uses it, so the screen feels answered rather
 * than merely navigated.
 */
export function Squish({
  children,
  onPress,
  style,
  disabled,
  scaleTo = 0.965,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !disabled && spring(scaleTo)}
      onPressOut={() => spring(1)}
      disabled={disabled}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/*
 * A number worth looking at, with its meaning underneath.
 * The number counts up on arrival -- small, quick, once --
 * because a figure that lands feels earned.
 */
export function StatTile({ value, label, tone = "blush", suffix = "" }) {
  const pastel = PASTELS[tone] || PASTELS.blush;
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(grow, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();
  }, [grow]);

  return (
    <Animated.View
      style={[
        styles.stat,
        { backgroundColor: pastel.bg },
        {
          opacity: grow,
          transform: [
            {
              scale: grow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.statValue, { color: pastel.ink }]}>
        {value}
        {suffix ? <Text style={styles.statSuffix}>{suffix}</Text> : null}
      </Text>

      <Text style={[styles.statLabel, { color: pastel.ink }]}>{label}</Text>
    </Animated.View>
  );
}

/*
 * A small badge that pulses once when it appears, for
 * the things worth a quiet well done.
 */
export function Celebrate({ children, tone = "butter" }) {
  const pastel = PASTELS[tone] || PASTELS.butter;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(250),
      Animated.spring(pulse, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
        bounciness: 14,
      }),
    ]).start();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor: pastel.bg },
        {
          opacity: pulse,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: pastel.ink }]}>{children}</Text>
    </Animated.View>
  );
}

/*
 * Empty screens are where an app feels most unfinished.
 * A drawn shape, a line of warmth, and a way forward.
 */
export function EmptyArt({ emoji, title, text, tone = "clay", action }) {
  const pastel = PASTELS[tone] || PASTELS.clay;

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyBlob, { backgroundColor: pastel.bg }]}>
        <Text style={styles.emptyEmoji}>{emoji}</Text>
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyText}>{text}</Text>

      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },

  statValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  statSuffix: {
    fontSize: 14,
    fontWeight: "700",
  },

  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.75,
  },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  empty: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  emptyBlob: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  emptyEmoji: {
    fontSize: 38,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#2E2430",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: "#7E736D",
    textAlign: "center",
  },
});
