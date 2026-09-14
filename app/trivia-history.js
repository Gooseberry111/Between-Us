import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassBackground } from "../components/Glass";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { Skeleton, SkeletonList } from "../components/Skeleton";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function TriviaHistoryScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `trivia-history:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [sessions, setSessions] = useState(cached?.sessions || []);
  const [stats, setStats] = useState(cached?.stats || null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cachedHistory = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cachedHistory) {
      setSessions(cachedHistory.sessions || []);
      setStats(cachedHistory.stats || null);
      setLoading(false);
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/trivia/history`);

      const data = await response.json();

      console.log("TRIVIA HISTORY RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your trivia history.");
      }

      const nextSessions = Array.isArray(data?.sessions) ? data.sessions : [];

      setSessions(nextSessions);
      setStats(data?.stats || null);

      if (cacheKey) {
        setCachedData(cacheKey, {
          sessions: nextSessions,
          stats: data?.stats || null,
        });
      }
    } catch (err) {
      console.log("TRIVIA HISTORY LOAD ERROR:", err);

      if (!cachedHistory) {
        setError(err?.message || "Unable to load your trivia history.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  if (loading) {
    /*
     * Cold load only (nothing cached yet). Mirrors the
     * real layout so the page appears at once and fills
     * in, instead of blocking on a spinner.
     */
    return (
      <SafeAreaView style={styles.screen}>
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
    <SafeAreaView style={styles.screen}>
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
                activeOpacity={0.8}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={20} color="#6B4E45" />
              </TouchableOpacity>

              <View style={styles.headerText}>
                <Text style={styles.brand}>BETWEEN US</Text>

                <Text style={styles.pageTitle}>Trivia History</Text>

                <Text style={styles.pageSubtitle}>
                  Every round you've both played.
                </Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* STATS */}

            {stats && stats.rounds_played > 0 ? (
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.rounds_played}</Text>
                  <Text style={styles.statLabel}>
                    {stats.rounds_played === 1 ? "Round" : "Rounds"}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.best_score}</Text>
                  <Text style={styles.statLabel}>Best score</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {stats.accuracy === null ? "—" : `${stats.accuracy}%`}
                  </Text>
                  <Text style={styles.statLabel}>Accuracy</Text>
                </View>
              </View>
            ) : null}

            {/* SESSIONS */}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ROUNDS PLAYED</Text>

              <Text style={styles.sectionTitle}>
                {sessions.length === 0
                  ? "No rounds yet."
                  : `${sessions.length} ${
                      sessions.length === 1 ? "round" : "rounds"
                    } so far.`}
              </Text>

              {sessions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="help-circle-outline"
                      size={24}
                      color="#6B4E45"
                    />
                  </View>

                  <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                  <Text style={styles.emptyText}>
                    Play a round of couple trivia and your results will start
                    showing up here.
                  </Text>

                  <TouchableOpacity
                    style={styles.emptyButton}
                    activeOpacity={0.85}
                    onPress={() => router.push("/trivia")}
                  >
                    <Text style={styles.emptyButtonText}>Play trivia</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))
              )}
            </View>

            {sessions.length > 0 ? (
              <View style={styles.footerCard}>
                <Text style={styles.footerQuote}>
                  "The point is not to get everything right. It is to keep
                  paying attention to each other."
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </GlassBackground>
    </SafeAreaView>
  );
}

function SessionCard({ session }) {
  const date = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const playerName = session.is_you
    ? "You"
    : session.player_first_name?.trim() || "Your partner";

  const total = session.total_questions || 0;

  const perfect = total > 0 && session.score === total;

  return (
    <View style={[styles.sessionCard, session.is_you && styles.sessionCardYou]}>
      <View
        style={[styles.scoreCircle, session.is_you && styles.scoreCircleYou]}
      >
        <Text style={[styles.scoreText, session.is_you && styles.scoreTextYou]}>
          {session.score}/{total}
        </Text>
      </View>

      <View style={styles.sessionContent}>
        <Text style={styles.sessionPlayer}>
          {playerName}
          {perfect ? " · Perfect round" : ""}
        </Text>

        <Text style={styles.sessionDate}>{date}</Text>
      </View>
    </View>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
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

  pageSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: "#817771",
  },

  statsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    marginBottom: 4,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6B4E45",
  },

  statLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "600",
    color: "#9A918A",
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#EAE3DE",
  },

  section: {
    marginTop: 26,
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

  sessionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  sessionCardYou: {
    borderColor: "#D9C8C0",
  },

  scoreCircle: {
    minWidth: 52,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  scoreCircleYou: {
    backgroundColor: "#6B4E45",
  },

  scoreText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6B4E45",
  },

  scoreTextYou: {
    color: "#FFFFFF",
  },

  sessionContent: {
    flex: 1,
  },

  sessionPlayer: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  sessionDate: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: "#9A918A",
  },

  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#302825",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 17,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },

  emptyButtonText: {
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
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: "#6B4E45",
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
