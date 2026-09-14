import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassBackground, Card } from "../components/Glass";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { clearCachedData } from "../lib/dataCache";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function TriviaScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

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

      const response = await fetch(`${API_URL}/users/${userId}/trivia`);

      const data = await response.json();

      console.log("TRIVIA RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load trivia.");
      }

      setPartnerName(data?.partner?.first_name?.trim() || "your person");

      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err) {
      console.log("TRIVIA LOAD ERROR:", err);

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

    fetch(`${API_URL}/users/${userId}/trivia/complete`, {
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
        console.log("TRIVIA COMPLETE RESPONSE:", data);

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

      const response = await fetch(`${API_URL}/users/${userId}/trivia/answer`, {
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

      console.log("TRIVIA ANSWER:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to check answer.");
      }

      setAnswerResult(data);

      if (data.correct) {
        setScore((previous) => previous + 1);
      }
    } catch (err) {
      console.log("TRIVIA ANSWER ERROR:", err);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <GlassBackground>
          <View style={styles.loadingContainer}>
            <View style={styles.loadingCircle}>
              <Text style={styles.loadingHeart}>♡</Text>
            </View>

            <Text style={styles.loadingTitle}>Getting your questions</Text>

            <ActivityIndicator
              size="small"
              color="#6B4E45"
              style={styles.loadingIndicator}
            />
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <GlassBackground>
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>Something went wrong</Text>

            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={loadTrivia}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.screen}>
        <GlassBackground>
          <View style={styles.resultContainer}>
            <View style={styles.resultCircle}>
              <Text style={styles.resultHeart}>♡</Text>
            </View>

            <Text style={styles.resultEyebrow}>TRIVIA COMPLETE</Text>

            <Text style={styles.resultTitle}>
              You got {score}/{questions.length}
            </Text>

            <Text style={styles.resultDescription}>
              {score === questions.length
                ? `You really know ${partnerName}.`
                : score === 1
                  ? `You know ${partnerName} pretty well. Keep learning each other.`
                  : `There is always more to discover about ${partnerName}.`}
            </Text>

            <Card style={styles.resultCard}>
              <Text style={styles.resultCardTitle}>A little reminder</Text>

              <Text style={styles.resultCardText}>
                The point is not to get everything right. It is to keep paying
                attention to each other.
              </Text>
            </Card>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={loadTrivia}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Play again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/trivia-history")}
            >
              <Text style={styles.backButtonText}>View history</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.screen}>
        <GlassBackground>
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>No questions available</Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.primaryButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  const questionNumber = currentIndex + 1;

  return (
    <SafeAreaView style={styles.screen}>
      <GlassBackground>
        <View style={styles.container}>
          {/* HEADER */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBack}
              onPress={() => router.back()}
            >
              <Text style={styles.headerBackText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerLabel}>COUPLE TRIVIA</Text>

              <Text style={styles.headerTitle}>
                How well do you know {partnerName}?
              </Text>
            </View>

            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{score}</Text>
            </View>
          </View>

          {/* PROGRESS */}

          <View style={styles.progressArea}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(questionNumber / questions.length) * 100}%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.progressText}>
              QUESTION {questionNumber} OF {questions.length}
            </Text>
          </View>

          {/* QUESTION */}

          <Card dark style={styles.questionCard}>
            <View style={styles.questionIcon}>
              <Text style={styles.questionIconText}>✦</Text>
            </View>

            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            <Text style={styles.questionHint}>
              Choose the answer you think they would give.
            </Text>
          </Card>

          {/* OPTIONS */}

          <View style={styles.options}>
            {Array.isArray(currentQuestion.options) &&
              currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === option;

                const correctAnswer = answerResult?.correct_answer;

                const isCorrectAnswer =
                  Boolean(answerResult) && correctAnswer === option;

                const isWrong =
                  Boolean(answerResult) && isSelected && !answerResult.correct;

                return (
                  <TouchableOpacity
                    key={`${option}-${index}`}
                    style={[
                      styles.option,

                      isSelected && !answerResult && styles.optionSelected,

                      isCorrectAnswer && styles.optionCorrect,

                      isWrong && styles.optionWrong,
                    ]}
                    activeOpacity={0.8}
                    disabled={Boolean(answerResult)}
                    onPress={() => setSelectedAnswer(option)}
                  >
                    <View
                      style={[
                        styles.optionCircle,

                        isSelected &&
                          !answerResult &&
                          styles.optionCircleSelected,

                        isCorrectAnswer && styles.optionCircleCorrect,

                        isWrong && styles.optionCircleWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLetter,

                          (isSelected || isCorrectAnswer) &&
                            styles.optionLetterSelected,
                        ]}
                      >
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.optionText,

                        isSelected &&
                          !answerResult &&
                          styles.optionTextSelected,

                        isCorrectAnswer && styles.optionTextCorrect,

                        isWrong && styles.optionTextWrong,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>

          {/* RESULT */}

          {answerResult ? (
            <View
              style={[
                styles.answerMessage,
                answerResult.correct
                  ? styles.correctMessage
                  : styles.wrongMessage,
              ]}
            >
              <Text style={styles.answerMessageTitle}>
                {answerResult.correct ? "Correct" : "Not quite"}
              </Text>

              <Text style={styles.answerMessageText}>
                {answerResult.correct
                  ? "You know them well."
                  : `The answer was ${answerResult.correct_answer}.`}
              </Text>
            </View>
          ) : null}

          {/* BUTTON */}

          <View style={styles.bottomArea}>
            {!answerResult ? (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !selectedAnswer && styles.primaryButtonDisabled,
                ]}
                disabled={!selectedAnswer || submitting}
                onPress={submitAnswer}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Check answer</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={nextQuestion}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>
                  {currentIndex === questions.length - 1
                    ? "See result"
                    : "Next question"}
                </Text>
              </TouchableOpacity>
            )}
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

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },

  headerBackText: {
    fontSize: 30,
    lineHeight: 32,
    color: "#6B4E45",
    marginTop: -3,
  },

  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },

  headerLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#9A918A",
  },

  headerTitle: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#302825",
  },

  scoreBadge: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 21,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  scoreText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#6B4E45",
  },

  progressArea: {
    marginTop: 26,
  },

  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E6DED9",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#6B4E45",
  },

  progressText: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#9A918A",
  },

  questionCard: {
    marginTop: 25,
    backgroundColor: "#6B4E45",
    borderRadius: 23,
    padding: 22,
  },

  questionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#806B62",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  questionIconText: {
    fontSize: 19,
    color: "#F8F5F0",
  },

  questionText: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  questionHint: {
    marginTop: 11,
    fontSize: 12,
    lineHeight: 18,
    color: "#DCCBC4",
  },

  options: {
    marginTop: 18,
    gap: 10,
  },

  option: {
    minHeight: 57,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    flexDirection: "row",
    alignItems: "center",
  },

  optionSelected: {
    borderColor: "#6B4E45",
    backgroundColor: "rgba(255, 255, 255, 0.78)",
  },

  optionCorrect: {
    borderColor: "#6B4E45",
    backgroundColor: "rgba(107, 78, 69, 0.09)",
  },

  optionWrong: {
    borderColor: "#C98E80",
    backgroundColor: "#F3E3DF",
  },

  optionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  optionCircleSelected: {
    backgroundColor: "#6B4E45",
  },

  optionCircleCorrect: {
    backgroundColor: "#6B4E45",
  },

  optionCircleWrong: {
    backgroundColor: "#C98E80",
  },

  optionLetter: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B4E45",
  },

  optionLetterSelected: {
    color: "#FFFFFF",
  },

  optionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: "#302825",
  },

  optionTextSelected: {
    color: "#6B4E45",
  },

  optionTextCorrect: {
    color: "#6B4E45",
  },

  optionTextWrong: {
    color: "#8A4A3D",
  },

  answerMessage: {
    marginTop: 13,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 13,
  },

  correctMessage: {
    backgroundColor: "rgba(107, 78, 69, 0.09)",
  },

  wrongMessage: {
    backgroundColor: "#F3E3DF",
  },

  answerMessageTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B4E45",
  },

  answerMessageText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#6F625C",
  },

  bottomArea: {
    marginTop: "auto",
    paddingTop: 15,
  },

  primaryButton: {
    minHeight: 53,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryButtonDisabled: {
    opacity: 0.45,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingHeart: {
    fontSize: 29,
    color: "#6B4E45",
  },

  loadingTitle: {
    marginTop: 15,
    fontSize: 17,
    fontWeight: "700",
    color: "#302825",
  },

  loadingIndicator: {
    marginTop: 12,
  },

  centerContainer: {
    flex: 1,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#302825",
    textAlign: "center",
  },

  errorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
    textAlign: "center",
    maxWidth: 320,
  },

  backButton: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },

  backButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B4E45",
  },

  resultContainer: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  resultCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  resultHeart: {
    fontSize: 38,
    color: "#6B4E45",
  },

  resultEyebrow: {
    marginTop: 25,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
  },

  resultTitle: {
    marginTop: 7,
    fontSize: 30,
    fontWeight: "800",
    color: "#302825",
  },

  resultDescription: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#817771",
    textAlign: "center",
    maxWidth: 310,
  },

  resultCard: {
    width: "100%",
    marginTop: 28,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },

  resultCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#302825",
  },

  resultCardText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#817771",
  },
});
