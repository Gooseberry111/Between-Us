import { useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useSignIn, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { T } from "../lib/theme";
import {
  AuthHeader,
  AuthScreen,
  Button,
  CodeField,
  FieldRow,
  Group,
  Notice,
  PasswordRow,
  TextLink,
} from "../components/ui";

/*
 * ==========================================
 * SIGN IN
 * ==========================================
 *
 * Email and password in one grouped form, the way
 * Settings asks for an account. A phone Clerk has not
 * seen before gets a code by email before it is
 * trusted, on the same screen.
 */

export default function SignInScreen() {
  const router = useRouter();

  const { signIn, errors } = useSignIn();
  const { isLoaded } = useAuth();

  const passwordInput = useRef(null);

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

  const handleBack = () => {
    if (loading) return;

    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const handleCreateAccount = () => {
    if (loading) return;

    router.replace("/sign-up");
  };

  if (!isLoaded) {
    return (
      <AuthScreen centred>
        <AuthHeader title="Between Us" subtitle="Getting things ready…" />

        <ActivityIndicator color={T.accent} />
      </AuthScreen>
    );
  }

  if (verifying) {
    return (
      <AuthScreen
        onBack={() => {
          setVerifying(false);
          setCode("");
          setError("");
          setNotice("");
        }}
      >
        <AuthHeader
          title="Check your email"
          subtitle={`We sent a code to ${email.trim()} to confirm this phone is yours.`}
        />

        <CodeField
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError("");
          }}
          onSubmitEditing={handleVerifyDevice}
        />

        <Notice tone="info">{notice}</Notice>

        <Notice>{error}</Notice>

        <Button
          title="Confirm It's Me"
          onPress={handleVerifyDevice}
          busy={loading}
          disabled={code.trim().length < 4}
        />

        <TextLink onPress={handleResendDeviceCode} disabled={loading}>
          Send Me a New Code
        </TextLink>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      onBack={handleBack}
      footer={
        <TextLink onPress={handleCreateAccount} disabled={loading}>
          New here? Create an Account
        </TextLink>
      }
    >
      <AuthHeader
        title="Welcome back"
        subtitle="Sign in to pick up where you left off."
      />

      <Group>
        <FieldRow
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          editable={!loading}
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
          placeholder="Required"
          autoComplete="current-password"
          textContentType="password"
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />
      </Group>

      <Notice>{error}</Notice>

      <Button
        title={loading ? "Signing In…" : "Sign In"}
        onPress={handleSignIn}
        busy={loading}
      />

      <TextLink
        onPress={() => router.push("/forgot-password")}
        disabled={loading}
      >
        Forgot Your Password?
      </TextLink>
    </AuthScreen>
  );
}
