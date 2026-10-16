import { useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useSignUp } from "@clerk/expo";
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

  const passwordInput = useRef(null);

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

  const goBack = () => {
    if (busy) return;

    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (pendingVerification) {
    return (
      <AuthScreen
        onBack={() => {
          if (busy) return;

          setPendingVerification(false);
          setCode("");
          setError("");
          setNotice("");
        }}
      >
        <AuthHeader
          kicker="One more step"
          title="Check your email"
          subtitle={`Enter the code we sent to ${cleanEmail}.`}
        />

        <CodeField
          value={code}
          onChangeText={setCode}
          onSubmitEditing={handleVerify}
        />

        <Notice tone="info">{notice}</Notice>

        <Notice>{error}</Notice>

        <Button
          title="Verify Email"
          onPress={handleVerify}
          busy={busy}
          disabled={code.trim().length < 4}
        />

        <TextLink onPress={handleResend} disabled={busy}>
          Send Me a New Code
        </TextLink>
      </AuthScreen>
    );
  }

  const tooShort = password ? passwordProblem(password) : null;

  return (
    <AuthScreen
      onBack={goBack}
      footer={
        <TextLink onPress={() => router.replace("/sign-in")} disabled={busy}>
          Already a Member? Sign In
        </TextLink>
      }
    >
      <AuthHeader
        title="Create your account"
        subtitle="Then find your person and link up."
      />

      <Group>
        <FieldRow
          label="Email"
          value={emailAddress}
          onChangeText={(value) => {
            setEmailAddress(value);
            setError("");
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          returnKeyType="next"
          onSubmitEditing={() => passwordInput.current?.focus()}
          submitBehavior="submit"
        />

        <PasswordRow
          ref={passwordInput}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          placeholder={`${PASSWORD_MINIMUM}+ characters`}
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!busy}
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />
      </Group>

      <GroupFooter>
        {!password
          ? `Use at least ${PASSWORD_MINIMUM} characters.`
          : tooShort
            ? `${tooShort.replace(".", "")} — ${PASSWORD_MINIMUM - password.length} to go.`
            : "Long enough."}
      </GroupFooter>

      <Notice>{error}</Notice>

      <Button title="Create Account" onPress={handleSignUp} busy={busy} />

      <Text style={styles.terms}>
        By creating an account you agree to the{" "}
        <Text style={styles.termsLink} onPress={() => router.push("/terms")}>
          Terms
        </Text>{" "}
        and{" "}
        <Text style={styles.termsLink} onPress={() => router.push("/privacy")}>
          Privacy Policy
        </Text>
        .
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  terms: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    textAlign: "center",
    paddingHorizontal: 32,
  },

  termsLink: {
    color: T.accent,
  },
});
