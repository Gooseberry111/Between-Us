import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import { GlassBackground, GlassCard, GlassPanel } from "../components/Glass";
import { Skeleton } from "../components/Skeleton";
import { getCachedData, setCachedData } from "../lib/dataCache";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function DailyQuestionScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `daily-question:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState(cached?.your_answer || "");
  const [error, setError] = useState("");

  /* Entrance animation, replayed when the answer unlocks. */
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;

  const runReveal = useCallback(() => {
    fade.setValue(0);
    lift.setValue(18);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(lift, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/daily-question`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to load today's question.");
      }

      setData(json);
      setDraft(json.your_answer || "");

      if (cacheKey) setCachedData(cacheKey, json);
    } catch (err) {
      console.log("DAILY QUESTION LOAD ERROR:", err);
      setError(err?.message || "Unable to load today's question.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Re-check on focus. Your partner may have answered
   * since you last looked, and without this the screen
   * would keep insisting they hadn't.
   */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!loading) runReveal();
  }, [loading, runReveal]);

  const submit = async () => {
    const answer = draft.trim();

    if (!answer || saving || !userId) return;

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `${API_URL}/users/${userId}/daily-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to save your answer.");
      }

      setData(json);

      if (cacheKey) setCachedData(cacheKey, json);

      /* Replay the reveal so unlocking feels like something. */
      runReveal();
    } catch (err) {
      console.log("DAILY QUESTION SAVE ERROR:", err);
      setError(err?.message || "Unable to save your answer.");
    } finally {
      setSaving(false);
    }
  };

  const answered = Boolean(data?.your_answer);
  const partnerName = data?.partner_name || "Your partner";

  return (
    <SafeAreaView style={styles.screen}>
      <GlassBackground>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor="#6B4E45"
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.container}>
              {/* HEADER */}

              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton}
                  activeOpacity={0.8}
                  onPress={() => router.back()}
                >
                  <Ionicons name="chevron-back" size={20} color="#6B4E45" />
                </TouchableOpacity>

                <View style={styles.headerText}>
                  <Text style={styles.brand}>TODAY</Text>

                  <Text style={styles.pageTitle}>Daily question</Text>
                </View>

                {data?.streak > 0 ? (
                  <View style={styles.streakPill}>
                    <Text style={styles.streakFlame}>✦</Text>

                    <Text style={styles.streakText}>{data.streak}</Text>
                  </View>
                ) : null}
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {loading ? (
                <View>
                  <Skeleton width="90%" height={24} radius={9} />

                  <Skeleton
                    width="70%"
                    height={24}
                    radius={9}
                    style={{ marginTop: 10 }}
                  />

                  <Skeleton
                    width="100%"
                    height={120}
                    radius={18}
                    style={{ marginTop: 24 }}
                  />
                </View>
              ) : (
                <Animated.View
                  style={{ opacity: fade, transform: [{ translateY: lift }] }}
                >
                  {/* THE QUESTION */}

                  <GlassPanel style={styles.questionPanel}>
                    <Text style={styles.questionLabel}>TODAY</Text>

                    <Text style={styles.questionText}>{data?.question}</Text>
                  </GlassPanel>

                  {/* YOUR ANSWER */}

                  <GlassCard style={styles.card}>
                    <Text style={styles.cardLabel}>YOUR ANSWER</Text>

                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Say what you actually think..."
                      placeholderTextColor="#A59A93"
                      style={styles.input}
                      multiline
                      textAlignVertical="top"
                    />

                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        (!draft.trim() || saving) && styles.saveButtonDisabled,
                      ]}
                      activeOpacity={0.85}
                      onPress={submit}
                      disabled={!draft.trim() || saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveButtonText}>
                          {answered ? "Update my answer" : "Answer & unlock"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </GlassCard>

                  {/* PARTNER ANSWER */}

                  <GlassCard style={styles.card}>
                    <Text style={styles.cardLabel}>
                      {partnerName.toUpperCase()}
                    </Text>

                    {!answered ? (
                      <View style={styles.lockedBox}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={22}
                          color="#6B4E45"
                        />

                        <Text style={styles.lockedTitle}>
                          {data?.partner_answered
                            ? `${partnerName} has answered.`
                            : `Waiting on ${partnerName}.`}
                        </Text>

                        <Text style={styles.lockedText}>
                          Answer yours first, so you say what you really think
                          instead of echoing them.
                        </Text>
                      </View>
                    ) : data?.partner_answer ? (
                      <Text style={styles.answerText}>
                        {data.partner_answer}
                      </Text>
                    ) : (
                      <View style={styles.lockedBox}>
                        <Ionicons
                          name="time-outline"
                          size={22}
                          color="#6B4E45"
                        />

                        <Text style={styles.lockedTitle}>
                          {partnerName} hasn't answered yet.
                        </Text>

                        <Text style={styles.lockedText}>
                          We've let them know yours is in. Pull down to check
                          again.
                        </Text>
                      </View>
                    )}
                  </GlassCard>
                </Animated.View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  fill: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  headerText: {
    flex: 1,
  },

  brand: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
  },

  pageTitle: {
    marginTop: 5,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "700",
    color: "#302825",
  },

  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },

  streakFlame: {
    fontSize: 13,
    color: "#6B4E45",
  },

  streakText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B4E45",
  },

  questionPanel: {
    marginBottom: 14,
  },

  questionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#DCCBC4",
  },

  questionText: {
    marginTop: 12,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  card: {
    marginBottom: 14,
  },

  cardLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#9A918A",
  },

  input: {
    marginTop: 12,
    minHeight: 110,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#302825",
  },

  saveButton: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  lockedBox: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 14,
  },

  lockedTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
    textAlign: "center",
  },

  lockedText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#817771",
    textAlign: "center",
    maxWidth: 260,
  },

  answerText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: "#302825",
  },

  errorBox: {
    backgroundColor: "rgba(243, 227, 223, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 15,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#8A4A3D",
  },
});
