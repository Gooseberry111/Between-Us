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
import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    setError("");

    try {
      const result = await signUp.password({
        emailAddress,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Unable to create account.");
        return;
      }

      await signUp.verifications.sendEmailCode();
      setPendingVerification(true);
    } catch (error) {
      console.log("SIGN UP ERROR:", error);
      setError(error?.message || "Something went wrong.");
    }
  };

  const handleVerify = async () => {
    setError("");

    try {
      const result = await signUp.verifications.verifyEmailCode({
        code,
      });

      if (result.error) {
        setError(result.error.message || "Invalid verification code.");
        return;
      }

      if (result.status === "complete") {
        await signUp.finalize();
        console.log("SIGN UP COMPLETE - AUTH GUARD WILL HANDLE ROUTING");

        // AuthGuard in _layout.js will detect the new
        // authenticated user and route them correctly.
        return;
      }
    } catch (error) {
      console.log("VERIFY ERROR:", error);

      setError(error?.message || "Verification failed.");
    }
  };

  if (pendingVerification) {
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
            <Text style={styles.eyebrow}>ONE MORE STEP</Text>

            <Text style={styles.title}>Check your email</Text>

            <Text style={styles.subtitle}>
              We've sent a verification code to
            </Text>

            <Text style={styles.emailText}>{emailAddress}</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter verification code"
              placeholderTextColor="#9A938C"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.button}
              onPress={handleVerify}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Verify email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPendingVerification(false);
                setCode("");
              }}
            >
              <Text style={styles.secondaryAction}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
          <Text style={styles.eyebrow}>WELCOME</Text>

          <Text style={styles.title}>Create your account</Text>

          <Text style={styles.subtitle}>
            A private space for the relationships that matter most.
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
            placeholder="Create a password"
            placeholderTextColor="#9A938C"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Create account</Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            By creating an account, you agree to our Terms and Privacy Policy.
          </Text>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>Already a member?</Text>
            <View style={styles.divider} />
          </View>

          <Link href="/sign-in" asChild>
            <TouchableOpacity style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Sign in</Text>
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

  terms: {
    fontSize: 12,
    lineHeight: 18,
    color: "#9A938C",
    textAlign: "center",
    marginTop: 16,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
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

  error: {
    color: "#B54A4A",
    fontSize: 13,
    marginBottom: 12,
  },

  secondaryAction: {
    textAlign: "center",
    color: "#6B4E45",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
  },

  emailText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#453B37",
    marginBottom: 24,
  },
});
