import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const API_URL = "https://between-us-api.between-us.workers.dev";

/*
 * ==========================================
 * AUTO SIGN-OUT
 * ==========================================
 *
 * If the app has been backgrounded for longer
 * than this, require signing in again next time
 * it's opened. Covers both "backgrounded, then
 * reopened" and "backgrounded, force-quit, then
 * relaunched" — the timestamp is written to disk,
 * not just kept in memory.
 */

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const LAST_BACKGROUNDED_KEY = "betweenus_last_backgrounded_at";

async function checkInactivityTimeout({ signOut, router }) {
  try {
    const stored = await SecureStore.getItemAsync(LAST_BACKGROUNDED_KEY);

    if (!stored) return;

    // Always consume the timestamp once it's been checked,
    // so a stale value never lingers to wrongly trigger a
    // sign-out on some unrelated later session.
    await SecureStore.deleteItemAsync(LAST_BACKGROUNDED_KEY);

    const elapsed = Date.now() - Number(stored);

    if (elapsed >= INACTIVITY_LIMIT_MS) {
      console.log("AUTO SIGN-OUT: inactive for", elapsed, "ms");

      await signOut();

      router.replace("/");
    }
  } catch (error) {
    console.log("INACTIVITY CHECK ERROR:", error);
  }
}

/*
 * ==========================================
 * NOTIFICATION BEHAVIOUR
 * ==========================================
 *
 * This controls how notifications behave while
 * the app is open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/*
 * ==========================================
 * REGISTER FOR PUSH NOTIFICATIONS
 * ==========================================
 */

async function registerForPushNotificationsAsync(userId) {
  if (!userId) {
    return null;
  }

  /*
   * Push notifications require a physical device.
   */
  if (!Device.isDevice) {
    console.log("NOTIFICATIONS: Push notifications require a physical device.");

    return null;
  }

  try {
    /*
     * Check existing permission.
     */
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    /*
     * Ask the user if permission has not already
     * been granted.
     */
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("NOTIFICATIONS: Permission not granted.");

      return null;
    }

    /*
     * Android notification channel.
     */
    if (Device.osName === "Android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6B4E45",
      });
    }

    /*
     * Expo project ID.
     *
     * This is required when generating an Expo push token.
     */
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log(
        "NOTIFICATIONS: No Expo projectId found. Push token cannot be generated.",
      );

      return null;
    }

    /*
     * Get the Expo push token.
     */
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenResponse?.data;

    console.log("NOTIFICATIONS PUSH TOKEN:", pushToken);

    if (!pushToken) {
      return null;
    }

    /*
     * Send the token to our backend.
     */
    const response = await fetch(`${API_URL}/users/${userId}/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        push_token: pushToken,
        platform: Device.osName,
      }),
    });

    const data = await response.json();

    console.log("NOTIFICATIONS TOKEN SAVE RESPONSE:", data);

    if (!response.ok) {
      console.log("NOTIFICATIONS: Backend rejected push token:", data?.error);

      return null;
    }

    console.log("NOTIFICATIONS: Push token saved successfully.");

    return pushToken;
  } catch (error) {
    console.log("NOTIFICATIONS REGISTRATION ERROR:", error);

    return null;
  }
}

/*
 * ==========================================
 * AUTH GUARD
 * ==========================================
 */

function AuthGuard() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();

  const router = useRouter();

  const segments = useSegments();

  const [profileStatus, setProfileStatus] = useState("unknown");

  /*
   * ==========================================
   * CHECK PROFILE
   * ==========================================
   */

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      setProfileStatus("signed-out");

      return;
    }

    async function checkProfile() {
      try {
        console.log("AUTH: checking profile for", userId);

        setProfileStatus("checking");

        const response = await fetch(`${API_URL}/users/${userId}/profile`);

        const data = await response.json();

        console.log("AUTH PROFILE:", data);

        if (cancelled) {
          return;
        }

        setProfileStatus(data?.exists === true ? "exists" : "missing");
      } catch (error) {
        console.log("AUTH PROFILE ERROR:", error);

        if (!cancelled) {
          setProfileStatus("missing");
        }
      }
    }

    checkProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  /*
   * ==========================================
   * REGISTER PUSH NOTIFICATIONS
   * ==========================================
   *
   * Only register once the user is signed in.
   */

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      return;
    }

    registerForPushNotificationsAsync(userId);
  }, [isLoaded, isSignedIn, userId]);

  /*
   * ==========================================
   * HEARTBEAT
   * ==========================================
   *
   * Lets the scheduled job on the backend know
   * this user is still active, so it doesn't
   * send inactivity nudges to people still using
   * the app.
   */

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      return;
    }

    fetch(`${API_URL}/users/${userId}/heartbeat`, {
      method: "POST",
    }).catch((error) => {
      console.log("HEARTBEAT ERROR:", error);
    });
  }, [isLoaded, isSignedIn, userId]);

  /*
   * ==========================================
   * AUTO SIGN-OUT AFTER INACTIVITY
   * ==========================================
   *
   * If the app was backgrounded for over an hour,
   * sign the user out and send them back to the
   * welcome screen instead of leaving their session
   * open indefinitely.
   */

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Also check right away, in case the app was
    // force-quit while backgrounded and is only now
    // being relaunched.
    checkInactivityTimeout({ signOut, router });

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        SecureStore.setItemAsync(
          LAST_BACKGROUNDED_KEY,
          String(Date.now()),
        ).catch((error) => {
          console.log("BACKGROUND TIMESTAMP ERROR:", error);
        });
      } else if (nextState === "active") {
        checkInactivityTimeout({ signOut, router });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoaded, isSignedIn, signOut, router]);

  /*
   * ==========================================
   * ROUTING
   * ==========================================
   */

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const currentRoute = segments[0];

    console.log(
      "AUTH ROUTING:",
      JSON.stringify({
        isLoaded,
        isSignedIn,
        userId,
        profileStatus,
        currentRoute,
      }),
    );

    /*
     * SIGNED OUT
     */
    if (!isSignedIn) {
      return;
    }

    /*
     * STILL CHECKING PROFILE
     */
    if (profileStatus === "checking") {
      return;
    }

    /*
     * PROFILE EXISTS
     */
    if (profileStatus === "exists") {
      if (
        currentRoute === undefined ||
        currentRoute === "sign-in" ||
        currentRoute === "sign-up" ||
        currentRoute === "onboarding"
      ) {
        console.log("AUTH: sending existing user to home");

        router.replace("/(tabs)/home");
      }

      return;
    }

    /*
     * PROFILE DOES NOT EXIST
     */
    if (profileStatus === "missing") {
      if (currentRoute !== "onboarding") {
        console.log("AUTH: sending new user to onboarding");

        router.replace("/onboarding");
      }

      return;
    }
  }, [isLoaded, isSignedIn, userId, profileStatus, segments]);

  /*
   * DO NOT SHOW A CUSTOM LOADING SCREEN.
   */

  return <Slot />;
}

/*
 * ==========================================
 * ROOT LAYOUT
 * ==========================================
 */

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthGuard />
    </ClerkProvider>
  );
}
