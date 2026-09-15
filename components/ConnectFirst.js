import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlassBackground, GlassPanel, FadeIn } from "./Glass";

/*
 * ==========================================
 * CONNECT FIRST
 * ==========================================
 *
 * Shown in place of a partner-only feature when
 * there is no partner. Tells people why the screen
 * is empty and gives them the one thing that unlocks
 * it, rather than letting them fill in a form that
 * the server will then refuse.
 */

export default function ConnectFirst({
  feature,
  description,
  showBack = true,
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <View style={styles.container}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={20} color="#6B4E45" />
            </TouchableOpacity>
          ) : null}

          <FadeIn style={styles.centre}>
            <GlassPanel>
              <View style={styles.lockCircle}>
                <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
              </View>

              <Text style={styles.label}>{feature.toUpperCase()}</Text>

              <Text style={styles.title}>Connect with your partner first.</Text>

              <Text style={styles.body}>
                {description ||
                  `${feature} is something you share, so it opens up once you're linked with someone.`}
              </Text>

              <TouchableOpacity
                style={styles.button}
                activeOpacity={0.85}
                onPress={() => router.push("/find-person")}
              >
                <Text style={styles.buttonText}>Find your person</Text>

                <Ionicons name="arrow-forward" size={16} color="#6B4E45" />
              </TouchableOpacity>
            </GlassPanel>
          </FadeIn>
        </View>
      </GlassBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 120,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  centre: {
    flex: 1,
    justifyContent: "center",
  },

  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  label: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#DCCBC4",
  },

  title: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  body: {
    marginTop: 10,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#E9DCD6",
  },

  button: {
    marginTop: 20,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  buttonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6B4E45",
  },
});
