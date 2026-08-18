import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useClerk, useAuth } from "@clerk/expo";

import { questions } from "../components/onboarding/questions";
import ProgressBar from "../components/onboarding/ProgressBar";
import QuestionCard from "../components/onboarding/QuestionCard";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function OnboardingScreen() {
  const router = useRouter();

  const { signOut } = useClerk();
  const { userId, isLoaded } = useAuth();

  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [answers, setAnswers] = useState({
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
    goals: [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const question = questions[currentQuestion];

  const updateAnswer = (value) => {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: value,
    }));

    setError("");
  };

  const canContinue = () => {
    const value = answers[question.id];

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return String(value || "").trim().length > 0;
  };

  const saveProfile = async () => {
    if (!isLoaded || !userId) {
      throw new Error("Your account is not ready yet. Please try again.");
    }

    console.log("SAVING ONBOARDING PROFILE FOR:", userId);

    const response = await fetch(`${API_URL}/users/${userId}/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: answers.firstName,
        birthday: answers.birthday,
        gender: answers.gender,
        country: answers.country,
        relationshipStatus: answers.relationshipStatus,
      }),
    });

    const data = await response.json();

    console.log("PROFILE SAVE RESPONSE:", data);

    if (!response.ok) {
      throw new Error(data?.error || "Unable to save your profile.");
    }

    return data;
  };

  const handleNext = async () => {
    if (saving) return;

    if (!canContinue()) return;

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      return;
    }

    try {
      setSaving(true);
      setError("");

      console.log("ONBOARDING FINISHED");
      console.log("ONBOARDING ANSWERS:", answers);

      await saveProfile();

      console.log("ONBOARDING PROFILE SAVED");

      /*
       * The database now knows that this user
       * has completed onboarding.
       *
       * Only navigate after the save succeeds.
       */

      router.replace("/(tabs)/home");
    } catch (error) {
      console.log("ONBOARDING SAVE ERROR:", error);

      setError(
        error?.message || "Something went wrong while saving your profile.",
      );

      setSaving(false);
    }
  };

  const handleBack = () => {
    if (saving) return;

    if (currentQuestion === 0) return;

    setCurrentQuestion((prev) => prev - 1);
  };

  const handleSignOut = async () => {
    if (saving) return;

    try {
      console.log("SIGNING OUT FROM ONBOARDING...");

      await signOut();

      console.log("SIGNED OUT");

      router.replace("/");
    } catch (error) {
      console.log("SIGN OUT ERROR:", error);
    }
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6B4E45" />

          <Text style={styles.loadingText}>Preparing your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Between Us</Text>

            <Text style={styles.subtitle}>Let's get to know you</Text>
          </View>

          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutButton}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* PROGRESS */}

        <Text style={styles.counter}>
          {currentQuestion + 1} of {questions.length}
        </Text>

        <ProgressBar current={currentQuestion} total={questions.length} />

        {/* QUESTION */}

        <View style={styles.questionContainer}>
          <QuestionCard
            question={question}
            value={answers[question.id]}
            onChange={updateAnswer}
          />
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
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#E9DED8",
  },

  signOutText: {
    color: "#6B4E45",
    fontSize: 13,
    fontWeight: "600",
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#817771",
  },
});
