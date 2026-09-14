import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

/*
 * The bar floats over the content rather than sitting
 * on an opaque strip, so whatever you are scrolling
 * passes underneath and blurs through it. That is the
 * whole reason it reads as glass instead of as a white
 * bar with rounded corners.
 */

const androidBlur =
  Platform.OS === "android"
    ? { experimentalBlurMethod: "dimezisBlurView", blurReductionFactor: 4 }
    : {};

function TabBarBackground() {
  return (
    <View style={styles.barWrapper}>
      <BlurView
        intensity={70}
        tint="light"
        {...androidBlur}
        style={StyleSheet.absoluteFill}
      />

      {/* Faint wash so icons stay legible over busy content. */}
      <View style={styles.barTint} />

      {/* Bright lip along the top edge. */}
      <View style={styles.barHairline} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: "#6B4E45",
        tabBarInactiveTintColor: "#A9A09A",

        tabBarBackground: () => <TabBarBackground />,

        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },

        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.3,
          marginTop: 1,
        },

        tabBarIcon: ({ color, focused, size }) => {
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
  barWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  barTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.32)",
  },

  barHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

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
    backgroundColor: "rgba(255,255,255,0.75)",
  },
});
