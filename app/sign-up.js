import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useSignUp } from "@clerk/expo";
import { useRouter } from "expo-router";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const onSignUpPress = async () => {
    if (!isLoaded) {
      console.log("Clerk not loaded yet");
      return;
    }
    setError("");

    console.log("Attempting sign up with:", emailAddress);

    try {
      const result = await signUp.create({
        emailAddress,
        password,
      });
      console.log("Sign up create result:", result);

      await signUp.prepareVerification({ strategy: "email_code" });
      console.log("Verification email sent");
      setPendingVerification(true);
    } catch (err) {
      console.log("Sign up error:", JSON.stringify(err, null, 2));
      setError(err.errors?.[0]?.message || "Something went wrong");
    }
  };

  const onVerifyPress = async () => {
    if (!isLoaded) return;
    setError("");

    try {
      const result = await signUp.attemptVerification({
        strategy: "email_code",
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || "Invalid code");
    }
  };
  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }
  if (pendingVerification) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a code to {emailAddress}</Text>

        <TextInput
          style={styles.input}
          value={code}
          placeholder="Enter 6-digit code"
          keyboardType="number-pad"
          onChangeText={setCode}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={onVerifyPress}>
          <Text style={styles.buttonText}>Verify</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={emailAddress}
        placeholder="Email"
        onChangeText={setEmailAddress}
      />
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={onSignUpPress}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "red", marginBottom: 12 },
});
