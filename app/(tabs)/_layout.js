import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PASTELS } from "../../components/Playful";

/*
 * The bar floats over the content rather than sitting
 * on an opaque strip, so whatever you are scrolling
 * passes underneath it.
 */

function TabBarBackground({ bottomInset }) {
  /*
   * Android's blur samples only what the system hands it, so
   * a true frosted pane isn't available there: the bar came
   * out see-through and collided with whatever scrolled
   * beneath. A near-solid pane with a tinted edge reads as
   * glass on Android; iOS keeps the real blur.
   *
   * The pane runs under the phone's own navigation -- the
   * gesture pill or the three-button row -- so the tabs never
   * sit on bare content down there.
   */
  return (
    <View style={[styles.barWrapper, { paddingBottom: bottomInset }]}>
      {Platform.OS === "ios" ? (
        <>
          <BlurView
            intensity={60}
            tint="light"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.barTintIOS} />
        </>
      ) : (
        <View style={styles.barSolid} />
      )}

      <View style={styles.barHairline} />
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

        tabBarActiveTintColor: "#8C4F5E",
        tabBarInactiveTintColor: "#A79B94",

        tabBarBackground: () => <TabBarBackground bottomInset={bottomInset} />,

        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          height: 62 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset + 4,
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
  barWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  barTintIOS: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,253,251,0.58)",
  },

  barSolid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FDF8F4",
  },

  barHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(140,79,94,0.18)",
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
    backgroundColor: PASTELS.blush.bg,
  },
});
