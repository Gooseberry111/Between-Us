import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassBackground, Card } from "../components/Glass";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import {
  getCachedData,
  setCachedData,
  clearCachedData,
} from "../lib/dataCache";
import { Skeleton, SkeletonList } from "../components/Skeleton";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function CompletedGoalsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `completed-goals:${userId}` : null;
  const cachedGoals = cacheKey ? getCachedData(cacheKey) : undefined;

  const [goals, setGoals] = useState(cachedGoals || []);
  const [loading, setLoading] = useState(!cachedGoals);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadGoals = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cached = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cached) {
      setGoals(cached);
      setLoading(false);
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/users/${userId}/relationship-goals`,
      );
      const data = await response.json();

      console.log("COMPLETED GOALS RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load completed goals.");
      }

      const completedGoals = Array.isArray(data?.goals)
        ? data.goals.filter((goal) => goal.status === "completed")
        : [];

      setGoals(completedGoals);

      if (cacheKey) setCachedData(cacheKey, completedGoals);
    } catch (err) {
      console.log("COMPLETED GOALS LOAD ERROR:", err);

      if (!cached) {
        setError(err?.message || "Unable to load completed goals.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGoals();
  };

  const markActive = async (goal) => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${userId}/relationship-goals/${goal.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "active",
          }),
        },
      );

      const data = await response.json();

      console.log("MARK GOAL ACTIVE RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to move goal back.");
      }

      setGoals((current) => {
        const next = current.filter((item) => item.id !== goal.id);
        if (cacheKey) setCachedData(cacheKey, next);
        return next;
      });

      // The active Goals screen may have a stale cached
      // list that's missing this goal.
      if (userId) clearCachedData(`goals:${userId}`);
    } catch (err) {
      console.log("MARK GOAL ACTIVE ERROR:", err);

      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to move goal back.",
      );
    }
  };

  if (loading) {
    /*
     * Cold load only (nothing cached yet). Mirrors the
     * real layout so the page appears at once and fills
     * in, instead of blocking on a spinner.
     */
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <GlassBackground>
          <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
            <Skeleton width={96} height={11} radius={6} />
            <Skeleton
              width="62%"
              height={26}
              radius={9}
              style={{ marginTop: 12 }}
            />
            <Skeleton width="80%" height={12} style={{ marginTop: 10 }} />

            <View style={{ marginTop: 26 }}>
              <SkeletonList count={3} />
            </View>
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
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
                onPress={() => router.push("/goals")}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>

              <View style={styles.headerText}>
                <Text style={styles.brand}>BETWEEN US</Text>

                <Text style={styles.pageTitle}>Completed Goals</Text>

                <Text style={styles.pageSubtitle}>
                  Everything you have already worked through together.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Text style={styles.headerIconText}>✓</Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* SUMMARY */}

            <Card style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{goals.length}</Text>

              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>
                  {goals.length === 1 ? "Goal completed" : "Goals completed"}
                </Text>

                <Text style={styles.summarySubtitle}>
                  Keep growing together, one goal at a time.
                </Text>
              </View>
            </Card>

            {/* GOALS */}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR PROGRESS</Text>

              <Text style={styles.sectionTitle}>
                {goals.length === 0
                  ? "Nothing completed yet."
                  : `${goals.length} ${
                      goals.length === 1 ? "goal" : "goals"
                    } achieved together.`}
              </Text>

              {goals.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Text style={styles.emptyIconText}>✓</Text>
                  </View>

                  <Text style={styles.emptyTitle}>
                    Your completed goals will appear here.
                  </Text>

                  <Text style={styles.emptyText}>
                    When you mark a goal as complete, it will move here
                    automatically.
                  </Text>

                  <TouchableOpacity
                    style={styles.backToGoalsButton}
                    onPress={() => router.back()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.backToGoalsText}>Back to goals</Text>
                  </TouchableOpacity>
                </Card>
              ) : (
                goals.map((goal, index) => (
                  <CompletedGoalCard
                    key={goal.id}
                    goal={goal}
                    index={index}
                    onMarkActive={() => markActive(goal)}
                  />
                ))
              )}
            </View>

            {goals.length > 0 ? (
              <Card style={styles.footerCard}>
                <Text style={styles.footerQuote}>
                  "Progress, not perfection."
                </Text>

                <Text style={styles.footerText}>
                  Look back at what you have already worked through together.
                </Text>
              </Card>
            ) : null}
          </View>
        </ScrollView>
      </GlassBackground>
    </SafeAreaView>
  );
}

function CompletedGoalCard({ goal, index, onMarkActive }) {
  const targetDate = goal.target_date
    ? new Date(goal.target_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const completedDate = goal.completed_at
    ? new Date(goal.completed_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card style={styles.goalCard}>
      <View style={styles.goalTop}>
        <View style={styles.goalNumber}>
          <Text style={styles.goalNumberText}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>

        <View style={styles.completedBadge}>
          <Text style={styles.completedBadgeText}>COMPLETED</Text>
        </View>
      </View>

      <Text style={styles.goalTitle}>{goal.title}</Text>

      {goal.description ? (
        <Text style={styles.goalDescription}>{goal.description}</Text>
      ) : null}

      {targetDate ? (
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>TARGET DATE</Text>
          <Text style={styles.dateText}>{targetDate}</Text>
        </View>
      ) : null}

      {completedDate ? (
        <View style={styles.completedContainer}>
          <Text style={styles.completedLabel}>COMPLETED ON</Text>
          <Text style={styles.completedDate}>{completedDate}</Text>
        </View>
      ) : null}

      <View style={styles.goalDivider} />

      <TouchableOpacity
        style={styles.reactivateButton}
        onPress={onMarkActive}
        activeOpacity={0.8}
      >
        <View style={styles.checkCircle}>
          <Text style={styles.checkText}>↺</Text>
        </View>

        <Text style={styles.reactivateText}>Move back to active goals</Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  backButtonText: {
    fontSize: 22,
    color: "#6B4E45",
  },

  headerText: {
    flex: 1,
  },

  brand: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
  },

  pageTitle: {
    marginTop: 5,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: "#302825",
  },

  pageSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#817771",
  },

  headerIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  headerIconText: {
    fontSize: 20,
    color: "#6B4E45",
    fontWeight: "700",
  },

  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    flexDirection: "row",
    alignItems: "center",
  },

  summaryNumber: {
    fontSize: 29,
    fontWeight: "700",
    color: "#6B4E45",
  },

  summaryText: {
    marginLeft: 14,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  summarySubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#817771",
  },

  section: {
    marginTop: 30,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 7,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 13,
  },

  goalCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 13,
  },

  goalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  goalNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  goalNumberText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B4E45",
  },

  completedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
  },

  completedBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#6B4E45",
  },

  goalTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#302825",
  },

  goalDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
  },

  dateContainer: {
    marginTop: 14,
    backgroundColor: "rgba(107, 78, 69, 0.07)",
    borderRadius: 11,
    padding: 11,
  },

  dateLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#9A918A",
  },

  dateText: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B4E45",
  },

  completedContainer: {
    marginTop: 8,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 11,
    padding: 11,
  },

  completedLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#9A918A",
  },

  completedDate: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B4E45",
  },

  goalDivider: {
    height: 1,
    backgroundColor: "#EAE3DE",
    marginVertical: 16,
  },

  reactivateButton: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
  },

  checkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  reactivateText: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: "600",
    color: "#6B4E45",
  },

  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyIconText: {
    fontSize: 25,
    color: "#6B4E45",
    fontWeight: "700",
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#302825",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
    textAlign: "center",
  },

  backToGoalsButton: {
    marginTop: 17,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
  },

  backToGoalsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B4E45",
  },

  footerCard: {
    marginTop: 17,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#EFE7E2",
    alignItems: "center",
  },

  footerQuote: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: "#6B4E45",
  },

  footerText: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#8D837C",
  },

  errorBox: {
    backgroundColor: "#F3E3DF",
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

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: "#817771",
  },
});
