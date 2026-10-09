import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "../../lib/theme";

/*
 * ==========================================
 * TABS
 * ==========================================
 *
 * A floating glass capsule, inset from the edges and
 * lifted off the content, with a soft pill behind the
 * tab you are on and the icon filled while active.
 */

const ICONS = {
  home: ["home-outline", "home"],
  memories: ["time-outline", "time"],
  dreams: ["sparkles-outline", "sparkles"],
  insights: ["git-compare-outline", "git-compare"],
  profile: ["person-outline", "person"],
};

function TabBarBackground() {
  return (
    <View style={styles.bar}>
      <View style={styles.barFill} />

      {Platform.OS === "ios" ? (
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: "#8E8E93",

        tabBarBackground: () => <TabBarBackground />,

        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Math.max(insets.bottom, 16),
          height: 62,
          borderRadius: 999,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          paddingTop: 5,
          paddingBottom: 5,
          paddingHorizontal: 5,

          shadowColor: "#000000",
          shadowOpacity: 0.18,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 10 },
          elevation: 16,
        },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          letterSpacing: 0,
          marginTop: 1,
        },

        tabBarIcon: ({ color, focused }) => {
          const [outline, filled] = ICONS[route.name] || ICONS.home;

          return (
            <View style={[styles.icon, focused && styles.iconActive]}>
              <Ionicons
                name={focused ? filled : outline}
                size={25}
                color={color}
              />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="memories" options={{ title: "Timeline" }} />
      <Tabs.Screen name="dreams" options={{ title: "Dreams" }} />
      <Tabs.Screen name="insights" options={{ title: "Insights" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />

      {/* Dates keeps its screen; the prototype reaches it from
          the Home quick actions rather than the tab bar. */}
      <Tabs.Screen name="dates" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: "hidden",
  },

  barFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      Platform.OS === "ios"
        ? "rgba(255,255,255,0.72)"
        : "rgba(255,255,255,0.97)",
  },

  icon: {
    width: 46,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },

  /* The soft pill behind the active tab. */
  iconActive: {
    backgroundColor: T.fill3,
  },
});
