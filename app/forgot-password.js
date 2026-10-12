import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";

import { T } from "../lib/theme";
import { Button, Card, Press, Icon } from "../components/ui";
import PasswordField, {
  PASSWORD_MINIMUM,
  passwordProblem,
} from "../components/ui/PasswordField";

/*
 * ==========================================
 * FORGOT PASSWORD
 * ==========================================
 *
 * One thing per screen: the email, then the code,
 * then the new password.
 *
 * All three used to be two fields on one screen, and
 * people typed the emailed code into the password box
 * and were told the code was missing. One field at a
 * time cannot be got wrong.
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

    return (
      err?.errors?.[0]?.longMessage ||
      err?.errors?.[0]?.message ||
      err?.message ||
      fallback
    );
  };

  /* 1. ask for the email and send a code */
  const sendCode = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    if (!cleanEmail.includes("@")) {
      setError("Enter the email address on your account.");
      return;
    }

    try {
      setBusy(true);

      const created = await signIn.create({ identifier: cleanEmail });

      if (created?.error) {
        throw new Error(
          created.error.message || "We couldn't find that account.",
        );
      }

      const sent = await signIn.resetPasswordEmailCode.sendCode();

      if (sent?.error) {
        throw new Error(sent.error.message || "We couldn't send the code.");
      }

      setCode("");
      setStage("code");
      setNotice(`We've emailed a code to ${cleanEmail}.`);
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

  /* 2. check the code on its own */
  const checkCode = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    const entered = code.replace(/\D/g, "");

    if (entered.length < 6) {
      setError("That code is six digits. Check your email again.");
      return;
    }

    try {
      setBusy(true);

      const verified = await signIn.resetPasswordEmailCode.verifyCode({
        code: entered,
      });

      if (verified?.error) {
        throw new Error(
          verified.error.message || "That code didn't work. Try again.",
        );
      }

      setStage("password");
      setNotice("Code accepted. Now choose a new password.");
    } catch (err) {
      console.log("RESET VERIFY ERROR:", err);

      setError(
        readableError(
          err,
          "That code didn't work. It may have expired — send yourself a new one.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  /* 3. set the new password */
  const setNewPassword = async () => {
    if (busy) return;

    setError("");
    setNotice("");

    const problem = passwordProblem(password);

    if (problem) {
      setError(problem);
      return;
    }

    try {
      setBusy(true);

      const submitted = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        /* Anyone signed in elsewhere with the old password loses
         * that session, which is the point of a reset. */
        signOutOfOtherSessions: true,
      });

      if (submitted?.error) {
        throw new Error(
          submitted.error.message || "We couldn't set that password.",
        );
      }

      await signIn.finalize();

      /* The auth guard routes from here. */
    } catch (err) {
      console.log("RESET SAVE ERROR:", err);

      setError(readableError(err, "We couldn't set that password."));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");

    try {
      setBusy(true);

      const sent = await signIn.resetPasswordEmailCode.sendCode();

      if (sent?.error) throw new Error(sent.error.message);

      setCode("");
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(readableError(err, "We couldn't send a new code."));
    } finally {
      setBusy(false);
    }
  };

  const steps = ["email", "code", "password"];
  const stepIndex = steps.indexOf(stage);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.nav}>
          <Press
            onPress={() =>
              stage === "email"
                ? router.replace("/sign-in")
                : setStage(steps[stepIndex - 1])
            }
            style={styles.back}
          >
            <Icon name="back" size={20} color={T.label} />
          </Press>

          <View style={styles.progress}>
            {steps.map((name, index) => (
              <View
                key={name}
                style={[styles.bar, index <= stepIndex && styles.barOn]}
              />
            ))}
          </View>

          <View style={styles.back} />
        </View>

        {stage === "email" ? (
          <>
            <Text style={styles.kicker}>Forgot password</Text>

            <Text style={styles.title}>Let&apos;s get you back in</Text>

            <Text style={styles.lede}>
              Tell us the email on your account and we&apos;ll send a six-digit
              code.
            </Text>

            <Card padded={false} style={styles.card}>
              <TextInput
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="you@example.com"
                placeholderTextColor={T.label3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.field}
                onSubmitEditing={sendCode}
              />
            </Card>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Send Me a Code" onPress={sendCode} busy={busy} />
          </>
        ) : stage === "code" ? (
          <>
            <Text style={styles.kicker}>Step 2 of 3</Text>

            <Text style={styles.title}>Enter the code</Text>

            <Text style={styles.lede}>
              We emailed six digits to {cleanEmail}. Nothing else to fill in on
              this screen.
            </Text>

            <Card padded={false} style={styles.card}>
              <TextInput
                value={code}
                onChangeText={(value) =>
                  setCode(value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                placeholderTextColor={T.label3}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                autoFocus
                maxLength={6}
                style={[styles.field, styles.code]}
                onSubmitEditing={checkCode}
              />
            </Card>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Check the Code"
              onPress={checkCode}
              busy={busy}
              disabled={code.length < 6}
            />

            <Button
              title="Send me a new code"
              kind="plain"
              onPress={resend}
              disabled={busy}
            />
          </>
        ) : (
          <>
            <Text style={styles.kicker}>Step 3 of 3</Text>

            <Text style={styles.title}>Choose a new password</Text>

            <Text style={styles.lede}>
              At least {PASSWORD_MINIMUM} characters. You can tap the eye to
              check what you typed.
            </Text>

            <PasswordField
              value={password}
              onChangeText={setPassword}
              placeholder={`At least ${PASSWORD_MINIMUM} characters`}
              autoComplete="new-password"
              textContentType="newPassword"
              showRule
              onSubmitEditing={setNewPassword}
            />

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Change My Password"
              onPress={setNewPassword}
              busy={busy}
              disabled={Boolean(passwordProblem(password))}
            />
          </>
        )}

        <Button
          title="Back to sign in"
          kind="plain"
          onPress={() => router.replace("/sign-in")}
          disabled={busy}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  content: {
    padding: 16,
    paddingTop: 54,
    paddingBottom: 48,
    gap: 14,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },

  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  progress: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
  },

  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: T.fill3,
  },

  barOn: {
    backgroundColor: T.accent,
  },

  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: T.accent,
  },

  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: T.label,
    marginTop: -6,
  },

  lede: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
  },

  card: {
    marginHorizontal: 0,
  },

  field: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: T.label,
  },

  code: {
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: "600",
  },

  notice: {
    fontSize: 13,
    lineHeight: 19,
    color: "#1E8E3E",
  },

  error: {
    fontSize: 13,
    lineHeight: 19,
    color: T.red,
  },
});
