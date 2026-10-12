import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { clearCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Avatar,
  Button,
  Card,
  Cell,
  Group,
  Press,
  motionAllowed,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * THE NIGHTLY RITUAL
 * ==========================================
 *
 * One question a night, in four steps:
 *
 *   answer  -> say your piece, theirs stays sealed
 *   reveal  -> both answers together, match or not
 *   streak  -> the nights you have kept going
 *   plan    -> leave with something to do
 *
 * Answering is the whole retention loop, so it is the
 * fastest thing in the app: type a line, lock it in.
 */

const STEPS = ["answer", "reveal", "streak", "plan"];

/* A plan to suggest when the two of you are in step. */
const IDEAS = [
  {
    title: "Candlelit cook-along",
    text: "Pick a recipe neither of you has made. Phones in a drawer until dessert.",
  },
  {
    title: "A walk with no phones",
    text: "Twenty minutes, no destination. The talking does itself.",
  },
  {
    title: "Breakfast somewhere new",
    text: "Before work, so the day starts with each other.",
  },
];

function ideaOfTheNight() {
  return IDEAS[Math.floor(Date.now() / 86400000) % IDEAS.length];
}

export default function DailyQuestionScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("answer");
  const [addedDate, setAddedDate] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const reveal = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/daily-question`);
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to load.");

      setDaily(data);
      setAnswer(data?.your_answer || "");

      /* Already answered and so have they: go straight to the
       * reveal, which is what they came back for. */
      if (data?.your_answer) {
        setStep(data?.partner_answered ? "reveal" : "waiting");
      }
    } catch (err) {
      console.log("DAILY LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /* The reveal cards flip in once. */
  useEffect(() => {
    if (step !== "reveal") return;

    reveal.setValue(0);

    motionAllowed().then((allowed) => {
      if (!allowed) {
        reveal.setValue(1);
        return;
      }

      Animated.timing(reveal, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [step, reveal]);

  const lockIn = async () => {
    if (!answer.trim() || saving) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/daily-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save your answer.");
      }

      setDaily(data);
      clearCachedData(`home:${userId}`);

      if (data?.partner_answered) {
        const same =
          String(data.partner_answer || "").trim().toLowerCase() ===
          answer.trim().toLowerCase();

        setCelebrate(same);
        setStep("reveal");
      } else {
        setStep("waiting");
      }
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addToDates = async () => {
    const idea = ideaOfTheNight();

    try {
      const response = await apiFetch(`/users/${userId}/date-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: idea.title, notes: idea.text }),
      });

      if (!response.ok) throw new Error("Unable to add this to your dates.");

      setAddedDate(true);
    } catch (err) {
      Alert.alert("We couldn't add that", err?.message || "Please try again.");
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Tonight's question" showBack={true} />;
  }

  const partnerName = daily?.partner_name?.trim() || "Your person";
  const streak = Number(daily?.streak || 0);
  const week = Array.isArray(daily?.week) ? daily.week : [];
  const idea = ideaOfTheNight();

  const stepIndex = STEPS.indexOf(step);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Where you are in the ritual. */}
        <View style={styles.topBar}>
          <Press onPress={() => router.back()} style={styles.close}>
            <Ionicons name="chevron-down" size={20} color={T.label} />
          </Press>

          <View style={styles.progress}>
            {STEPS.map((name, index) => (
              <View
                key={name}
                style={[
                  styles.progressBar,
                  index <= stepIndex && styles.progressBarOn,
                ]}
              />
            ))}
          </View>

          <View style={styles.close} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <SkeletonList count={3} />
          ) : step === "answer" ? (
            /* ---------- 1. ANSWER ---------- */
            <>
              <Text style={styles.kicker}>Tonight&apos;s question</Text>

              <Text style={styles.question}>{daily?.question}</Text>

              <Card style={styles.answerCard}>
                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Say it in a line…"
                  placeholderTextColor={T.label3}
                  style={styles.input}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              </Card>

              {daily?.partner_answered ? (
                <View style={styles.sealed}>
                  <Avatar name={partnerName} who="them" size={26} />

                  <Text style={styles.sealedText}>
                    {partnerName} has answered
                  </Text>

                  <Ionicons name="lock-closed" size={15} color={T.label3} />
                </View>
              ) : (
                <Text style={styles.hint}>
                  {partnerName} hasn&apos;t answered yet. Yours stays sealed
                  until they do.
                </Text>
              )}

              <Button
                title="Lock In Answer"
                onPress={lockIn}
                busy={saving}
                disabled={!answer.trim()}
                style={styles.action}
              />
            </>
          ) : step === "waiting" ? (
            /* ---------- WAITING ---------- */
            <>
              <Text style={styles.kicker}>Locked in</Text>

              <Text style={styles.question}>
                Now we wait for {partnerName}.
              </Text>

              <Card style={styles.answerCard}>
                <Text style={styles.yourAnswerLabel}>You said</Text>

                <Text style={styles.yourAnswer}>{daily?.your_answer}</Text>
              </Card>

              <Text style={styles.hint}>
                We&apos;ll let you know the moment they answer, and you&apos;ll
                both see it at once.
              </Text>

              <Button
                title="See the Streak"
                kind="tinted"
                onPress={() => setStep("streak")}
                style={styles.action}
              />
            </>
          ) : step === "reveal" ? (
            /* ---------- 2. REVEAL ---------- */
            <>
              <Text style={[styles.kicker, styles.centre]}>Revealed</Text>

              <Text style={[styles.question, styles.centre]}>
                Here&apos;s what you both said
              </Text>

              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [
                    {
                      translateY: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                }}
              >
                <Card style={[styles.revealCard, styles.revealYou]}>
                  <Avatar name="You" who="you" size={38} />

                  <View style={styles.revealText}>
                    <Text style={styles.revealWho}>You</Text>

                    <Text style={styles.revealAnswer}>
                      {daily?.your_answer}
                    </Text>
                  </View>
                </Card>

                <Card style={[styles.revealCard, styles.revealThem]}>
                  <Avatar name={partnerName} who="them" size={38} />

                  <View style={styles.revealText}>
                    <Text style={styles.revealWho}>{partnerName}</Text>

                    <Text style={styles.revealAnswer}>
                      {daily?.partner_answer}
                    </Text>
                  </View>
                </Card>
              </Animated.View>

              <Card
                style={[
                  styles.verdict,
                  celebrate ? styles.verdictMatch : styles.verdictDiff,
                ]}
              >
                <View style={styles.verdictIcon}>
                  <Ionicons
                    name={celebrate ? "heart" : "bulb"}
                    size={17}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.verdictText}>
                  <Text style={styles.verdictTitle}>
                    {celebrate
                      ? "Same answer. You're in sync."
                      : "Different answers. That's useful."}
                  </Text>

                  <Text style={styles.verdictSub}>
                    {celebrate
                      ? "There's an idea waiting for you both."
                      : `Ask ${partnerName} why they said what they said.`}
                  </Text>
                </View>
              </Card>

              <Button
                title="Continue"
                onPress={() => setStep("streak")}
                style={styles.action}
              />
            </>
          ) : step === "streak" ? (
            /* ---------- 3. STREAK ---------- */
            <>
              <View style={styles.flameWrap}>
                <Ionicons name="flame" size={38} color={T.orange} />
              </View>

              <Text style={styles.streakNumber}>{streak}</Text>

              <Text style={[styles.streakLabel, styles.centre]}>
                {streak === 1 ? "night" : "nights"} in a row
              </Text>

              <Text style={[styles.hint, styles.centre]}>
                {streak > 1
                  ? `${partnerName}'s goes up too, because you keep it going together.`
                  : `Answer again tomorrow and this becomes a streak.`}
              </Text>

              {week.length > 0 ? (
                <Card style={styles.week}>
                  {week.map((day) => (
                    <View key={day.date} style={styles.day}>
                      <Text style={styles.dayLetter}>
                        {new Date(`${day.date}T00:00:00`)
                          .toLocaleDateString(undefined, { weekday: "short" })
                          .charAt(0)}
                      </Text>

                      <View
                        style={[
                          styles.dayDot,
                          day.answered && styles.dayDotOn,
                          day.today && !day.answered && styles.dayDotToday,
                        ]}
                      >
                        {day.answered ? (
                          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                        ) : null}
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}

              <Button
                title="Continue"
                onPress={() => setStep("plan")}
                style={styles.action}
              />
            </>
          ) : (
            /* ---------- 4. PLAN ---------- */
            <>
              <Text style={styles.kicker}>Make it real</Text>

              <Text style={styles.question}>Turn tonight into a plan</Text>

              <Card style={styles.idea}>
                <Text style={styles.ideaWhy}>
                  Because of what you both said tonight
                </Text>

                <Text style={styles.ideaTitle}>{idea.title}</Text>

                <Text style={styles.ideaText}>{idea.text}</Text>
              </Card>

              <Button
                title={addedDate ? "Added to Dates" : "Add to Dates"}
                icon={addedDate ? "checkmark-circle" : "calendar-outline"}
                kind={addedDate ? "gray" : "tinted"}
                onPress={addedDate ? undefined : addToDates}
                style={styles.action}
              />

              <Group inset={52}>
                <Cell
                  leading={<Ionicons name="time" size={21} color={T.accent} />}
                  title="Next question at midnight"
                  subtitle="One a night, every night."
                />
              </Group>

              <Button
                title="Done"
                kind="plain"
                onPress={() => router.back()}
                style={styles.action}
              />
            </>
          )}
        </ScrollView>
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

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },

  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  progress: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
  },

  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: T.fill3,
  },

  progressBarOn: {
    backgroundColor: T.accent,
  },

  content: {
    padding: 16,
    paddingBottom: 60,
    gap: 14,
  },

  centre: {
    textAlign: "center",
  },

  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: T.accent,
  },

  question: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: T.label,
    marginTop: -6,
  },

  answerCard: {
    marginHorizontal: 0,
    padding: 4,
  },

  input: {
    minHeight: 120,
    fontSize: 17,
    lineHeight: 24,
    color: T.label,
    padding: 14,
  },

  yourAnswerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
    paddingHorizontal: 10,
    paddingTop: 8,
  },

  yourAnswer: {
    fontSize: 17,
    lineHeight: 24,
    color: T.label,
    padding: 10,
  },

  sealed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.fill4,
  },

  sealedText: {
    flex: 1,
    fontSize: 14,
    color: T.label2,
  },

  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: T.label2,
  },

  action: {
    marginTop: 4,
  },

  revealCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 0,
    marginBottom: 10,
    padding: 14,
  },

  revealYou: {
    backgroundColor: T.youTint,
  },

  revealThem: {
    backgroundColor: T.accentTint,
  },

  revealText: {
    flex: 1,
  },

  revealWho: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
  },

  revealAnswer: {
    fontSize: 16,
    lineHeight: 22,
    color: T.label,
    marginTop: 3,
  },

  verdict: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 0,
    padding: 14,
  },

  verdictMatch: {
    backgroundColor: "rgba(52,199,89,0.12)",
  },

  verdictDiff: {
    backgroundColor: T.fill4,
  },

  verdictIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  verdictText: {
    flex: 1,
  },

  verdictTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  verdictSub: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    marginTop: 2,
  },

  flameWrap: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,149,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  streakNumber: {
    fontSize: 72,
    lineHeight: 78,
    fontWeight: "700",
    letterSpacing: -3,
    color: T.accent,
    textAlign: "center",
    marginTop: 6,
  },

  streakLabel: {
    fontSize: 17,
    color: T.label2,
    marginTop: -8,
  },

  week: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 0,
    padding: 14,
  },

  day: {
    alignItems: "center",
    gap: 7,
  },

  dayLetter: {
    fontSize: 12,
    color: T.label2,
  },

  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  dayDotOn: {
    backgroundColor: T.accent,
  },

  dayDotToday: {
    borderWidth: 2,
    borderColor: T.accent,
  },

  idea: {
    marginHorizontal: 0,
    padding: 16,
  },

  ideaWhy: {
    fontSize: 12.5,
    fontWeight: "600",
    color: T.accentText,
  },

  ideaTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: T.label,
    marginTop: 6,
  },

  ideaText: {
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    marginTop: 4,
  },
});
