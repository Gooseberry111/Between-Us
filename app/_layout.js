import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const currentScreen = segments[0];

    const inAuthScreen =
      currentScreen === "sign-in" || currentScreen === "sign-up";

    const inOnboarding = currentScreen === "onboarding";
    const inTabs = currentScreen === "(tabs)";

    // User is signed out
    if (!isSignedIn && !inAuthScreen && currentScreen !== "index") {
      router.replace("/");
      return;
    }

    // User just signed in
    if (isSignedIn && inAuthScreen) {
      router.replace("/onboarding");
      return;
    }

    // Signed-in user is somewhere they shouldn't be
    if (isSignedIn && !inOnboarding && !inTabs && currentScreen !== "index") {
      router.replace("/onboarding");
    }
  }, [isSignedIn, isLoaded, segments]);

  return <Slot />;
}

export default function RootLayout() {
  console.log("KEY EXISTS:", !!publishableKey);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthGuard />
    </ClerkProvider>
  );
}
