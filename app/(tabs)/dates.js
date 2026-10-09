import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { GlassBackground, Card, FadeIn } from "../../components/Glass";
import { PASTELS, Squish, EmptyArt } from "../../components/Playful";
import { Skeleton, SkeletonList } from "../../components/Skeleton";
import ConnectFirst from "../../components/ConnectFirst";
import { useIsConnected } from "../../lib/connection";
import DateInput from "../../components/DateInput";

/*
 * ==========================================
 * DATES
 * ==========================================
 *
 * Plans the two of you are making, the anniversaries
 * that come round every year, and a nudge when neither
 * of you can think of anything.
 */

const DATE_IDEAS = [
  {
    icon: "restaurant-outline",
    tone: "blush",
    text: "Cook something neither of you has made before",
  },
  {
    icon: "film-outline",
    tone: "lilac",
    text: "Film at home, phones in another room",
  },
  {
    icon: "walk-outline",
    tone: "sage",
    text: "Walk somewhere you've never been",
  },
  { icon: "cafe-outline", tone: "butter", text: "Breakfast out before work" },
  {
    icon: "musical-notes-outline",
    tone: "sky",
    text: "Play each other three songs that matter",
  },
  {
    icon: "game-controller-outline",
    tone: "clay",
    text: "Game night, loser picks the next date",
  },
  { icon: "sunny-outline", tone: "butter", text: "Watch the sunrise together" },
  {
    icon: "book-outline",
    tone: "sky",
    text: "Read the same thing and argue about it",
  },
];

function ideaOfTheDay() {
  const day = Math.floor(Date.now() / 86400000);

  return DATE_IDEAS[day % DATE_IDEAS.length];
}

function daysUntil(isoDate) {
  if (!isoDate) return null;

  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return Math.round((target - today) / 86400000);
}

function whenLabel(isoDate) {
  const days = daysUntil(isoDate);

  if (days === null) return "No date set";
  if (days < 0)
    return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `In ${days} days`;

  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });
}

