import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { GlassBackground } from "../components/Glass";
import { RETURNING_USER_KEY } from "../lib/auth";

/*
 * ==========================================
 * WELCOME
 * ==========================================
 *
 * Three different jobs depending on who is looking:
 *
 * - Auth still resolving, or already signed in: show
 *   the brand and nothing else. This screen used to
 *   flash "Get Started" at signed-in people during the
 *   moment before the guard redirected them home.
 * - Been here before: offer to sign in.
 * - Genuinely new: make the case for the app.
 */

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
   * Hold the brand until we know enough to show the
   * right thing. A signed-in user is about to be sent
   * home by the auth guard, so they should never see
   * a sign-up pitch on the way.
   */
  if (!isLoaded || isSignedIn || returning === null) {
    /*
     * The launch screen is still up at this point, so anything
     * drawn here would be a second splash behind it. A plain
     * ground keeps the hand-off seamless.
     */
    return <View style={styles.screen} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <View style={styles.container}>
          {/* TOP */}

          <View style={styles.top}>
            <Text style={styles.brand}>BETWEEN US</Text>

            <Image
              source={require("../assets/icon.png")}
              style={styles.headerMark}
              resizeMode="contain"
            />
          </View>

          {/* MAIN */}

          <View style={styles.content}>
            {returning ? (
              <>
                <Text style={styles.eyebrow}>WELCOME BACK</Text>

                <Text style={styles.title}>
                  Good to see you
                  {"\n"}
                  <Text style={styles.titleAccent}>again.</Text>
                </Text>

                <Text style={styles.description}>
                  Sign in to pick up where you left off.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.eyebrow}>FOR THE PEOPLE WHO MATTER</Text>

                <Text style={styles.title}>
                  Relationships
                  {"\n"}
                  worth being
                  {"\n"}
                  <Text style={styles.titleAccent}>intentional about.</Text>
                </Text>

                <Text style={styles.description}>
                  Between Us helps you understand the people you care about,
                  remember what matters to them, and build a stronger connection
                  together.
                </Text>
              </>
            )}
          </View>

          {/* BOTTOM */}

          <View style={styles.bottom}>
            {returning ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.primaryButton}
                  onPress={() => router.push("/sign-in")}
                >
                  <Text style={styles.primaryText}>Sign in</Text>

                  <Text style={styles.primaryArrow}>→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.secondaryButton}
                  onPress={() => router.push("/sign-up")}
                >
                  <Text style={styles.secondaryText}>
                    Use a different account
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.primaryButton}
                  onPress={() => router.push("/sign-up")}
                >
                  <Text style={styles.primaryText}>Get Started</Text>

                  <Text style={styles.primaryArrow}>→</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.secondaryButton}
                  onPress={() => router.push("/sign-in")}
                >
                  <Text style={styles.secondaryText}>
                    I already have an account
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.footerText}>
              A private space for meaningful relationships.
            </Text>
          </View>
        </View>
      </GlassBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  splashLogo: {
    width: 260,
    height: 260,
  },

  splashSpinner: {
    marginTop: 18,
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },

  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    fontFamily: "Nunito_700Bold",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#D9456B",
  },

  headerMark: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  content: {
    marginTop: 50,
  },

  eyebrow: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: "#9C8F97",
    marginBottom: 18,
  },

  title: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 42,
    lineHeight: 47,
    fontWeight: "700",
    color: "#2E2430",
    letterSpacing: -1,
  },

  titleAccent: {
    color: "#D9456B",
  },

  description: {
    fontFamily: "Nunito_400Regular",
    marginTop: 22,
    fontSize: 15,
    lineHeight: 23,
    color: "#6B5F68",
    maxWidth: 340,
  },

  bottom: {
    marginTop: 40,
  },

  primaryButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: "#D9456B",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  primaryText: {
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  primaryArrow: {
    fontFamily: "Nunito_400Regular",
    color: "#FFFFFF",
    fontSize: 22,
  },

  secondaryButton: {
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  secondaryText: {
    fontFamily: "Nunito_600SemiBold",
    color: "#D9456B",
    fontSize: 15,
    fontWeight: "600",
  },

  footerText: {
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    color: "#B9A7B1",
    fontSize: 11,
    marginTop: 16,
  },
});
