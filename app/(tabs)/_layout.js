import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PASTELS } from "../../components/Playful";

/*
 * The bar is a solid surface the screen ends at. It used to
 * be glass, which meant content slid visibly behind the icons
 * as you scrolled and fought with the labels.
 */

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

        tabBarActiveTintColor: "#8C4F5E",
        tabBarInactiveTintColor: "#A79B94",

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
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(217,69,107,0.16)",
          backgroundColor: "#FFFFFF",
          height: 62 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset + 4,

          /* Lifts it off the content instead of blending in. */
          elevation: 18,
          shadowColor: "#5B2B43",
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
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
          } else if (route.name === "memories") {
            iconName = focused ? "time" : "time-outline";
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
      <Tabs.Screen name="memories" options={{ title: "Timeline" }} />
      <Tabs.Screen name="dreams" options={{ title: "Dreams" }} />
      <Tabs.Screen name="insights" options={{ title: "Insights" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 34,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  /* A soft lozenge behind the selected tab. */
  iconActive: {
    width: 40,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PASTELS.blush.bg,
  },
});
