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
      {/*
       * A single smooth wash, no shapes.
       *
       * The earlier version layered big circles behind
       * the glass, which rendered as visible hard-edged
       * blobs and made every card pick up a different
       * tint depending on what sat behind it. That is
       * what read as inconsistent, so the colour is now
       * one continuous gradient.
       */}
      <LinearGradient
        colors={["#FCF8F5", "#F7EFEA", "#F2E8E4", "#EFE6E6"]}
        locations={[0, 0.42, 0.75, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* A barely-there warm lift in the top corner. */}
      <LinearGradient
        colors={["rgba(240,206,184,0.35)", "rgba(240,206,184,0)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.25, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

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
          "rgba(255,255,255,0.92)",
          "rgba(255,255,255,0.72)",
          "rgba(255,255,255,0.62)",
        ]}
        locations={[0, 0.5, 1]}
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
const PANEL_TONES = {
  /* The house brown. */
  brown: ["rgba(94,68,60,0.94)", "rgba(58,40,35,0.9)"],
  /* A deep plum, so two dark panels can sit together
   * without reading as the same card repeated. */
  plum: ["rgba(122,74,92,0.94)", "rgba(74,42,56,0.92)"],
};

export function GlassPanel({
  children,
  style,
  radius = 26,
  padding = 20,
  tone = "brown",
}) {
  return (
    <View style={[styles.panel, { borderRadius: radius }, style]}>
      <BlurView
        intensity={40}
        tint="dark"
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={PANEL_TONES[tone] || PANEL_TONES.brown}
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
 * CARD
 * ==========================================
 *
 * A drop-in replacement for a plain <View> that
 * already has card styling. It keeps whatever
 * padding, radius and border the screen defined
 * and simply renders the frosted material behind
 * the content, so existing screens become glass
 * without reshuffling their layout.
 *
 * dark: use for the brown cards, so they match the
 * question panel on Home rather than being flat
 * blocks of colour.
 */
export function Card({ children, style, dark = false, ...rest }) {
  return (
    <View style={[styles.cardBase, style]} {...rest}>
      <BlurView
        intensity={dark ? 35 : 55}
        tint={dark ? "dark" : "light"}
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={
          dark
            ? ["rgba(94,68,60,0.94)", "rgba(58,40,35,0.9)"]
            : [
                "rgba(255,255,255,0.9)",
                "rgba(255,255,255,0.7)",
                "rgba(255,255,255,0.6)",
              ]
        }
        locations={dark ? [0, 1] : [0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Light catching the top lip. */}
      <LinearGradient
        colors={[
          dark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)",
          "rgba(255,255,255,0)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {children}
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
export function GlassPressable({
  children,
  onPress,
  style,
  radius = 24,
  padding = 18,
}) {
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
  /* Blur has to be clipped to the card's own radius. */
  cardBase: {
    overflow: "hidden",
  },

  fill: {
    flex: 1,
    backgroundColor: "#FDF9F6",
  },

  card: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#6B4E45",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
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
