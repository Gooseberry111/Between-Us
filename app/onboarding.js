import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
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

const EMPTY_ANSWERS = {
  firstName: "",
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
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.failedTitle}>
            We couldn&apos;t load your answers
          </Text>

          <Text style={styles.loadingText}>
            Check your connection and try again.
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadSavedAnswers}
            activeOpacity={0.85}
          >
            <Text style={styles.nextText}>Try again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.differentAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.differentAccountText}>
              Use a different account
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoaded || loadState === "loading") {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6B4E45" />

          <Text style={styles.loadingText}>Preparing your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/*
       * Lift the footer above the keyboard, and let a tap anywhere
       * outside a field close it, so Continue is always reachable.
       */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            {/* HEADER */}

            <View style={styles.header}>
              <View>
                <Text style={styles.brand}>Between Us</Text>

                <Text style={styles.subtitle}>
                  {resuming ? "Finish your profile" : "Let's get to know you"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSkip}
                style={[
                  styles.skipButton,
                  (!hasEssentials || saving) && styles.skipButtonLocked,
                ]}
                disabled={!hasEssentials || saving}
                activeOpacity={0.7}
                accessibilityLabel="Skip the rest for now"
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>

            {/* PROGRESS */}

            <Text style={styles.counter}>
              {currentQuestion + 1} of {questions.length}
            </Text>

            <ProgressBar current={currentQuestion} total={questions.length} />

            {!hasEssentials ? (
              <Text style={styles.skipHint}>
                Your name and birthday first — then you can skip the rest and
                finish later.
              </Text>
            ) : null}

            {/* QUESTION */}

            <View style={styles.questionContainer}>
              <QuestionCard
                question={question}
                value={answers[question.id]}
                onChange={updateAnswer}
              />

              {stepError ? (
                <Text style={styles.stepError}>{stepError}</Text>
              ) : null}
            </View>

            {/* ERROR */}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* FOOTER */}

            <View style={styles.footer}>
              {currentQuestion > 0 && !saving ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  (!canContinue() || saving) && styles.disabledButton,
                ]}
                disabled={!canContinue() || saving}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                {saving ? (
                  <View style={styles.savingContent}>
                    <ActivityIndicator size="small" color="#FFFFFF" />

                    <Text style={styles.nextText}>Saving...</Text>
                  </View>
                ) : (
                  <Text style={styles.nextText}>
                    {currentQuestion === questions.length - 1
                      ? "Finish"
                      : "Continue"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Until Skip unlocks there is no other way out, so
                  someone signed in with the wrong account can leave. */}
              {!hasEssentials && !saving ? (
                <TouchableOpacity
                  onPress={handleSignOut}
                  style={styles.differentAccountFooter}
                  activeOpacity={0.7}
                >
                  <Text style={styles.differentAccountText}>
                    Not you? Use a different account
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  stepError: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#8A4A3D",
  },

  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  brand: {
    fontSize: 22,
    fontWeight: "700",
    color: "#332B28",
  },

  subtitle: {
    fontSize: 13,
    color: "#9A918A",
    marginTop: 4,
  },

  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E9DED8",
  },

  skipButtonLocked: {
    opacity: 0.35,
  },

  skipText: {
    color: "#6B4E45",
    fontSize: 14,
    fontWeight: "700",
  },

  skipHint: {
    marginTop: -12,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#9A918A",
  },

  counter: {
    color: "#8D837C",
    marginTop: 22,
    marginBottom: 12,
    fontSize: 14,
  },

  questionContainer: {
    flex: 1,
    justifyContent: "center",
  },

  errorBox: {
    backgroundColor: "#F3E3DF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  errorText: {
    color: "#8A4A3D",
    fontSize: 13,
    lineHeight: 18,
  },

  footer: {
    marginTop: 24,
  },

  backButton: {
    marginBottom: 12,
    alignItems: "center",
  },

  backText: {
    color: "#6B4E45",
    fontWeight: "600",
    fontSize: 15,
  },

  nextButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    justifyContent: "center",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.4,
  },

  nextText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },

  savingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  differentAccount: {
    marginTop: 18,
    padding: 8,
  },

  differentAccountFooter: {
    marginTop: 14,
    alignItems: "center",
    padding: 6,
  },

  differentAccountText: {
    color: "#9A918A",
    fontSize: 13,
    fontWeight: "600",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#817771",
    textAlign: "center",
  },

  failedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#332B28",
    textAlign: "center",
  },

  retryButton: {
    marginTop: 20,
    height: 50,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    justifyContent: "center",
    alignItems: "center",
  },
});
