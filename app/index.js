import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";

import { RETURNING_USER_KEY } from "../lib/auth";
import { T } from "../lib/theme";
import {
  AuthScreen,
  Button,
  Cell,
  Group,
  Icon,
  Mark,
  TextLink,
} from "../components/ui";

/*
 * ==========================================
 * WELCOME
 * ==========================================
 *
 * Three different jobs depending on who is looking:
 *
 * - Auth still resolving, or already signed in: a plain
 *   ground, so nothing flashes before the guard sends
 *   them home.
 * - Been here before: one button back in.
 * - Genuinely new: the mark, the name, what the two of
 *   you get, and the way in.
 */

const WHAT_YOU_GET = [
  {
    icon: "lock",
    title: "Three questions a night",
    text: "Sealed until you have both answered",
  },
  {
    icon: "sparkle",
    title: "Dreams you plan together",
    text: "Step by step, ticked off by either of you",
  },
  {
    icon: "chat",
    title: "A way back after a row",
    text: "A pause, then both sides, heard",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  /* null while we are still reading the flag. */
  const [returning, setReturning] = useState(null);

  useEffect(() => {
    let cancelled = false;

    SecureStore.getItemAsync(RETURNING_USER_KEY)
      .then((value) => {
        if (!cancelled) setReturning(value === "1");
      })
      .catch(() => {
        if (!cancelled) setReturning(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * The launch screen is still up at this point, so anything
   * drawn here would be a second splash behind it.
   */
  if (!isLoaded || isSignedIn || returning === null) {
    return <View style={styles.blank} />;
  }

  if (returning) {
    return (
      <AuthScreen
        centred
        footer={
          <>
            <Button title="Sign In" onPress={() => router.push("/sign-in")} />

            <TextLink onPress={() => router.push("/sign-up")}>
              Use a Different Account
            </TextLink>
          </>
        }
      >
        <View style={styles.hero}>
          <Mark size={72} />

          <Text style={styles.word}>Between Us</Text>

          <Text style={styles.line}>Good to see you again.</Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      footer={
        <>
          <Button title="Get Started" onPress={() => router.push("/sign-up")} />

          <TextLink onPress={() => router.push("/sign-in")}>
            I Already Have an Account
          </TextLink>
        </>
      }
    >
      <View style={styles.hero}>
        <Mark size={72} />

        <Text style={styles.word}>Between Us</Text>

        <Text style={styles.line}>A private space for the two of you.</Text>
      </View>

      <Group inset={62}>
        {WHAT_YOU_GET.map((item) => (
          <Cell
            key={item.title}
            leading={
              <View style={styles.badge}>
                <Icon name={item.icon} size={17} color={T.accent} />
              </View>
            }
            title={item.title}
            subtitle={item.text}
          />
        ))}
      </Group>

      <Text style={styles.small}>
        Just the two of you. Nobody else sees what you share.
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  hero: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 26,
    paddingHorizontal: 28,
  },

  word: {
    fontFamily: "ui-serif",
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "600",
    letterSpacing: -0.8,
    color: T.label,
    marginTop: 22,
  },

  line: {
    fontSize: 17,
    lineHeight: 23,
    color: T.label2,
    textAlign: "center",
    marginTop: 6,
  },

  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  small: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
