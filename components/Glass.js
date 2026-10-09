import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { T } from "../lib/theme";

/*
 * ==========================================
 * SURFACES
 * ==========================================
 *
 * These were frosted panels on a gradient. The design
 * system asks for the opposite: flat white surfaces on
 * a softly tinted ground, no borders, no bevels, no
 * inner highlights, and a shadow only on things that
 * float.
 *
 * The names stay so the screens that use them keep
 * working; what they draw has changed.
 */

export function GlassBackground({ children, style }) {
  return <View style={[styles.ground, style]}>{children}</View>;
}

/* A plain white card. */
export function GlassCard({ children, style, radius = 20, padding = 16 }) {
  return (
    <View style={[styles.card, { borderRadius: radius, padding }, style]}>
      {children}
    </View>
  );
}

/*
 * What used to be a dark panel. The one emphatic
 * surface per screen: accent fill, white text.
 */
export function GlassPanel({ children, style, radius = 20, padding = 18 }) {
  return (
    <View style={[styles.panel, { borderRadius: radius, padding }, style]}>
      {children}
    </View>
  );
}

export function Card({ children, style, dark = false, ...rest }) {
  return (
    <View
      style={[dark ? styles.panel : styles.card, styles.cardSpace, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/* A press that dims and shrinks, the iOS way. */
export function GlassPressable({ children, onPress, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;

  const to = (s, o, duration) =>
    Animated.parallel([
      Animated.timing(scale, { toValue: s, duration, useNativeDriver: true }),
      Animated.timing(dim, { toValue: o, duration, useNativeDriver: true }),
    ]).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.97, 0.72, 80)}
      onPressOut={() => to(1, 1, 320)}
    >
      <Animated.View style={[{ transform: [{ scale }], opacity: dim }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function FadeIn({ children, delay = 0, style, distance = 10 }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  card: {
    backgroundColor: T.surface,
  },

  panel: {
    backgroundColor: T.accent,
  },

  cardSpace: {
    borderRadius: 20,
    padding: 16,
  },
});
