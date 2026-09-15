import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
    return (
      <SafeAreaView style={styles.screen}>
        <GlassBackground>
          <View style={styles.splash}>
            <View style={styles.logoCircle}>
              <Text style={styles.logo}>♡</Text>
            </View>

            <Text style={styles.splashBrand}>BETWEEN US</Text>

            <ActivityIndicator
              size="small"
              color="#6B4E45"
              style={styles.splashSpinner}
            />
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <GlassBackground>
        <View style={styles.container}>
          {/* TOP */}

          <View style={styles.top}>
            <Text style={styles.brand}>BETWEEN US</Text>

            <View style={styles.logoCircle}>
              <Text style={styles.logo}>♡</Text>
            </View>
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

  splashBrand: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: "#6B4E45",
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
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#6B4E45",
  },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    fontSize: 25,
    color: "#6B4E45",
    marginTop: -2,
  },

  content: {
    marginTop: 50,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: "#9A918A",
    marginBottom: 18,
  },

  title: {
    fontSize: 42,
    lineHeight: 47,
    fontWeight: "700",
    color: "#302825",
    letterSpacing: -1,
  },

  titleAccent: {
    color: "#6B4E45",
  },

  description: {
    marginTop: 22,
    fontSize: 15,
    lineHeight: 23,
    color: "#817771",
    maxWidth: 340,
  },

  bottom: {
    marginTop: 40,
  },

  primaryButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: "#6B4E45",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  primaryArrow: {
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
    color: "#6B4E45",
    fontSize: 15,
    fontWeight: "600",
  },

  footerText: {
    textAlign: "center",
    color: "#AAA09A",
    fontSize: 11,
    marginTop: 16,
  },
});
