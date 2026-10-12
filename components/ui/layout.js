import { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";

import { T } from "../../lib/theme";
import Icon from "./Icon";

/*
 * ==========================================
 * LAYOUT
 * ==========================================
 *
 * The shell every screen sits in, and the things that
 * sit at the top of it.
 */

/*
 * .tap — "every tappable element responds instantly by
 * dimming to about 72% and scaling to about 97% in
 * 80ms, then springs back".
 */
export function Press({
  children,
  onPress,
  onLongPress,
  style,
  outerStyle,
  disabled,
  scaleTo = 0.97,
  hitSlop,
  accessibilityLabel,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;

  const to = (nextScale, nextDim, duration) =>
    Animated.parallel([
      Animated.timing(scale, {
        toValue: nextScale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: nextDim,
        duration,
        useNativeDriver: true,
      }),
    ]).start();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={outerStyle}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => to(scaleTo, 0.72, 80)}
      onPressOut={() => to(1, 1, 400)}
    >
      <Animated.View style={[{ transform: [{ scale }], opacity: dim }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/*
 * .view — 16pt sides, a 14pt gap between blocks, and
 * room at the bottom for the floating tab bar.
 */
export function Screen({
  children,
  scroll = true,
  refreshControl,
  bottom = 32,
}) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* The system tab bar insets the content itself, and on
          iOS 26 the glass shrinks as this scrolls down. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/* .nav — 40pt tall, actions on the right. */
export function NavBar({ left, children }) {
  return (
    <View style={styles.nav}>
      <View style={styles.navLeft}>{left}</View>

      <View style={styles.navRight}>{children}</View>
    </View>
  );
}

/* Liquid Glass is drawn only where the system can draw it:
 * iOS 26 and later, with the API actually present. */
const LIQUID_GLASS = (() => {
  if (Platform.OS !== "ios") return false;

  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

/*
 * .glass-btn — a 38pt circle. On iOS 26 it is a real
 * Liquid Glass surface that responds to touch; elsewhere
 * it is the prototype's frosted circle.
 */
export function GlassButton({ icon, onPress, badge, label }) {
  if (LIQUID_GLASS) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={6}
      >
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          style={styles.liquidButton}
        >
          <Icon name={icon} size={20} color={T.label} />
        </GlassView>

        {badge ? <View style={styles.glassBadge} /> : null}
      </Pressable>
    );
  }

  return (
    <Press
      onPress={onPress}
      style={styles.glassButton}
      accessibilityLabel={label}
      scaleTo={0.92}
    >
      <Icon name={icon} size={22} color={T.label} />

      {badge ? <View style={styles.glassBadge} /> : null}
    </Press>
  );
}

/* .lt — 34pt bold, tight. */
export function LargeTitle({ children, style }) {
  return <Text style={[styles.largeTitle, style]}>{children}</Text>;
}

/* .lt-sub */
export function SubTitle({ children }) {
  return <Text style={styles.subTitle}>{children}</Text>;
}

/* .h2 — a 20pt heading with an optional plain link. */
export function SectionHeader({ children, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{children}</Text>

      {action ? (
        <Text style={styles.sectionLink} onPress={onAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

/* .gh — the small uppercase label above a group. */
export function GroupHeader({ children }) {
  return <Text style={styles.groupHeader}>{children}</Text>;
}

/* .gfoot — the explanatory line under one. */
export function GroupFooter({ children }) {
  return <Text style={styles.groupFooter}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  content: {
    paddingTop: 4,
    gap: 14,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    minHeight: 40,
  },

  navLeft: {
    flex: 1,
  },

  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  glassButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  liquidButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  glassBadge: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: T.red,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  largeTitle: {
    fontSize: 34,
    lineHeight: 37,
    fontWeight: "700",
    letterSpacing: -1.2,
    color: T.label,
    paddingHorizontal: 16,
  },

  subTitle: {
    fontSize: 15,
    color: T.label2,
    paddingHorizontal: 16,
    marginTop: -10,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: -4,
  },

  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: T.label,
  },

  sectionLink: {
    fontSize: 16,
    color: T.accent,
  },

  groupHeader: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.13,
    color: T.label2,
    paddingHorizontal: 16,
    marginBottom: -6,
  },

  groupFooter: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    paddingHorizontal: 16,
    marginTop: -6,
  },
});
