import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";

/*
 * ==========================================
 * GLASS
 * ==========================================
 *
 * Frosted-glass building blocks.
 *
 * Glass only reads as glass when there is
 * something behind it worth blurring, so
 * GlassBackground lays down a warm gradient
 * plus a few soft colour blobs, and GlassCard
 * frosts whatever ends up behind it.
 *
 * Android note: blur is experimental there and
 * does nothing unless experimentalBlurMethod is
 * set, so we opt in explicitly.
 */

const androidBlur =
  Platform.OS === "android"
    ? { experimentalBlurMethod: "dimezisBlurView" }
    : {};

export function GlassBackground({ children, style }) {
  return (
    <LinearGradient
      colors={["#FAF7F3", "#F1E6DE", "#E8D8D0"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fill, style]}
    >
      {/* Soft colour blobs give the blur something to chew on */}
      <View pointerEvents="none" style={[styles.blob, styles.blobOne]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobTwo]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobThree]} />

      {children}
    </LinearGradient>
  );
}

export function GlassCard({
  children,
  style,
  intensity = 40,
  tint = "light",
  radius = 22,
  padding = 18,
}) {
  return (
    <View style={[styles.card, { borderRadius: radius }, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      {/* Sheen: brightest at the top edge, like light catching glass */}
      <LinearGradient
        colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.18)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={{ padding }}>{children}</View>
    </View>
  );
}

/*
 * A darker pane, for cards that need to carry
 * white text (hero panels, the daily question).
 */
export function GlassPanel({ children, style, radius = 24, padding = 20 }) {
  return (
    <View style={[styles.panel, { borderRadius: radius }, style]}>
      <BlurView
        intensity={55}
        tint="dark"
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={["rgba(107,78,69,0.92)", "rgba(72,50,44,0.88)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  blob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.5,
  },

  blobOne: {
    width: 300,
    height: 300,
    top: -90,
    right: -70,
    backgroundColor: "#E9CFC2",
  },

  blobTwo: {
    width: 260,
    height: 260,
    top: 260,
    left: -110,
    backgroundColor: "#DCC7D8",
  },

  blobThree: {
    width: 320,
    height: 320,
    bottom: -120,
    right: -80,
    backgroundColor: "#CFD8DC",
  },

  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.28)",
    shadowColor: "#6B4E45",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  panel: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#3A2A25",
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});

export default GlassCard;
