import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useClerk, useAuth, useUser } from "@clerk/expo";

import { questions } from "../components/onboarding/questions";
import ProgressBar from "../components/onboarding/ProgressBar";
import QuestionCard from "../components/onboarding/QuestionCard";
import { apiFetch } from "../lib/api";
import { birthdayError } from "../lib/validation";
import { clearCachedData } from "../lib/dataCache";
import { isAnswered, notifyProfileSaved } from "../lib/profileProgress";
import { T } from "../lib/theme";
import {
  AuthHeader,
  AuthScreen,
  Button,
  GlassButton,
  Glow,
  Notice,
  TextLink,
} from "../components/ui";

/*
 * ==========================================
 * ONBOARDING
 * ==========================================
 *
 * One question a screen. Back on the left, Skip on the
 * right once your name and birthday are in, a thin bar
 * for how far along you are, and Continue pinned above
 * the keyboard.
 */

const EMPTY_ANSWERS = {
  firstName: "",
  lastName: "",
  nickname: "",
  birthday: "",
  gender: "",
  country: "",
  relationshipStatus: "",
  personalityType: "",
  communicationStyle: "",
  conflictStyle: "",
  affectionStyle: "",
  loveLanguages: [],
  favoriteFood: "",
  favoriteSnack: "",
  favoriteDrink: "",
  favoriteColor: "",
  musicGenre: "",
  movieGenre: "",
  focusAreas: [],
};

