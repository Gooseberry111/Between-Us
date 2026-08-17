import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSignIn } from "@clerk/expo";
import { Link } from "expo-router";

export default function SignInScreen() {
  const { signIn } = useSignIn();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    setError("");

    try {
      const result = await signIn.password({
        identifier: emailAddress,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Unable to sign in.");
        return;
      }

      console.log("SIGN IN STATUS:", result.status);
    } catch (error) {
      console.log("SIGN IN ERROR:", error);
      setError(error?.message || "Something went wrong.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>B</Text>
          </View>

          <Text style={styles.brand}>Between Us</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>

          <Text style={styles.title}>Good to see you</Text>

          <Text style={styles.subtitle}>
            Sign in to continue nurturing the relationships that matter most.
          </Text>

          <Text style={styles.label}>Email address</Text>

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9A938C"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={emailAddress}
            onChangeText={setEmailAddress}
          />

          <Text style={styles.label}>Password</Text>

          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#9A938C"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot your password?</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>New to Between Us?</Text>
            <View style={styles.divider} />
          </View>

          <Link href="/sign-up" asChild>
            <TouchableOpacity style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Create an account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 40,
  },

  header: {
    alignItems: "center",
    marginBottom: 50,
  },

  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#6B4E45",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "700",
  },

  brand: {
    fontSize: 20,
    fontWeight: "700",
    color: "#332B28",
    letterSpacing: 0.3,
  },

  content: {
    width: "100%",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#A47767",
    marginBottom: 10,
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2E2724",
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#766D67",
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#453B37",
    marginBottom: 8,
  },

  input: {
    height: 54,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4DDD6",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#2E2724",
    marginBottom: 18,
  },

  button: {
    height: 54,
    backgroundColor: "#6B4E45",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  forgotButton: {
    alignItems: "center",
    marginTop: 18,
  },

  forgotText: {
    color: "#6B4E45",
    fontSize: 14,
    fontWeight: "600",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 26,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E4DDD6",
  },

  dividerText: {
    fontSize: 12,
    color: "#9A938C",
    marginHorizontal: 10,
  },

  outlineButton: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#6B4E45",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  outlineButtonText: {
    color: "#6B4E45",
    fontSize: 16,
    fontWeight: "700",
  },

  error: {
    color: "#B54A4A",
    fontSize: 13,
    marginBottom: 12,
  },
});
