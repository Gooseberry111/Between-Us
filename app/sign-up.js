import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";

import PasswordField, {
  PASSWORD_MINIMUM,
  passwordProblem,
} from "../components/ui/PasswordField";

/*
 * ==========================================
 * FLAKY CONNECTIONS
 * ==========================================
 *
 * Signing up takes two requests minutes apart: start
 * the account, then verify the emailed code. On a slow
 * connection the first can time out, or its record can
 * be lost, and Clerk answers the second with "No sign
 * up attempt was found" -- which reads as if the person
 * did something wrong.
 *
 * So: retry anything that looks like a network problem,
 * and if the attempt really is gone, start it again and
 * send a fresh code instead of showing an error.
 */

function describe(error) {
  return `${error?.message || ""} ${error?.errors?.[0]?.message || ""}`;
}

function isNetworkProblem(error) {
  return /network|timeout|timed out|failed to fetch|connection|offline|unavailable|temporarily/i.test(
    describe(error),
  );
}

function isLostAttempt(error) {
  return /sign.?up attempt|GET request for this client|client not found|expired/i.test(
    describe(error),
  );
}

async function withRetry(action) {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await action();

      if (!result?.error || !isNetworkProblem(result.error)) {
        return result;
      }

      lastError = result.error;
    } catch (error) {
      if (!isNetworkProblem(error)) throw error;

      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
  }

  throw lastError || new Error("Network request failed");
}

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const cleanEmail = emailAddress.trim().toLowerCase();

  const startAttempt = async () => {
    const result = await withRetry(() =>
      signUp.password({
        emailAddress: cleanEmail,
        password,
      }),
    );

    if (result?.error) {
      throw new Error(result.error.message || "Unable to create account.");
    }

    await withRetry(() => signUp.verifications.sendEmailCode());
  };

  const readableError = (error, fallback) => {
    if (isNetworkProblem(error)) {
      return "We couldn't reach the server. Check your connection and try again.";
    }

    return error?.errors?.[0]?.message || error?.message || fallback;
  };

  const handleSignUp = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    if (!cleanEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    const problem = passwordProblem(password);

    if (problem) {
      setError(`Your password is too short. ${problem}`);
      return;
    }

    try {
      setBusy(true);

      await startAttempt();

      setPendingVerification(true);
    } catch (error) {
      console.log("SIGN UP ERROR:", error);

      setError(readableError(error, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    try {
      setBusy(true);

      try {
        await withRetry(() => signUp.verifications.sendEmailCode());
      } catch (error) {
        /* The attempt itself is gone, so make a new one. */
        if (!isLostAttempt(error)) throw error;

        await startAttempt();
      }

      setCode("");
      setNotice("A new code is on its way.");
    } catch (error) {
      console.log("RESEND ERROR:", error);

      setError(readableError(error, "We couldn't send a new code."));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }

    try {
      setBusy(true);

      const result = await withRetry(() =>
        signUp.verifications.verifyEmailCode({
          code: code.trim(),
        }),
      );

      if (result?.error) {
        throw new Error(result.error.message || "Invalid verification code.");
      }

      if (result?.status === "complete" || signUp.status === "complete") {
        await withRetry(() => signUp.finalize());

        console.log("SIGN UP COMPLETE - AUTH GUARD WILL HANDLE ROUTING");

        /* AuthGuard in _layout.js routes from here. */
        return;
      }

      setError("That code didn't work. Check it and try again.");
    } catch (error) {
      console.log("VERIFY ERROR:", error);

      /*
       * The account was never really started, or its record
       * timed out. Begin again quietly and send a new code,
       * rather than blaming the person for it.
       */
      if (isLostAttempt(error)) {
        try {
          await startAttempt();

          setCode("");

          setNotice(
            "That took a while, so we sent you a fresh code. Please check your email.",
          );

          return;
        } catch (restartError) {
          console.log("VERIFY RESTART ERROR:", restartError);

          setError(
            "We couldn't pick up where we left off. Please start again with your email.",
          );

          setPendingVerification(false);

          return;
        }
      }

      setError(readableError(error, "Verification failed."));
    } finally {
      setBusy(false);
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
              placeholderTextColor="rgba(60,60,67,0.6)"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, busy && styles.buttonBusy]}
              onPress={handleVerify}
              disabled={busy}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Verify email</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleResend} disabled={busy}>
              <Text style={styles.secondaryAction}>Send me a new code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPendingVerification(false);
                setCode("");
                setError("");
                setNotice("");
              }}
              disabled={busy}
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
            placeholderTextColor="rgba(60,60,67,0.6)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={emailAddress}
            onChangeText={setEmailAddress}
          />

          <PasswordField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${PASSWORD_MINIMUM} characters`}
            autoComplete="new-password"
            textContentType="newPassword"
            showRule
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonBusy]}
            onPress={handleSignUp}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.terms}>
            By creating an account, you agree to our{" "}
            <Text
              style={styles.termsLink}
              onPress={() => router.push("/terms")}
            >
              Terms
            </Text>{" "}
            and{" "}
            <Text
              style={styles.termsLink}
              onPress={() => router.push("/privacy")}
            >
              Privacy Policy
            </Text>
            .
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
    backgroundColor: "#ECEBF2",
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
    backgroundColor: "#4A2D5C",
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
    color: "#111114",
    letterSpacing: 0.3,
  },

  content: {
    width: "100%",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#4A2D5C",
    marginBottom: 10,
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111114",
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
    color: "#111114",
    marginBottom: 8,
  },

  input: {
    height: 54,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E6EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111114",
    marginBottom: 18,
  },

  button: {
    height: 54,
    backgroundColor: "#4A2D5C",
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
    borderColor: "#4A2D5C",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  outlineButtonText: {
    color: "#4A2D5C",
    fontSize: 16,
    fontWeight: "700",
  },

  termsLink: {
    color: "#4A2D5C",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  terms: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(60,60,67,0.6)",
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
    backgroundColor: "#E9E6EB",
  },

  dividerText: {
    fontSize: 12,
    color: "rgba(60,60,67,0.6)",
    marginHorizontal: 10,
  },

  error: {
    color: "#FF3B30",
    fontSize: 13,
    marginBottom: 12,
  },

  notice: {
    color: "#4F6F52",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  buttonBusy: {
    opacity: 0.7,
  },

  secondaryAction: {
    textAlign: "center",
    color: "#4A2D5C",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
  },

  emailText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111114",
    marginBottom: 24,
  },
});
