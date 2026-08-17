import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

export default function HomeScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    fetch("https://api.clerk.com")
      .then((res) => console.log("Clerk reachable, status:", res.status))
      .catch((err) => console.log("Clerk fetch failed:", err.message));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Between Us</Text>

      {isSignedIn ? (
        <Text style={styles.subtitle}>You're signed in 🎉</Text>
      ) : (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/sign-up")}
          >
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonOutline}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={styles.buttonOutlineText}>Sign In</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 24 },
  subtitle: { fontSize: 16, color: "#444" },
  button: {
    backgroundColor: "#111",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  buttonOutlineText: { color: "#111", fontWeight: "600" },
});