export default function DatesScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `dates:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [plans, setPlans] = useState(cached?.plans ?? []);
  const [specialDates, setSpecialDates] = useState(cached?.specialDates ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [planDate, setPlanDate] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [plansResponse, datesResponse] = await Promise.all([
        apiFetch(`/users/${userId}/date-plans`),
        apiFetch(`/users/${userId}/special-dates`),
      ]);

      const plansData = await plansResponse.json();
      const datesData = await datesResponse.json();

      if (plansResponse.ok) {
        setPlans(Array.isArray(plansData?.plans) ? plansData.plans : []);
      }

      const upcoming = Array.isArray(datesData)
        ? datesData
        : Array.isArray(datesData?.special_dates)
          ? datesData.special_dates
          : [];

      setSpecialDates(upcoming);

      if (cacheKey) {
        setCachedData(cacheKey, {
          plans: Array.isArray(plansData?.plans) ? plansData.plans : [],
          specialDates: upcoming,
        });
      }
    } catch (err) {
      console.log("DATES LOAD ERROR:", err);
      setError(err?.message || "Unable to load your dates.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const savePlan = async () => {
    const cleanTitle = title.trim();

    if (!cleanTitle || saving) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/date-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          place: place.trim() || null,
          plan_date: planDate.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this date.");
      }

      setTitle("");
      setPlace("");
      setPlanDate("");
      setAdding(false);

      await load();
    } catch (err) {
      console.log("DATE SAVE ERROR:", err);
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (plan) => {
    try {
      const response = await apiFetch(
        `/users/${userId}/date-plans/${plan.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        },
      );

      if (!response.ok) throw new Error("Unable to update this date.");

      await load();
    } catch (err) {
      console.log("DATE UPDATE ERROR:", err);
      Alert.alert(
        "We couldn't update that",
        err?.message || "Please try again.",
      );
    }
  };

  const removePlan = (plan) => {
    Alert.alert("Remove this date?", `"${plan.title}" will be deleted.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/users/${userId}/date-plans/${plan.id}`, {
              method: "DELETE",
            });

            await load();
          } catch (err) {
            console.log("DATE DELETE ERROR:", err);
          }
        },
      },
    ]);
  };

  if (connected === false) {
    return <ConnectFirst feature="Dates" />;
  }

  const planned = plans.filter((plan) => plan.status === "planned");
  const past = plans.filter((plan) => plan.status === "done");
  const idea = ideaOfTheDay();

  /* Anniversaries, soonest first, with the countdown. */
  const upcomingSpecial = specialDates
    .map((item) => ({
      ...item,
      days: daysUntil(item.next_occurrence || item.event_date),
    }))
    .filter((item) => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor="#F03FA9"
              />
            }
          >
            <View style={styles.container}>
              <Text style={styles.eyebrow}>THE TWO OF YOU</Text>

              <Text style={styles.title}>Dates</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* PLAN ONE */}

              {adding ? (
                <FadeIn>
                  <Card style={styles.form}>
                    <Text style={styles.formTitle}>Plan a date</Text>

                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="What are you doing?"
                      placeholderTextColor="rgba(60,60,67,0.3)"
                      style={styles.input}
                    />

                    <TextInput
                      value={place}
                      onChangeText={setPlace}
                      placeholder="Where? (optional)"
                      placeholderTextColor="rgba(60,60,67,0.3)"
                      style={styles.input}
                    />

                    <DateInput
                      value={planDate}
                      onChangeText={setPlanDate}
                      placeholder="When? YYYY-MM-DD (optional)"
                      style={styles.input}
                    />

                    <View style={styles.formActions}>
                      <TouchableOpacity
                        onPress={() => setAdding(false)}
                        style={styles.cancelButton}
                        disabled={saving}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={savePlan}
                        style={[
                          styles.saveButton,
                          (!title.trim() || saving) && styles.saveButtonOff,
                        ]}
                        disabled={!title.trim() || saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveText}>Save the date</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </Card>
                </FadeIn>
              ) : (
                <Squish onPress={() => setAdding(true)} style={styles.addCard}>
                  <View style={styles.addIcon}>
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </View>

                  <View style={styles.addTextWrap}>
                    <Text style={styles.addTitle}>Plan a date</Text>

                    <Text style={styles.addText}>
                      They'll know as soon as you save it.
                    </Text>
                  </View>
                </Squish>
              )}

              {/* IDEA */}

              <FadeIn delay={80}>
                <View
                  style={[
                    styles.ideaCard,
                    { backgroundColor: PASTELS[idea.tone].bg },
                  ]}
                >
                  <View style={styles.ideaTop}>
                    <Ionicons
                      name={idea.icon}
                      size={16}
                      color={PASTELS[idea.tone].ink}
                    />

                    <Text
                      style={[
                        styles.ideaLabel,
                        { color: PASTELS[idea.tone].ink },
                      ]}
                    >
                      IDEA FOR TODAY
                    </Text>
                  </View>

                  <Text
                    style={[styles.ideaText, { color: PASTELS[idea.tone].ink }]}
                  >
                    {idea.text}
                  </Text>

                  <TouchableOpacity
                    style={styles.ideaButton}
                    activeOpacity={0.85}
                    onPress={() => {
                      setTitle(idea.text);
                      setAdding(true);
                    }}
                  >
                    <Text style={styles.ideaButtonText}>Plan this one</Text>
                  </TouchableOpacity>
                </View>
              </FadeIn>

              {/* COMING UP */}

              {loading ? (
                <View style={{ marginTop: 22 }}>
                  <Skeleton width="45%" height={12} radius={6} />
                  <View style={{ marginTop: 14 }}>
                    <SkeletonList count={2} />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionLabel}>COMING UP</Text>

                  {planned.length === 0 ? (
                    <Card style={styles.emptyCard}>
                      <EmptyArt
                        emoji="🗓️"
                        title="Nothing planned yet"
                        text="A date in the diary is the difference between meaning to and actually going."
                      />
                    </Card>
                  ) : (
                    planned.map((plan, index) => (
                      <FadeIn key={plan.id} delay={40 + index * 50}>
                        <Card style={styles.planCard}>
                          <View style={styles.planTop}>
                            <View style={styles.planWhen}>
                              <Text style={styles.planWhenText}>
                                {whenLabel(plan.plan_date)}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => removePlan(plan)}
                              hitSlop={10}
                            >
                              <Ionicons
                                name="ellipsis-horizontal"
                                size={18}
                                color="rgba(60,60,67,0.3)"
                              />
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.planTitle}>{plan.title}</Text>

                          {plan.place ? (
                            <View style={styles.planMeta}>
                              <Ionicons
                                name="location-outline"
                                size={13}
                                color="rgba(60,60,67,0.6)"
                              />

                              <Text style={styles.planMetaText}>
                                {plan.place}
                              </Text>
                            </View>
                          ) : null}

                          <Text style={styles.planBy}>
                            {plan.mine
                              ? "You planned this"
                              : `${plan.planner_name} planned this`}
                          </Text>

                          <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => markDone(plan)}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={15}
                              color="#F03FA9"
                            />

                            <Text style={styles.doneText}>We did this</Text>
                          </TouchableOpacity>
                        </Card>
                      </FadeIn>
                    ))
                  )}

                  {/* ANNIVERSARIES */}

                  {upcomingSpecial.length > 0 ? (
                    <>
                      <View style={styles.sectionHead}>
                        <Text style={styles.sectionLabel}>
                          DATES THAT COME ROUND
                        </Text>

                        <TouchableOpacity
                          onPress={() => router.push("/special-dates")}
                        >
                          <Text style={styles.seeAll}>Manage</Text>
                        </TouchableOpacity>
                      </View>

                      {upcomingSpecial.map((item) => (
                        <Card key={item.id} style={styles.specialCard}>
                          <View style={styles.specialIcon}>
                            <Ionicons
                              name="heart"
                              size={15}
                              color={PASTELS.blush.ink}
                            />
                          </View>

                          <View style={styles.specialText}>
                            <Text style={styles.specialTitle}>
                              {item.title}
                            </Text>

                            <Text style={styles.specialWhen}>
                              {item.days === 0
                                ? "Today"
                                : `In ${item.days} ${item.days === 1 ? "day" : "days"}`}
                            </Text>
                          </View>
                        </Card>
                      ))}
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.addSpecial}
                      onPress={() => router.push("/special-dates")}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color="#F03FA9"
                      />

                      <Text style={styles.addSpecialText}>
                        Add an anniversary or birthday
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* WHAT YOU'VE DONE */}

                  {past.length > 0 ? (
                    <>
                      <Text style={styles.sectionLabel}>DATES YOU'VE HAD</Text>

                      {past.slice(0, 8).map((plan) => (
                        <View key={plan.id} style={styles.pastRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={PASTELS.sage.ink}
                          />

                          <Text style={styles.pastText}>{plan.title}</Text>

                          {plan.plan_date ? (
                            <Text style={styles.pastWhen}>
                              {whenLabel(plan.plan_date)}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </>
                  ) : null}
                </>
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
    backgroundColor: "#F2ECF4",
  },

  fill: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 150,
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: "#F03FA9",
  },

  title: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: "#111114",
    letterSpacing: -0.5,
  },

  error: {
    marginTop: 12,
    fontSize: 13,
    color: "#FF3B30",
  },

  addCard: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE8F5",
  },

  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F03FA9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  addTextWrap: {
    flex: 1,
  },

  addTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111114",
  },

  addText: {
    marginTop: 3,
    fontSize: 12.5,
    color: "rgba(60,60,67,0.6)",
  },

  form: {
    marginTop: 20,
  },

  formTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111114",
    marginBottom: 14,
  },

  input: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#F2ECF4",
    borderWidth: 1,
    borderColor: "#FDE8F5",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111114",
    marginBottom: 10,
  },

  formActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },

  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  cancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(60,60,67,0.6)",
  },

  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F03FA9",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonOff: {
    opacity: 0.45,
  },

  saveText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  ideaCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 18,
  },

  ideaTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  ideaLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  ideaText: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
  },

  ideaButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  ideaButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F03FA9",
  },

  sectionLabel: {
    marginTop: 26,
    marginBottom: 12,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "rgba(60,60,67,0.6)",
  },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  seeAll: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#F03FA9",
  },

  emptyCard: {
    paddingVertical: 10,
  },

  planCard: {
    marginBottom: 12,
  },

  planTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  planWhen: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FDE8F5",
  },

  planWhenText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F03FA9",
  },

  planTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#111114",
    lineHeight: 24,
  },

  planMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
  },

  planMetaText: {
    fontSize: 13,
    color: "rgba(60,60,67,0.6)",
  },

  planBy: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(60,60,67,0.3)",
  },

  doneButton: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FDE8F5",
  },

  doneText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#F03FA9",
  },

  specialCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  specialIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F7E2E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  specialText: {
    flex: 1,
  },

  specialTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111114",
  },

  specialWhen: {
    marginTop: 2,
    fontSize: 12.5,
    color: "rgba(60,60,67,0.6)",
  },

  addSpecial: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#FDE8F5",
  },

  addSpecialText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#F03FA9",
  },

  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
  },

  pastText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(60,60,67,0.6)",
  },

  pastWhen: {
    fontSize: 11.5,
    color: "rgba(60,60,67,0.3)",
  },
});
