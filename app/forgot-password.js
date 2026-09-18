import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";

/*
 * ==========================================
 * FORGOT PASSWORD
 * ==========================================
 *
 * Three steps on one screen: ask for the email,
 * take the code from it, then set a new password.
 * Clerk signs the person in once the password is
 * changed, so the auth guard takes it from there.
 */

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn } = useSignIn();

  const [stage, setStage] = useState("email");
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const cleanEmail = emailAddress.trim().toLowerCase();

  const readableError = (err, fallback) => {
    const text = `${err?.message || ""} ${err?.errors?.[0]?.message || ""}`;

    if (/network|timeout|connection|failed to fetch/i.test(text)) {
      return "We couldn't reach the server. Check your connection and try again.";
    }

    return err?.errors?.[0]?.message || err?.message || fallback;
  };

  const sendCode = async () => {
    const result = await signIn.create({ identifier: cleanEmail });

    if (result?.error) {
      throw new Error(result.error.message || "We couldn't find that account.");
    }

    const sent = await signIn.resetPasswordEmailCode.sendCode();

    if (sent?.error) {
      throw new Error(sent.error.message || "We couldn't send the code.");
    }
  };

  const handleSendCode = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    if (!cleanEmail.includes("@")) {
      setError("Enter the email address on your account.");
      return;
    }

    try {
      setBusy(true);

      await sendCode();

      setStage("reset");
      setNotice(`We've sent a code to ${cleanEmail}.`);
    } catch (err) {
      console.log("RESET SEND ERROR:", err);

      setError(
        readableError(
          err,
          "We couldn't start a reset for that email. Check the address and try again.",
        ),
      );
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

      await sendCode();

      setCode("");
      setNotice("A new code is on its way.");
    } catch (err) {
      console.log("RESET RESEND ERROR:", err);

      setError(readableError(err, "We couldn't send a new code."));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }

    if (password.length < 8) {
      setError("Your new password needs at least 8 characters.");
      return;
    }

    try {
      setBusy(true);

      const verified = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });

      if (verified?.error) {
        throw new Error(
          verified.error.message || "That code didn't work. Try again.",
        );
      }

      const submitted = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        /* Anyone signed in elsewhere with the old password
         * loses that session, which is the point of a reset. */
        signOutOfOtherSessions: true,
      });

      if (submitted?.error) {
        throw new Error(
          submitted.error.message || "We couldn't set that password.",
        );
      }

      await signIn.finalize();

      /* The auth guard in _layout.js routes from here. */
    } catch (err) {
      console.log("RESET ERROR:", err);

      setError(readableError(err, "We couldn't reset your password."));
    } finally {
      setBusy(false);
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
          <Text style={styles.eyebrow}>
            {stage === "email" ? "FORGOT PASSWORD" : "ALMOST THERE"}
          </Text>

          <Text style={styles.title}>
            {stage === "email" ? "Let's get you back in" : "Set a new password"}
          </Text>

          <Text style={styles.subtitle}>
            {stage === "email"
              ? "Tell us the email on your account and we'll send you a code."
              : "Enter the code we emailed you, then choose a new password."}
          </Text>

          {stage === "email" ? (
            <>
              <Text style={styles.label}>Email address</Text>

              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#9C8F97"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={emailAddress}
                onChangeText={setEmailAddress}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Code from your email</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter the code"
                placeholderTextColor="#9C8F97"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />

              <Text style={styles.label}>New password</Text>

              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                placeholderTextColor="#9C8F97"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonBusy]}
            onPress={stage === "email" ? handleSendCode : handleReset}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {stage === "email" ? "Send me a code" : "Change my password"}
              </Text>
            )}
          </TouchableOpacity>

          {stage === "reset" ? (
            <TouchableOpacity onPress={handleResend} disabled={busy}>
              <Text style={styles.secondaryAction}>Send me a new code</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => router.replace("/sign-in")}
            disabled={busy}
          >
            <Text style={styles.secondaryAction}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF8F5",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 40,
  },

  header: {
    alignItems: "center",
    marginBottom: 46,
  },

  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#D9456B",
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
    color: "#2E2430",
    letterSpacing: 0.3,
  },

  content: {
    width: "100%",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#D9456B",
    marginBottom: 10,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#2E2430",
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#766D67",
    marginBottom: 28,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A3B45",
    marginBottom: 8,
  },

  input: {
    height: 54,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F2DDE5",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#2E2430",
    marginBottom: 18,
  },

  notice: {
    color: "#4F6F52",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  error: {
    color: "#C2405F",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  button: {
    height: 54,
    backgroundColor: "#D9456B",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  buttonBusy: {
    opacity: 0.7,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryAction: {
    textAlign: "center",
    color: "#D9456B",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
  },
});
