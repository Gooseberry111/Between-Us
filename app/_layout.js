import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const API_URL = "https://between-us-api.between-us.workers.dev";

function AuthGuard() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [profileStatus, setProfileStatus] = useState("unknown");

  /*
   * Check profile only when the user is signed in.
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

        if (cancelled) return;

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
   * Routing
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
     *
     * IMPORTANT:
     * Never redirect signed-out users.
     *
     * This allows:
     * /
     * /sign-in
     * /sign-up
     * to work normally.
     */
    if (!isSignedIn) {
      return;
    }

    /*
     * Still checking profile.
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

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthGuard />
    </ClerkProvider>
  );
}
