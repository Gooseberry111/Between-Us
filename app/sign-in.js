import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";

import { useSignIn, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

export default function SignInScreen() {
  const router = useRouter();

  const { signIn, errors } = useSignIn();
  const { isLoaded } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * ==========================================
   * SIGN IN
   * ==========================================
   */

  const handleSignIn = async () => {
    console.log("SIGN IN BUTTON PRESSED");

    if (loading) {
      return;
    }

    setError("");

    /*
     * Clerk must be ready.
     */

    if (!isLoaded || !signIn) {
      console.log("SIGN IN: CLERK NOT READY");

      setError("Authentication is still loading. Please try again.");

      return;
    }

    /*
     * Validate email.
     */

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your email.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    /*
     * Validate password.
     */

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      console.log("STARTING SIGN IN...");
      console.log("EMAIL:", cleanEmail);

      /*
       * ========================================
       * CLERK CORE 3 PASSWORD SIGN IN
       * ========================================
       *
       * Do NOT use:
       *
       * signIn.create({
       *   identifier,
       *   password
       * })
       *
       * For Core 3 we use signIn.password().
       */

      const result = await signIn.password({
        emailAddress: cleanEmail,
        password,
      });

      console.log("SIGN IN PASSWORD RESULT:", JSON.stringify(result));

      /*
       * Clerk can return an error without throwing.
       */

      if (result?.error) {
        console.log("SIGN IN ERROR RESULT:", result.error);

        setError(
          result.error?.message ||
            "Unable to sign in. Please check your details.",
        );

        setLoading(false);

        return;
      }

      /*
       * ========================================
       * CHECK SIGN-IN STATUS
       * ========================================
       */

      console.log("SIGN IN STATUS:", signIn.status);

      /*
       * Successful authentication.
       */

      if (signIn.status === "complete") {
        console.log("SIGN IN COMPLETE");
        console.log("FINALIZING SIGN IN...");

        const finalizeResult = await signIn.finalize();

        console.log("SIGN IN FINALIZE RESULT:", JSON.stringify(finalizeResult));

        if (finalizeResult?.error) {
          console.log("FINALIZE ERROR:", finalizeResult.error);

          setError(
            finalizeResult.error?.message || "Unable to complete sign in.",
          );

          setLoading(false);

          return;
        }

        /*
         * IMPORTANT:
         *
         * Do NOT router.replace() here.
         *
         * Clerk will update useAuth().
         *
         * Your _layout.js will then check:
         *
         * profile exists -> Home
         * profile missing -> Onboarding
         */

        console.log("SIGN IN FINALIZED");

        return;
      }

      /*
       * ========================================
       * MFA
       * ========================================
       */

      if (signIn.status === "needs_second_factor") {
        console.log("SIGN IN REQUIRES MFA");

        setError("Additional verification is required for this account.");

        setLoading(false);

        return;
      }

      /*
       * ========================================
       * CLIENT TRUST
       * ========================================
       */

      if (signIn.status === "needs_client_trust") {
        console.log("SIGN IN REQUIRES CLIENT TRUST");

        setError("Additional verification is required for this device.");

        setLoading(false);

        return;
      }

      /*
       * ========================================
       * UNKNOWN STATUS
       * ========================================
       */

      console.log("SIGN IN INCOMPLETE:", signIn.status);

      /*
       * Check Clerk's structured errors too.
       */

      const clerkError =
        errors?.fields?.identifier?.message ||
        errors?.fields?.password?.message;

      setError(
        clerkError ||
          `Sign in could not be completed. Status: ${
            signIn.status || "unknown"
          }`,
      );

      setLoading(false);
    } catch (err) {
      console.log("SIGN IN EXCEPTION:", err);

      const clerkMessage =
        err?.errors?.[0]?.message ||
        err?.errors?.[0]?.longMessage ||
        err?.message;

      setError(
        clerkMessage ||
          "Unable to sign in. Please check your email and password.",
      );

      setLoading(false);
    }
  };

  /*
   * ==========================================
   * BACK
   * ==========================================
   */

  const handleBack = () => {
    if (loading) return;

    router.replace("/");
  };

  /*
   * ==========================================
   * CREATE ACCOUNT
   * ==========================================
   */

  const handleCreateAccount = () => {
    if (loading) return;

    router.replace("/sign-up");
  };

  /*
   * ==========================================
   * LOADING SCREEN
   * ==========================================
   */

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.initialLoading}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>♡</Text>
          </View>

          <Text style={styles.loadingTitle}>Between Us</Text>

          <Text style={styles.loadingText}>Preparing your sign in...</Text>

          <ActivityIndicator
            size="small"
            color="#6B4E45"
            style={styles.loader}
          />
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ==========================================
   * SCREEN
   * ==========================================
   */

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* BACK */}

            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.backArrow}>←</Text>

              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {/* HEADER */}

            <View style={styles.header}>
              <Text style={styles.eyebrow}>WELCOME BACK</Text>

              <Text style={styles.title}>
                Good to see you
                {"\n"}
                <Text style={styles.titleAccent}>again.</Text>
              </Text>

              <Text style={styles.description}>
                Sign in to continue building meaningful connections.
              </Text>
            </View>

            {/* FORM */}

            <View style={styles.form}>
              {/* EMAIL */}

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>

                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError("");
                  }}
                  placeholder="Enter your email"
                  placeholderTextColor="#AAA09A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!loading}
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              {/* PASSWORD */}

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>

                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#AAA09A"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  editable={!loading}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
              </View>

              {/* ERROR */}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* SIGN IN BUTTON */}

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.signInButton, loading && styles.disabledButton]}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingButton}>
                    <ActivityIndicator size="small" color="#FFFFFF" />

                    <Text style={styles.signInText}>Signing in...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.signInText}>Sign In</Text>

                    <Text style={styles.arrow}>→</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* FOOTER */}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>

              <TouchableOpacity
                onPress={handleCreateAccount}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.createText}>Create one</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * STYLES
 * ==========================================
 */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
  },

  /*
   * BACK
   */

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingRight: 12,
  },

  backArrow: {
    fontSize: 21,
    color: "#6B4E45",
    marginRight: 7,
  },

  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B4E45",
  },

  /*
   * HEADER
   */

  header: {
    marginTop: 28,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: "#9A918A",
    marginBottom: 12,
  },

  title: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "700",
    color: "#302825",
  },

  titleAccent: {
    color: "#6B4E45",
  },

  description: {
    marginTop: 15,
    maxWidth: 330,
    fontSize: 15,
    lineHeight: 22,
    color: "#817771",
  },

  /*
   * FORM
   */

  form: {
    marginTop: 32,
  },

  field: {
    marginBottom: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5F554F",
    marginBottom: 8,
  },

  input: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#302825",
    borderWidth: 1,
    borderColor: "#E8E1DC",
  },

  /*
   * ERROR
   */

  errorBox: {
    backgroundColor: "#F3E3DF",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 16,
  },

  errorText: {
    color: "#8A4A3D",
    fontSize: 13,
    lineHeight: 18,
  },

  /*
   * SIGN IN BUTTON
   */

  signInButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginTop: 2,
  },

  disabledButton: {
    opacity: 0.7,
  },

  loadingButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  signInText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  arrow: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "500",
  },

  /*
   * FOOTER
   */

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },

  footerText: {
    color: "#817771",
    fontSize: 14,
    marginRight: 5,
  },

  createText: {
    color: "#6B4E45",
    fontSize: 14,
    fontWeight: "700",
  },

  /*
   * INITIAL LOADING
   */

  initialLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  loadingLogo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  loadingLogoText: {
    fontSize: 30,
    color: "#6B4E45",
  },

  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#302825",
  },

  loadingText: {
    marginTop: 7,
    fontSize: 14,
    color: "#817771",
  },

  loader: {
    marginTop: 20,
  },
});
