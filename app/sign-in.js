import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSignIn, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import PasswordField from "../components/ui/PasswordField";

export default function SignInScreen() {
  const router = useRouter();

  const { signIn, errors } = useSignIn();
  const { isLoaded } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * Signing in from a phone Clerk has not seen before can
   * need a code from email before it trusts the device.
   * Without this the sign-in simply stopped, saying
   * verification was required and offering no way to do it.
   */
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");

  const startDeviceVerification = async () => {
    const sent = await signIn.mfa.sendEmailCode();

    if (sent?.error) {
      throw new Error(
        sent.error.message || "We couldn't send a verification code.",
      );
    }

    setVerifying(true);
    setCode("");
    setNotice("We've emailed you a code to confirm this is you.");
    setError("");
    setLoading(false);
  };

  const handleVerifyDevice = async () => {
    if (loading) return;

    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");

      const verified = await signIn.mfa.verifyEmailCode({ code: code.trim() });

      if (verified?.error) {
        throw new Error(
          verified.error.message || "That code didn't work. Try again.",
        );
      }

      const finalizeResult = await signIn.finalize();

      if (finalizeResult?.error) {
        throw new Error(
          finalizeResult.error.message || "Unable to complete sign in.",
        );
      }

      /* The auth guard routes from here. */
    } catch (err) {
      console.log("DEVICE VERIFY ERROR:", err);

      setError(
        err?.errors?.[0]?.message ||
          err?.message ||
          "That code didn't work. Try again.",
      );

      setLoading(false);
    }
  };

  const handleResendDeviceCode = async () => {
    if (loading) return;

    try {
      setLoading(true);

      await startDeviceVerification();

      setNotice("A new code is on its way.");
    } catch (err) {
      console.log("DEVICE CODE RESEND ERROR:", err);

      setError(err?.message || "We couldn't send a new code.");
      setLoading(false);
    }
  };

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

        await startDeviceVerification();

        return;
      }

      /*
       * ========================================
       * CLIENT TRUST
       * ========================================
       */

      if (signIn.status === "needs_client_trust") {
        console.log("SIGN IN REQUIRES CLIENT TRUST");

        await startDeviceVerification();

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
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.initialLoading}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>♡</Text>
          </View>

          <Text style={styles.loadingTitle}>Between Us</Text>

          <Text style={styles.loadingText}>Preparing your sign in...</Text>

          <ActivityIndicator
            size="small"
            color="#F03FA9"
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
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

            {verifying ? (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Code from your email</Text>

                  <TextInput
                    value={code}
                    onChangeText={(value) => {
                      setCode(value);
                      setError("");
                    }}
                    placeholder="Enter the code"
                    placeholderTextColor="rgba(60,60,67,0.3)"
                    keyboardType="number-pad"
                    editable={!loading}
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyDevice}
                  />
                </View>

                {notice ? (
                  <Text style={styles.noticeText}>{notice}</Text>
                ) : null}

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.signInButton,
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleVerifyDevice}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.signInText}>Confirm it's me</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResendDeviceCode}
                  disabled={loading}
                >
                  <Text style={styles.linkAction}>Send me a new code</Text>
                </TouchableOpacity>
              </View>
            ) : (
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
                    placeholderTextColor="rgba(60,60,67,0.3)"
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
                  <PasswordField
                    label="Password"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setError("");
                    }}
                    placeholder="Enter your password"
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
                  style={[
                    styles.signInButton,
                    loading && styles.disabledButton,
                  ]}
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

                <TouchableOpacity
                  onPress={() => router.push("/forgot-password")}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkAction}>Forgot your password?</Text>
                </TouchableOpacity>
              </View>
            )}

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
  linkAction: {
    textAlign: "center",
    color: "#F03FA9",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 18,
  },

  noticeText: {
    color: "#4F6F52",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  screen: {
    flex: 1,
    backgroundColor: "#F2ECF4",
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
    color: "#F03FA9",
    marginRight: 7,
  },

  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F03FA9",
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
    color: "rgba(60,60,67,0.6)",
    marginBottom: 12,
  },

  title: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "700",
    color: "#111114",
  },

  titleAccent: {
    color: "#F03FA9",
  },

  description: {
    marginTop: 15,
    maxWidth: 330,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(60,60,67,0.6)",
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
    color: "#111114",
    borderWidth: 1,
    borderColor: "#FDE8F5",
  },

  /*
   * ERROR
   */

  errorBox: {
    backgroundColor: "#FDE8F5",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 16,
  },

  errorText: {
    color: "#FF3B30",
    fontSize: 13,
    lineHeight: 18,
  },

  /*
   * SIGN IN BUTTON
   */

  signInButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F03FA9",
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
    color: "rgba(60,60,67,0.6)",
    fontSize: 14,
    marginRight: 5,
  },

  createText: {
    color: "#F03FA9",
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
    backgroundColor: "#FDE8F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  loadingLogoText: {
    fontSize: 30,
    color: "#F03FA9",
  },

  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111114",
  },

  loadingText: {
    marginTop: 7,
    fontSize: 14,
    color: "rgba(60,60,67,0.6)",
  },

  loader: {
    marginTop: 20,
  },
});
