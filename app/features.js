import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { FEATURES, suggestionFor, useFeatures } from "../lib/features";
import { T } from "../lib/theme";
import {
  Cell,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Screen,
  SubTitle,
  Toggle,
} from "../components/ui";

/*
 * ==========================================
 * MAKE IT YOURS
 * ==========================================
 *
 * The extras, each with a switch. Suggested ones float to
 * the top with the reason, taken from what you told the
 * app about your relationship. Switching one on puts it in
 * the menu (and on Home, where it belongs there).
 */

export default function FeaturesScreen() {
  const router = useRouter();
  const { enabled, set, context, ready } = useFeatures();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const withReasons = FEATURES.map((feature) => ({
    ...feature,
    reason: suggestionFor(feature.key, context),
  }));

  const suggested = withReasons.filter(
    (feature) => feature.reason && !enabled(feature.key),
  );

  const rest = withReasons.filter((feature) => !suggested.includes(feature));

  const row = (feature) => (
    <Cell
      key={feature.key}
      leading={
        <View
          style={[
            styles.badge,
            enabled(feature.key) && { backgroundColor: T.accent },
          ]}
        >
          <Icon
            name={feature.icon}
            size={16}
            color={enabled(feature.key) ? "#FFFFFF" : T.accent}
            filled
          />
        </View>
      }
      title={feature.title}
      subtitle={
        feature.reason ? `${feature.reason} · ${feature.text}` : feature.text
      }
      trailing={
        <Toggle
          value={enabled(feature.key)}
          onChange={(value) => set(feature.key, value)}
        />
      }
    />
  );

  return (
    <Screen>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Features</LargeTitle>

      <SubTitle>
        Add what your relationship needs. Leave out what it doesn't.
      </SubTitle>

      {suggested.length > 0 ? (
        <View style={styles.section}>
          <GroupHeader>Suggested for you two</GroupHeader>

          <Group inset={62}>{suggested.map(row)}</Group>
        </View>
      ) : null}

      <View style={styles.section}>
        <GroupHeader>Extras</GroupHeader>

        <Group inset={62}>{rest.map(row)}</Group>
      </View>

      <GroupFooter>
        <Text>
          {ready
            ? "These are yours alone; your partner chooses their own. Tonight's questions, Timeline, Dreams, Insights, Notes, Dates, Goals and Repair are always there."
            : "Loading what you have on…"}
        </Text>
      </GroupFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },

  badge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
