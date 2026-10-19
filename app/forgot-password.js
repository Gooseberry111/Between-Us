import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";

import { T } from "../lib/theme";
import {
  AuthHeader,
  AuthScreen,
  Button,
  CodeField,
  FieldRow,
  Group,
  GroupFooter,
  Notice,
  PasswordRow,
  TextLink,
} from "../components/ui";
import {
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

  const goBack = () => {
    if (busy) return;

    if (stage === "email") {
      if (router.canGoBack()) router.back();
      else router.replace("/sign-in");
    } else {
      setError("");
      setNotice("");
      setStage(steps[stepIndex - 1]);
    }
  };

  const tooShort = password ? passwordProblem(password) : null;

  return (
    <AuthScreen
      centred
      onBack={goBack}
      footer={
        <TextLink onPress={() => router.replace("/sign-in")} disabled={busy}>
          Back to Sign In
        </TextLink>
      }
    >
      {/* Where you are: three short bars. */}
      <View style={styles.progress}>
        {steps.map((name, index) => (
          <View
            key={name}
            style={[styles.bar, index <= stepIndex && styles.barOn]}
          />
        ))}
      </View>

      {stage === "email" ? (
        <>
          <AuthHeader
            kicker="Step 1 of 3"
            title="Let's get you back in"
            subtitle="Tell us the email on your account and we'll send a six-digit code."
          />

          <Group>
            <FieldRow
              label="Email"
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
          </Group>

          <Notice tone="info">{notice}</Notice>

          <Notice>{error}</Notice>

          <Button title="Send Me a Code" onPress={sendCode} busy={busy} />
        </>
      ) : stage === "code" ? (
        <>
          <AuthHeader
            kicker="Step 2 of 3"
            title="Enter the code"
            subtitle={`We emailed six digits to ${cleanEmail}.`}
          />

          <CodeField
            value={code}
            onChangeText={setCode}
            onSubmitEditing={checkCode}
          />

          <Notice tone="info">{notice}</Notice>

          <Notice>{error}</Notice>

          <Button
            title="Check the Code"
            onPress={checkCode}
            busy={busy}
            disabled={code.length < 6}
          />

          <TextLink onPress={resend} disabled={busy}>
            Send Me a New Code
          </TextLink>
        </>
      ) : (
        <>
          <AuthHeader
            kicker="Step 3 of 3"
            title="Choose a new password"
            subtitle="Tap the eye to check what you typed."
          />

          <Group>
            <PasswordRow
              label="New"
              value={password}
              onChangeText={setPassword}
              placeholder={`${PASSWORD_MINIMUM}+ characters`}
              autoComplete="new-password"
              textContentType="newPassword"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={setNewPassword}
            />
          </Group>

          <GroupFooter>
            {!password
              ? `Use at least ${PASSWORD_MINIMUM} characters.`
              : tooShort
                ? `${PASSWORD_MINIMUM - password.length} more to go.`
                : "Long enough."}
          </GroupFooter>

          <Notice tone="info">{notice}</Notice>

          <Notice>{error}</Notice>

          <Button
            title="Change My Password"
            onPress={setNewPassword}
            busy={busy}
            disabled={Boolean(tooShort) || !password}
          />
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    width: 150,
  },

  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.fill2,
  },

  barOn: {
    backgroundColor: T.accent,
  },
});
