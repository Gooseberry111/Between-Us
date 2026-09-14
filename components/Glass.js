import { useRef } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";

/*
 * ==========================================
 * GLASS
 * ==========================================
 *
 * Frosted building blocks.
 *
 * The trick with glass is restraint: the blur has
 * to do the work. Piling a thick white layer on top
 * kills it and you end up with flat milky boxes, so
 * the overlays here are deliberately faint and the
 * edge highlight is what sells the material.
 */

const isAndroid = Platform.OS === "android";

/* Android blur is experimental and renders flat without this. */
const androidBlur = isAndroid
  ? { experimentalBlurMethod: "dimezisBlurView", blurReductionFactor: 4 }
  : {};

export function GlassBackground({ children, style }) {
  return (
    <View style={[styles.fill, style]}>
      <LinearGradient
        colors={["#FDF9F6", "#F6EDE7", "#EFE2DE"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/*
       * Diffuse washes of colour. Large, soft and low
       * opacity so they read as depth behind the glass
       * rather than as blobs sitting on the page.
       */}
      <View pointerEvents="none" style={[styles.wash, styles.washWarm]} />
      <View pointerEvents="none" style={[styles.wash, styles.washRose]} />
      <View pointerEvents="none" style={[styles.wash, styles.washCool]} />

      {children}
    </View>
  );
}

/*
 * A light frosted pane.
 */
export function GlassCard({
  children,
  style,
  intensity = 60,
  radius = 24,
  padding = 18,
}) {
  return (
    <View style={[styles.card, { borderRadius: radius }, style]}>
      <BlurView
        intensity={intensity}
        tint="light"
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      {/* Specular highlight along the top edge only. */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.5)",
          "rgba(255,255,255,0.12)",
          "rgba(255,255,255,0.04)",
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.hairline} pointerEvents="none" />

      <View style={{ padding }}>{children}</View>
    </View>
  );
}

/*
 * A dark pane, for anything carrying white text.
 */
export function GlassPanel({ children, style, radius = 26, padding = 20 }) {
  return (
    <View style={[styles.panel, { borderRadius: radius }, style]}>
      <BlurView
        intensity={40}
        tint="dark"
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={["rgba(94,68,60,0.94)", "rgba(58,40,35,0.9)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <LinearGradient
        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={{ padding }}>{children}</View>
    </View>
  );
}

/*
 * ==========================================
 * PRESSABLE GLASS
 * ==========================================
 *
 * A card that dips slightly when touched. Small
 * movement, but it is the difference between the
 * UI feeling inert and feeling alive.
 */
export function GlassPressable({ children, onPress, style, radius = 24, padding = 18 }) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value) =>
    Animated.spring(scale, {
      toValue: value,
      friction: 7,
      tension: 180,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <GlassCard style={style} radius={radius} padding={padding}>
          {children}
        </GlassCard>
      </Animated.View>
    </Pressable>
  );
}

/*
 * Fades and lifts children into place, with an
 * optional stagger so lists arrive in sequence
 * rather than all at once.
 */
export function FadeIn({ children, delay = 0, style, distance = 14 }) {
  const progress = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  if (!started.current) {
    started.current = true;

    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
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
  fill: {
    flex: 1,
    backgroundColor: "#FDF9F6",
  },

  wash: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.38,
  },

  washWarm: {
    width: 420,
    height: 420,
    top: -160,
    right: -150,
    backgroundColor: "#F0CDB8",
  },

  washRose: {
    width: 380,
    height: 380,
    top: 220,
    left: -180,
    backgroundColor: "#E3C6D6",
  },

  washCool: {
    width: 440,
    height: 440,
    bottom: -200,
    right: -160,
    backgroundColor: "#C7D4DE",
  },

  card: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#6B4E45",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  /* A brighter line right at the top lip of the glass. */
  hairline: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.95)",
  },

  panel: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#3A2A25",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});

export default GlassCard;
