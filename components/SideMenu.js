import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
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

import { FEATURES, useFeatures } from "../lib/features";
import { onMenu } from "../lib/menu";
import { useMyName } from "../lib/useMyName";
import { T } from "../lib/theme";
import { Icon, Mark } from "./ui";

/*
 * ==========================================
 * THE MENU
 * ==========================================
 *
 * Slides in from the left over a dimmed screen, so Home
 * and Profile can stay calm. Everything the two of you
 * share, then the extras you have switched on, then the
 * way to add more. Swipe or tap outside to close.
 */

const SPACES = [
  { icon: "timeline", title: "Timeline", route: "/(tabs)/memories" },
  { icon: "dreams", title: "Dreams", route: "/(tabs)/dreams" },
  { icon: "calendar", title: "Dates", route: "/dates" },
  { icon: "flag", title: "Goals", route: "/goals" },
  { icon: "mail", title: "Notes", route: "/appreciations" },
  { icon: "pulse", title: "Something's off", route: "/repair" },
];

export default function SideMenu() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { enabled } = useFeatures();
  const myName = useMyName();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const panelWidth = Math.min(340, width * 0.84);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => onMenu(setOpen), []);

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

  const extras = FEATURES.filter(
    (feature) => feature.route && enabled(feature.key),
  );

  const row = (item) => (
    <Pressable
      key={item.title}
      onPress={() => go(item.route)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <Icon name={item.icon} size={20} color={T.accent} />

      <Text style={styles.rowText}>{item.title}</Text>
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
        <View style={styles.head}>
          <Mark size={34} />

          <View style={styles.headText}>
            <Text style={styles.word}>Between Us</Text>

            {myName ? <Text style={styles.hello}>Hi, {myName}</Text> : null}
          </View>

          <Pressable
            onPress={() => setOpen(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="close" size={18} color={T.label2} />
          </Pressable>
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

const styles = StyleSheet.create({
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
    backgroundColor: T.appBackground,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 16,
  },

  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 18,
  },

  headText: {
    flex: 1,
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
    paddingHorizontal: 12,
    marginTop: 18,
    marginBottom: 6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
  },

  rowPressed: {
    backgroundColor: T.fill3,
  },

  rowText: {
    fontSize: 17,
    color: T.label,
  },
});
