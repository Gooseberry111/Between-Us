import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { T } from "../lib/theme";
import { AuthScreen, Button, Mark } from "./ui";

/*
 * ==========================================
 * CONNECT FIRST
 * ==========================================
 *
 * Shown in place of a partner-only feature when there
 * is no partner. Says why the screen is empty and gives
 * the one thing that unlocks it, rather than a form the
 * server would refuse.
 *
 * The mark is the two of you; until you are linked,
 * one circle is waiting.
 */

export default function ConnectFirst({
  feature,
  description,
  showBack = true,
}) {
  const router = useRouter();

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  return (
    <AuthScreen
      centred
      onBack={showBack ? back : undefined}
      footer={
        <Button
          title="Find Your Person"
          icon="personAdd"
          onPress={() => router.push("/find-person")}
        />
      }
    >
      <View style={styles.body}>
        <Mark size={64} />

        <Text style={styles.kicker}>{feature}</Text>

        <Text style={styles.title}>Better with two</Text>

        <Text style={styles.text}>
          {description ||
            `${feature} is something you share, so it opens up once you're linked with your person.`}
        </Text>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: "center",
    paddingHorizontal: 32,
  },

  kicker: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.youText,
    marginTop: 24,
  },

  title: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.9,
    color: T.label,
    textAlign: "center",
    marginTop: 8,
  },

  text: {
    fontSize: 16,
    lineHeight: 22,
    color: T.label2,
    textAlign: "center",
    marginTop: 8,
  },
});
