import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: "#6B4E45",
        tabBarInactiveTintColor: "#A59A93",

        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EAE3DE",
          height: 60,
          paddingTop: 4,
          paddingBottom: 5,
        },

        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: "600",
          marginTop: -2,
        },

        tabBarIconStyle: {
          marginBottom: -2,
        },

        tabBarIcon: ({ color, focused }) => {
          let iconName;

          if (route.name === "home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "memories") {
            iconName = focused ? "images" : "images-outline";
          } else if (route.name === "dreams") {
            iconName = focused ? "sparkles" : "sparkles-outline";
          } else if (route.name === "insights") {
            iconName = focused ? "stats-chart" : "stats-chart-outline";
          } else if (route.name === "profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={18} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="memories"
        options={{
          title: "Memories",
        }}
      />

      <Tabs.Screen
        name="dreams"
        options={{
          title: "Dreams",
        }}
      />

      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
