import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "../../lib/theme";

/*
 * A floating frosted capsule, lifted off the content,
 * with a soft pill behind the tab you are on.
 */

function TabBarBackground() {
  return (
    <View style={styles.barWrap}>
      <View style={styles.barFill} />

      {Platform.OS === "ios" ? (
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  /*
   * Whatever the system reserves at the bottom, plus a little
   * breathing room of our own.
   */
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 10);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.label2,

        tabBarBackground: () => <TabBarBackground />,

        /*
         * A solid bar, not a glass one.
         *
         * Anything translucent here showed the content
         * scrolling underneath -- text sliding behind the
         * icons, colours fighting the labels. The bar is now
         * an opaque surface the screen ends at, running the
         * whole way down under the phone's own navigation
         * buttons so nothing shows between them either.
         */
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 10),
          height: 62,
          borderRadius: 31,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 6,

          shadowColor: "#000000",
          shadowOpacity: 0.16,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 14,
        },

        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.3,
          marginTop: 1,
        },

        tabBarIcon: ({ color, focused }) => {
          let iconName;

          if (route.name === "home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "dates") {
            iconName = focused ? "calendar" : "calendar-outline";
          } else if (route.name === "dreams") {
            iconName = focused ? "sparkles" : "sparkles-outline";
          } else if (route.name === "insights") {
            iconName = focused ? "stats-chart" : "stats-chart-outline";
          } else if (route.name === "profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return (
            <View style={focused ? styles.iconActive : styles.icon}>
              <Ionicons name={iconName} size={19} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="dates" options={{ title: "Dates" }} />

      {/* Timeline is gone: special dates and the dates screen
          cover what it was for, and nobody could tell what it
          was. The screen stays reachable, just not as a tab. */}
      <Tabs.Screen name="memories" options={{ href: null }} />
      <Tabs.Screen name="dreams" options={{ title: "Dreams" }} />
      <Tabs.Screen name="insights" options={{ title: "Insights" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 31,
    overflow: "hidden",
  },

  barFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      Platform.OS === "ios" ? "rgba(255,255,255,0.82)" : "#FFFFFF",
  },

  icon: {
    width: 34,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  /* The soft pill behind the tab you are on. */
  iconActive: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.fill4,
  },
});
