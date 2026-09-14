import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

/*
 * ==========================================
 * SKELETON
 * ==========================================
 *
 * Placeholder blocks shown while a screen's
 * data is still on its way.
 *
 * The point is that navigation feels instant:
 * you land on the real screen, laid out the way
 * it will look, instead of a blank page with a
 * spinner in the middle of it.
 *
 * Uses the built-in Animated API so there is no
 * extra dependency and it runs in Expo Go as-is.
 */

export function Skeleton({ width, height = 14, radius = 8, style }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity: pulse },
        style,
      ]}
    />
  );
}

/*
 * A card-shaped placeholder, matching the
 * white rounded cards used across the app.
 */
export function SkeletonCard({ lines = 3, style }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton width={92} height={11} radius={6} />

      <Skeleton width="72%" height={19} radius={7} style={styles.title} />

      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? "45%" : "100%"}
          height={12}
          style={styles.line}
        />
      ))}
    </View>
  );
}

/*
 * A whole screen of placeholder cards, for the
 * first ever load when nothing is cached yet.
 */
export function SkeletonList({ count = 3 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} style={styles.spaced} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: "#E6DED9",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  title: {
    marginTop: 14,
  },

  line: {
    marginTop: 10,
  },

  spaced: {
    marginBottom: 13,
  },
});

export default Skeleton;
