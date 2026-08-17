import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Between Us</Text>

      <Text style={styles.tagline}>
        Stay connected to the people who matter most.
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push("/sign-up")}
      >
        <Text style={styles.primaryText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/sign-in")}
      >
        <Text style={styles.secondaryText}>I Already Have An Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    fontSize: 42,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  tagline: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 40,
    color: "#666",
  },
  primaryButton: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  primaryText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#111",
  },
  secondaryText: {
    textAlign: "center",
    fontWeight: "600",
  },
});
