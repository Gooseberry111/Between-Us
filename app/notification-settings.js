import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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

/*
 * Every notification the scheduled job can send.
 *
 * Connection requests aren't listed on purpose --
 * those are core account events and always send.
 */
const NOTIFICATION_GROUPS = [
  {
    label: "DATES THAT MATTER",
    items: [
      {
        type: "birthday",
        title: "Birthdays",
        description: "When your partner's birthday is coming up.",
      },
      {
        type: "anniversary",
        title: "Anniversaries",
        description: "When your relationship anniversary is approaching.",
      },
      {
        type: "special_date",
        title: "Special dates",
        description: "Dates you've saved on the Special Dates screen.",
      },
    ],
  },
  {
    label: "DREAMS & GOALS",
    items: [
      {
        type: "dream_upcoming",
        title: "Upcoming dreams",
        description: "When a shared dream's target date is close.",
      },
      {
        type: "dream_overdue",
        title: "Overdue dreams",
        description: "When a dream has passed its target date.",
      },
      {
        type: "goal_upcoming",
        title: "Upcoming goals",
        description: "When a relationship goal is due soon.",
      },
      {
        type: "goal_overdue",
        title: "Overdue goals",
        description: "When a goal has passed its target date.",
      },
    ],
  },
  {
    label: "TRIVIA",
    items: [
      {
        type: "trivia_nudge",
        title: "Trivia reminders",
        description: "A weekly nudge when you haven't played in a while.",
      },
      {
        type: "trivia_played",
        title: "Partner played trivia",
        description: "When your partner finishes a round.",
      },
    ],
  },
  {
    label: "EVERYDAY",
    items: [
      {
        type: "quote_of_day",
        title: "Quote of the Day",
        description: "A short daily reminder to be intentional.",
      },
      {
        type: "date_idea",
        title: "Date ideas",
        description: "A weekly suggestion for something to do together.",
      },
      {
        type: "inactivity",
        title: "Check-in reminders",
        description: "A nudge when you haven't opened the app in a few days.",
      },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `notification-preferences:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [preferences, setPreferences] = useState(cached || {});
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  const loadPreferences = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cachedPreferences = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cachedPreferences) {
      setPreferences(cachedPreferences);
      setLoading(false);
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/users/${userId}/notification-preferences`,
      );

      const data = await response.json();

      console.log("NOTIFICATION PREFERENCES RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your settings.");
      }

      const nextPreferences = data?.preferences || {};

      setPreferences(nextPreferences);

      if (cacheKey) setCachedData(cacheKey, nextPreferences);
    } catch (err) {
      console.log("NOTIFICATION PREFERENCES LOAD ERROR:", err);

      if (!cachedPreferences) {
        setError(err?.message || "Unable to load your settings.");
      }
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const toggle = async (type, enabled) => {
    if (!userId) return;

    // Update immediately so the switch feels responsive,
    // then roll back if the save fails.
    const previous = preferences;

    const next = { ...preferences };

    if (enabled) {
      delete next[type];
    } else {
      next[type] = false;
    }

    setPreferences(next);

    if (cacheKey) setCachedData(cacheKey, next);

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/users/${userId}/notification-preferences`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preferences: { [type]: enabled },
          }),
        },
      );

      const data = await response.json();

      console.log("SAVE NOTIFICATION PREFERENCE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save that setting.");
      }

      const saved = data?.preferences || next;

      setPreferences(saved);

      if (cacheKey) setCachedData(cacheKey, saved);
    } catch (err) {
      console.log("SAVE NOTIFICATION PREFERENCE ERROR:", err);

      setPreferences(previous);

      if (cacheKey) setCachedData(cacheKey, previous);

      setError(err?.message || "Unable to save that setting.");
    }
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

                <Text style={styles.pageTitle}>Notifications</Text>

                <Text style={styles.pageSubtitle}>
                  Choose what Between Us reminds you about.
                </Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {NOTIFICATION_GROUPS.map((group) => (
              <View style={styles.section} key={group.label}>
                <Text style={styles.sectionLabel}>{group.label}</Text>

                <View style={styles.card}>
                  {group.items.map((item, index) => (
                    <View key={item.type}>
                      {index > 0 ? <View style={styles.divider} /> : null}

                      <View style={styles.row}>
                        <View style={styles.rowContent}>
                          <Text style={styles.rowTitle}>{item.title}</Text>

                          <Text style={styles.rowDescription}>
                            {item.description}
                          </Text>
                        </View>

                        <Switch
                          value={preferences[item.type] !== false}
                          onValueChange={(value) => toggle(item.type, value)}
                          trackColor={{ false: "#DDD4CE", true: "#6B4E45" }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.noteCard}>
              <Text style={styles.noteText}>
                Connection requests always come through, so you never miss
                someone asking to connect with you.
              </Text>
            </View>
          </View>
        </ScrollView>
      </GlassBackground>
    </SafeAreaView>
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
    marginBottom: 20,
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

  pageSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: "#817771",
  },

  section: {
    marginTop: 18,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 9,
  },

  card: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },

  rowContent: {
    flex: 1,
    marginRight: 12,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  rowDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEE8E3",
  },

  noteCard: {
    marginTop: 22,
    padding: 17,
    borderRadius: 16,
    backgroundColor: "#EFE7E2",
  },

  noteText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#6F625C",
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
