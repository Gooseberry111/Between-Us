import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { FEATURES, useFeatures } from "../lib/features";
import { menuBlurTarget, onMenu } from "../lib/menu";
import { useMyName } from "../lib/useMyName";
import { T, themedStyles, useTheme } from "../lib/theme";
import { GlassButton, Icon, Mark } from "./ui";

/*
 * ==========================================
 * THE MENU
 * ==========================================
 *
 * A pane of glass that slides in from the left, half the
 * screen wide, so Home and Profile can stay calm.
 * Everything the two of you share, then the extras you
 * have switched on, then the way to add more. Swipe it
 * back, tap outside, or tap the chevron to close.
 */

/* Liquid Glass on iOS 26; the system's frosted material
 * before that, and on Android. */
const LIQUID_GLASS = (() => {
  if (Platform.OS !== "ios") return false;

  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

function Pane() {
  useTheme();

  if (LIQUID_GLASS) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        colorScheme={T.scheme}
        tintColor={T.dark ? "rgba(14,12,17,0.35)" : "rgba(245,242,248,0.4)"}
      />
    );
  }

  return (
    <>
      <BlurView
        style={StyleSheet.absoluteFill}
        tint={T.dark ? "systemThickMaterialDark" : "systemThickMaterialLight"}
        intensity={Platform.OS === "android" ? 90 : 100}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={menuBlurTarget}
      />

      {/* A wash of the app's own colour keeps the words
          readable over anything behind. */}
      <View style={[StyleSheet.absoluteFill, styles.wash]} />
    </>
  );
}

const SPACES = [
  { icon: "timeline", title: "Timeline", route: "/(tabs)/memories" },
  { icon: "dreams", title: "Dreams", route: "/(tabs)/dreams" },
  { icon: "calendar", title: "Dates", route: "/dates" },
  { icon: "flag", title: "Goals", route: "/goals" },
  { icon: "mail", title: "Notes", route: "/appreciations" },
  { icon: "pulse", title: "Something's off", route: "/repair" },
];

export default function SideMenu() {
  useTheme();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { enabled } = useFeatures();
  const myName = useMyName();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const panelWidth = Math.max(width * 0.5, 200);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => onMenu(setOpen), []);

  /* A swipe to the left puts it away. */
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -50 || g.vx < -0.4) setOpen(false);
        },
      }),
    [],
  );

  useEffect(() => {
    if (open) {
      setMounted(true);
      Haptics.selectionAsync().catch(() => {});
    }

    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 300 : 220,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, slide]);

  /* Android's back closes the menu before anything else. */
  useEffect(() => {
    if (!open) return undefined;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setOpen(false);
        return true;
      },
    );

    return () => subscription.remove();
  }, [open]);

  if (!mounted) return null;

  const go = (route) => {
    setOpen(false);
    setTimeout(() => router.push(route), 120);
  };

  /* The recap has its own place, at the top of Timeline. */
  const extras = FEATURES.filter(
    (feature) =>
      feature.route && feature.key !== "recap" && enabled(feature.key),
  );

  const row = (item) => (
    <Pressable
      key={item.title}
      onPress={() => go(item.route)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <Icon name={item.icon} size={19} color={T.accent} />

      <Text style={styles.rowText} numberOfLines={1} adjustsFontSizeToFit>
        {item.title}
      </Text>
    </Pressable>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.scrim,
          {
            opacity: slide.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close the menu"
        />
      </Animated.View>

      <Animated.View
        {...swipe.panHandlers}
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-panelWidth - 20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pane />

        <View style={styles.head}>
          <View style={styles.headTop}>
            <Mark size={34} />

            <GlassButton
              icon="back"
              label="Close the menu"
              onPress={() => setOpen(false)}
            />
          </View>

          <Text style={styles.word} numberOfLines={1} adjustsFontSizeToFit>
            Between Us
          </Text>

          {myName ? (
            <Text style={styles.hello} numberOfLines={1}>
              Hi, {myName}
            </Text>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>Together</Text>

          {SPACES.map(row)}

          {extras.length > 0 ? (
            <>
              <Text style={styles.section}>Your extras</Text>

              {extras.map(row)}
            </>
          ) : null}

          <Text style={styles.section}>Make it yours</Text>

          {row({ icon: "add", title: "Add features", route: "/features" })}
          {row({ icon: "edit", title: "Your answers", route: "/answers" })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.32)",
    zIndex: 280,
  },

  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 290,
    overflow: "hidden",
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: T.dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.7)",
    paddingHorizontal: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 16,
  },

  wash: {
    backgroundColor: T.dark ? "rgba(14,12,17,0.55)" : "rgba(245,242,248,0.6)",
  },

  head: {
    paddingHorizontal: 8,
    paddingBottom: 14,
  },

  headTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  word: {
    fontFamily: "ui-serif",
    fontSize: 22,
    fontWeight: "600",
    color: T.label,
  },

  hello: {
    fontSize: 13,
    color: T.label2,
    marginTop: 1,
  },

  section: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
    paddingHorizontal: 10,
    marginTop: 18,
    marginBottom: 6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 10,
    borderRadius: 14,
  },

  rowPressed: {
    backgroundColor: T.fill3,
  },

  rowText: {
    flex: 1,
    fontSize: 16,
    color: T.label,
  },
}));