export default function OnboardingScreen() {
  const router = useRouter();

  const { signOut } = useClerk();
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();

  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [answers, setAnswers] = useState(EMPTY_ANSWERS);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /*
   * "loading" | "ready" | "failed". Someone coming back from
   * Home already has answers saved, and saving rewrites all of
   * them -- so the form must never open blank for them. If the
   * saved answers can't be loaded, there is nothing to save.
   */
  const [loadState, setLoadState] = useState("loading");
  const [resuming, setResuming] = useState(false);

  const loadSavedAnswers = useCallback(async () => {
    if (!isLoaded || !userId) return;

    setLoadState("loading");

    try {
      const response = await apiFetch(`/users/${userId}/onboarding`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your answers.");
      }

      if (data?.exists) {
        const saved = { ...EMPTY_ANSWERS };

        Object.keys(EMPTY_ANSWERS).forEach((key) => {
          if (isAnswered(data.answers?.[key])) saved[key] = data.answers[key];
        });

        const firstGap = questions.findIndex(
          (item) => !isAnswered(saved[item.id]),
        );

        setAnswers(saved);
        setResuming(true);
        setCurrentQuestion(firstGap === -1 ? 0 : firstGap);
      }

      setLoadState("ready");
    } catch (loadError) {
      console.log("ONBOARDING LOAD ERROR:", loadError);
      setLoadState("failed");
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    loadSavedAnswers();
  }, [loadSavedAnswers]);

  const question = questions[currentQuestion];

  const updateAnswer = (value) => {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: value,
    }));

    setError("");
  };

  /*
   * Birthday is checked on its own step. Nothing saves until
   * the last question, so a bad date used to surface only
   * after everything else had been answered.
   */
  const birthdayValue = String(answers.birthday || "");
  const stepError =
    question.id === "birthday" && birthdayValue.length === 10
      ? birthdayError(birthdayValue)
      : null;

  /*
   * Name and birthday are what the app can't work without
   * (greetings, birthday reminders, the age check). Everything
   * after them can wait, so Skip unlocks once both are in.
   */
  const hasEssentials =
    String(answers.firstName || "").trim().length > 0 &&
    birthdayError(answers.birthday) === null;

  const canContinue = () => {
    const value = answers[question.id];

    if (question.id === "birthday") {
      return birthdayError(value) === null;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return String(value || "").trim().length > 0;
  };

  const saveProfile = async () => {
    if (!isLoaded || !userId) {
      throw new Error("Your account is not ready yet. Please try again.");
    }

    const response = await apiFetch(`/onboarding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clerk_id: userId,
        email: user?.primaryEmailAddress?.emailAddress || "",

        firstName: answers.firstName,
        lastName: answers.lastName,
        nickname: answers.nickname,
        birthday: answers.birthday,
        gender: answers.gender,
        country: answers.country,
        relationshipStatus: answers.relationshipStatus,

        communicationStyle: answers.communicationStyle,
        affectionStyle: answers.affectionStyle,
        loveLanguages: answers.loveLanguages,

        favoriteFood: answers.favoriteFood,
        favoriteSnack: answers.favoriteSnack,
        favoriteDrink: answers.favoriteDrink,
        favoriteColor: answers.favoriteColor,

        musicGenre: answers.musicGenre,
        movieGenre: answers.movieGenre,

        personalityType: answers.personalityType,
        conflictStyle: answers.conflictStyle,
        focusAreas: answers.focusAreas,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || "Unable to save your onboarding information.",
      );
    }

    return data;
  };

  const saveAndGoHome = async () => {
    try {
      setSaving(true);
      setError("");

      await saveProfile();

      console.log("ONBOARDING PROFILE SAVED");

      /*
       * Tell the auth guard first, and give it a beat to
       * settle, so arriving on Home isn't mistaken for a new
       * user wandering off onboarding.
       */
      notifyProfileSaved();
      clearCachedData(`home:${userId}`);

      await new Promise((resolve) => setTimeout(resolve, 50));

      router.replace("/(tabs)/home");
    } catch (error) {
      console.log("ONBOARDING SAVE ERROR:", error);

      setError(
        error?.message || "Something went wrong while saving your profile.",
      );

      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (saving) return;

    if (!canContinue()) return;

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      return;
    }

    await saveAndGoHome();
  };

  const handleSkip = async () => {
    if (saving || !hasEssentials) return;

    await saveAndGoHome();
  };

  const handleBack = () => {
    if (saving) return;

    if (currentQuestion === 0) return;

    setCurrentQuestion((prev) => prev - 1);
  };

  const handleSignOut = async () => {
    if (saving) return;

    try {
      await signOut();

      router.replace("/");
    } catch (error) {
      console.log("SIGN OUT ERROR:", error);
    }
  };

  if (isLoaded && loadState === "failed") {
    return (
      <AuthScreen
        centred
        footer={
          <TextLink onPress={handleSignOut}>Use a Different Account</TextLink>
        }
      >
        <AuthHeader
          title="We couldn't load your answers"
          subtitle="Check your connection and try again."
        />

        <Button title="Try Again" onPress={loadSavedAnswers} />
      </AuthScreen>
    );
  }

  if (!isLoaded || loadState === "loading") {
    return (
      <AuthScreen centred>
        <AuthHeader title="Between Us" subtitle="Getting your profile ready…" />

        <ActivityIndicator color={T.accent} />
      </AuthScreen>
    );
  }

  const last = currentQuestion === questions.length - 1;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Glow height={260} />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Back, where you are, Skip. */}
        <View style={styles.nav}>
          <View style={styles.navSide}>
            {currentQuestion > 0 && !saving ? (
              <GlassButton icon="back" label="Back" onPress={handleBack} />
            ) : null}
          </View>

          <Text style={styles.counter}>
            {resuming ? "Finish your profile" : "About you"} ·{" "}
            {currentQuestion + 1} of {questions.length}
          </Text>

          <View style={[styles.navSide, styles.navEnd]}>
            <Text
              style={[
                styles.skip,
                (!hasEssentials || saving) && styles.skipOff,
              ]}
              onPress={hasEssentials && !saving ? handleSkip : undefined}
              accessibilityRole="button"
              accessibilityLabel="Skip the rest for now"
            >
              Skip
            </Text>
          </View>
        </View>

        <View style={styles.progress}>
          <ProgressBar current={currentQuestion} total={questions.length} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <QuestionCard
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={updateAnswer}
          />

          <Notice>{stepError}</Notice>

          <Notice>{error}</Notice>

          {!hasEssentials ? (
            <Text style={styles.hint}>
              Your name and birthday first. Then you can skip the rest and
              finish later.
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={saving ? "Saving…" : last ? "Finish" : "Continue"}
            onPress={handleNext}
            busy={saving}
            disabled={!canContinue()}
          />

          {/* Until Skip unlocks there is no other way out, so
              someone signed in with the wrong account can leave. */}
          {!hasEssentials && !saving ? (
            <TextLink onPress={handleSignOut}>
              Not You? Use a Different Account
            </TextLink>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  fill: {
    flex: 1,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  navSide: {
    flex: 1,
    flexDirection: "row",
  },

  navEnd: {
    justifyContent: "flex-end",
  },

  counter: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
  },

  skip: {
    fontSize: 17,
    color: T.accent,
    paddingVertical: 8,
    paddingLeft: 12,
  },

  skipOff: {
    color: T.label3,
  },

  progress: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },

  content: {
    paddingTop: 26,
    paddingBottom: 24,
    gap: 14,
  },

  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    paddingHorizontal: 20,
  },

  footer: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
});
