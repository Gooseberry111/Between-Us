import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RETURNING_USER_KEY } from "../lib/auth";
import { apiFetch, setTokenProvider } from "../lib/api";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
    const response = await apiFetch(`/users/${userId}/push-token`, {
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
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  /*
   * Hand Clerk's token getter to the API client. This is
   * done during render, not in an effect: React runs child
   * effects before parent ones, so screens would otherwise
   * send their first requests with no token and get 401s.
   */
  setTokenProvider(getToken);

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

    /*
     * Only a successful "no profile" answer means onboarding.
     *
     * This used to treat any failure the same way -- a rejected
     * token, a dropped connection -- so an existing user could
     * be sent back to onboarding, whose save deletes and rewrites
     * their answers. Failures now retry instead of guessing.
     */
    async function checkProfile(attempt = 0) {
      try {
        if (attempt === 0) setProfileStatus("checking");

        const response = await apiFetch(`/users/${userId}/profile`);
        const data = await response.json();

        if (cancelled) return;

        if (response.ok) {
          setProfileStatus(data?.exists === true ? "exists" : "missing");
          return;
        }

        console.log("AUTH PROFILE CHECK FAILED:", response.status, data?.error);
      } catch (error) {
        console.log("AUTH PROFILE ERROR:", error);
      }

      if (cancelled) return;

      /* Back off, capped, and keep trying while signed in. */
      const delay = Math.min(8000, 1000 * 2 ** attempt);
      retryTimer = setTimeout(() => checkProfile(attempt + 1), delay);
    }

    let retryTimer = null;

    checkProfile();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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

    apiFetch(`/users/${userId}/heartbeat`, {
      method: "POST",
    }).catch((error) => {
      console.log("HEARTBEAT ERROR:", error);
    });
  }, [isLoaded, isSignedIn, userId]);

  /*
   * Remember that this device has an account, so the
   * welcome screen can show "sign in" rather than
   * "get started" next time.
   */

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    SecureStore.setItemAsync(RETURNING_USER_KEY, "1").catch((error) => {
      console.log("RETURNING USER FLAG ERROR:", error);
    });
  }, [isLoaded, isSignedIn]);

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
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AuthGuard />
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
