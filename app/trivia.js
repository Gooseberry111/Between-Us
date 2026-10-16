import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { clearCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  AuthHeader,
  AuthScreen,
  Button,
  Cell,
  GlassButton,
  Glow,
  Group,
  Icon,
  Notice,
  Ring,
  TextLink,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import ProgressBar from "../components/onboarding/ProgressBar";

/*
 * ==========================================
 * TRIVIA
 * ==========================================
 *
 * How well do you know them? One question at a time,
 * answers as a list you pick from, the right one shown
 * in green once you have checked, and a ring for the
 * score at the end. They hear you played.
 */

export default function TriviaScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const [questions, setQuestions] = useState([]);
  const [partnerName, setPartnerName] = useState("your person");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");

  const hasRecordedSession = useRef(false);

  const loadTrivia = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setQuestions([]);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setScore(0);
      setFinished(false);
      hasRecordedSession.current = false;

      const response = await apiFetch(`/users/${userId}/trivia`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load trivia.");
      }

      setPartnerName(data?.partner?.first_name?.trim() || "your person");

      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err) {
      setError(err?.message || "Unable to load today's trivia.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadTrivia();
  }, [loadTrivia]);

  /*
   * ==========================================
   * RECORD THE COMPLETED ROUND
   * ==========================================
   *
   * Fires once per round so the backend knows this
   * couple actually played (used by the inactivity/
   * nudge cron, and to notify the partner right away).
   */
  useEffect(() => {
    if (!finished || hasRecordedSession.current || !userId) {
      return;
    }

    hasRecordedSession.current = true;

    apiFetch(`/users/${userId}/trivia/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        score,
        total_questions: questions.length,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // The history screen's cached list is now out of date.
        clearCachedData(`trivia-history:${userId}`);
      })
      .catch((err) => console.log("TRIVIA COMPLETE ERROR:", err));
  }, [finished, score, questions.length, userId]);

  const currentQuestion = questions[currentIndex];

  const submitAnswer = async () => {
    if (!currentQuestion || !selectedAnswer || submitting || answerResult) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await apiFetch(`/users/${userId}/trivia/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          answer: selectedAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to check answer.");
      }

      setAnswerResult(data);

      Haptics.notificationAsync(
        data.correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});

      if (data.correct) {
        setScore((previous) => previous + 1);
      }
    } catch (err) {
      setError(err?.message || "Unable to check your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= questions.length) {
      setFinished(true);
      return;
    }

    setCurrentIndex(nextIndex);
    setSelectedAnswer(null);
    setAnswerResult(null);
  };

  if (connected === false) {
    return <ConnectFirst feature="Trivia" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  if (loading) {
    return (
      <AuthScreen centred onBack={goBack}>
        <AuthHeader title="Getting your questions" />

        <ActivityIndicator color={T.accent} />
      </AuthScreen>
    );
  }

  if (error && !currentQuestion) {
    return (
      <AuthScreen
        centred
        onBack={goBack}
        footer={<Button title="Try Again" onPress={loadTrivia} />}
      >
        <AuthHeader title="Something went wrong" subtitle={error} />
      </AuthScreen>
    );
  }

  if (finished) {
    const total = questions.length || 1;

    return (
      <AuthScreen
        centred
        footer={
          <>
            <Button title="Play Again" onPress={loadTrivia} />

            <TextLink onPress={() => router.push("/trivia-history")}>
              See Every Round
            </TextLink>
          </>
        }
        onBack={goBack}
      >
        <View style={styles.result}>
          <Ring value={score / total} size={120} label={`${score}/${total}`} />

          <Text style={styles.resultTitle}>
            {score === total
              ? `You really know ${partnerName}`
              : score === 0
                ? "A fresh start"
                : `You know ${partnerName} well`}
          </Text>

          <Text style={styles.resultText}>
            {score === total
              ? "Every one right."
              : "The point isn't to get them all. It's to keep paying attention."}{" "}
            They&apos;ll see you played.
          </Text>
        </View>
      </AuthScreen>
    );
  }

  if (!currentQuestion) {
    return (
      <AuthScreen
        centred
        onBack={goBack}
        footer={<Button title="Back" kind="gray" onPress={goBack} />}
      >
        <AuthHeader
          title="No questions yet"
          subtitle={`Once ${partnerName} has answered more about themselves, there'll be questions here.`}
        />
      </AuthScreen>
    );
  }

  const questionNumber = currentIndex + 1;
  const options = Array.isArray(currentQuestion.options)
    ? currentQuestion.options
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Glow height={240} />

      <View style={styles.nav}>
        <View style={styles.navSide}>
          <GlassButton icon="back" label="Back" onPress={goBack} />
        </View>

        <Text style={styles.counter}>
          {questionNumber} of {questions.length}
        </Text>

        <View style={[styles.navSide, styles.navEnd]}>
          <View style={styles.score}>
            <Icon name="flame" size={14} color={T.secondary} />

            <Text style={styles.scoreText}>{score}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progress}>
        <ProgressBar current={currentIndex} total={questions.length} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.kicker}>About {partnerName}</Text>

          <Text style={styles.question}>{currentQuestion.question}</Text>
        </View>

        <Group inset={58}>
          {options.map((option, index) => {
            const chosen = selectedAnswer === option;
            const right =
              Boolean(answerResult) && answerResult.correct_answer === option;
            const wrong =
              Boolean(answerResult) && chosen && !answerResult.correct;

            return (
              <Cell
                key={`${option}-${index}`}
                leading={
                  <View
                    style={[
                      styles.letter,
                      chosen && !answerResult && styles.letterChosen,
                      right && styles.letterRight,
                      wrong && styles.letterWrong,
                    ]}
                  >
                    <Text
                      style={[
                        styles.letterText,
                        (chosen || right || wrong) && styles.letterTextOn,
                      ]}
                    >
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                }
                title={option}
                trailing={
                  right ? (
                    <Icon name="checkCircle" size={20} color={T.green} />
                  ) : wrong ? (
                    <Icon name="close" size={16} color={T.red} />
                  ) : chosen ? (
                    <Icon name="check" size={18} color={T.accent} />
                  ) : null
                }
                onPress={
                  answerResult
                    ? undefined
                    : () => {
                        Haptics.selectionAsync().catch(() => {});
                        setSelectedAnswer(option);
                      }
                }
              />
            );
          })}
        </Group>

        {answerResult ? (
          <Notice tone={answerResult.correct ? "info" : "error"}>
            {answerResult.correct
              ? "Right. You know them well."
              : `Not quite. It was ${answerResult.correct_answer}.`}
          </Notice>
        ) : null}

        <Notice>{error}</Notice>
      </ScrollView>

      <View style={styles.footer}>
        {!answerResult ? (
          <Button
            title="Check"
            onPress={submitAnswer}
            busy={submitting}
            disabled={!selectedAnswer}
          />
        ) : (
          <Button
            title={
              questionNumber >= questions.length
                ? "See Your Score"
                : "Next Question"
            }
            onPress={nextQuestion}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
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

  score: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: T.surface,
  },

  scoreText: {
    fontFamily: "ui-rounded",
    fontSize: 15,
    fontWeight: "700",
    color: T.label,
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

  head: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },

  kicker: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.youText,
  },

  question: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: T.label,
    marginTop: 6,
  },

  letter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.fill3,
    alignItems: "center",
    justifyContent: "center",
  },

  letterChosen: {
    backgroundColor: T.accent,
  },

  letterRight: {
    backgroundColor: T.green,
  },

  letterWrong: {
    backgroundColor: T.red,
  },

  letterText: {
    fontFamily: "ui-rounded",
    fontSize: 14,
    fontWeight: "700",
    color: T.label2,
  },

  letterTextOn: {
    color: "#FFFFFF",
  },

  footer: {
    paddingTop: 10,
    paddingBottom: 8,
  },

  result: {
    alignItems: "center",
    paddingHorizontal: 32,
  },

  resultTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: T.label,
    textAlign: "center",
    marginTop: 24,
  },

  resultText: {
    fontSize: 16,
    lineHeight: 22,
    color: T.label2,
    textAlign: "center",
    marginTop: 8,
  },
});
