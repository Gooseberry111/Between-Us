import { DynamicColorIOS, Platform } from "react-native";
import { DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { T } from "../../lib/theme";

/*
 * ==========================================
 * TABS
 * ==========================================
 *
 * The system tab bar, not a drawing of one.
 *
 * On iOS this is UITabBarController itself, so on
 * iOS 26 it is Liquid Glass -- refracting what scrolls
 * beneath it, shrinking as you scroll down, and
 * adapting its tint to light and dark content with
 * nothing from us. Earlier iOS gets the standard
 * translucent bar. Android gets Material's bottom
 * navigation.
 *
 * SF Symbols on iOS (outline at rest, filled when
 * selected), Material Symbols on Android.
 */

/* The accent in light mode, its lighter twin in dark. */
const tint =
  Platform.OS === "ios"
    ? DynamicColorIOS({ light: T.accent, dark: T.accentDark })
    : T.accent;

/* A known background under every tab, so switching never
 * flashes white behind the glass. */
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: T.accent,
    background: T.appBackground,
  },
};

export default function TabsLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon
            sf={{ default: "house", selected: "house.fill" }}
            md="home"
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="memories">
          <NativeTabs.Trigger.Icon
            sf={{ default: "clock", selected: "clock.fill" }}
            md="schedule"
          />
          <NativeTabs.Trigger.Label>Timeline</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="dreams">
          <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
          <NativeTabs.Trigger.Label>Dreams</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="insights">
          <NativeTabs.Trigger.Icon
            sf={{ default: "circle.circle", selected: "circle.circle.fill" }}
            md="join"
          />
          <NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{
              default: "person.crop.circle",
              selected: "person.crop.circle.fill",
            }}
            md="person"
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
