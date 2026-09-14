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

export default function NotificationsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `notifications:${userId}` : null;
  const cachedNotifications = cacheKey ? getCachedData(cacheKey) : undefined;

  const [notifications, setNotifications] = useState(cachedNotifications || []);
  const [loading, setLoading] = useState(!cachedNotifications);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cached = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cached) {
      setNotifications(cached);
      setLoading(false);
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/notifications`);

      const data = await response.json();

      console.log("NOTIFICATIONS RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your notifications.");
      }

      const nextNotifications = Array.isArray(data?.notifications)
        ? data.notifications
        : [];

      setNotifications(nextNotifications);

      if (cacheKey) setCachedData(cacheKey, nextNotifications);
    } catch (err) {
      console.log("NOTIFICATIONS LOAD ERROR:", err);

      if (!cached) {
        setError(err?.message || "Unable to load your notifications.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
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

                <Text style={styles.pageTitle}>Notifications</Text>

                <Text style={styles.pageSubtitle}>
                  Updates and reminders for your relationship.
                </Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* NOTIFICATIONS */}

            <View style={styles.section}>
              {notifications.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="notifications-outline"
                      size={23}
                      color="#6B4E45"
                    />
                  </View>

                  <Text style={styles.emptyTitle}>Nothing new</Text>

                  <Text style={styles.emptyText}>
                    When something important happens, you'll find it here.
                  </Text>
                </View>
              ) : (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    userId={userId}
                    onRead={(id) => {
                      setNotifications((current) => {
                        const next = current.map((item) =>
                          item.id === id ? { ...item, is_read: true } : item,
                        );
                        if (cacheKey) setCachedData(cacheKey, next);
                        return next;
                      });
                    }}
                  />
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </GlassBackground>
    </SafeAreaView>
  );
}

function NotificationCard({ notification, userId, onRead }) {
  const date = notification.created_at
    ? new Date(notification.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const getIcon = () => {
    switch (notification.type) {
      case "birthday":
        return "gift-outline";

      case "anniversary":
        return "heart-outline";

      case "reminder":
        return "notifications-outline";

      case "connection":
      case "connection_request":
      case "connection_accepted":
      case "connection_unlinked":
        return "people-outline";

      case "special_date":
        return "calendar-outline";

      case "dream_upcoming":
      case "dream_overdue":
        return "sparkles-outline";

      case "goal_upcoming":
      case "goal_overdue":
        return "flag-outline";

      case "trivia_nudge":
        return "help-circle-outline";

      case "inactivity":
        return "hand-left-outline";

      case "quote_of_day":
        return "chatbubble-ellipses-outline";

      case "date_idea":
        return "restaurant-outline";

      default:
        return "notifications-outline";
    }
  };

  const handlePress = async () => {
    if (notification.is_read || !userId) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/users/${userId}/notifications/${notification.id}`,
        {
          method: "PATCH",
        },
      );

      const data = await response.json();

      console.log("MARK NOTIFICATION READ:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to mark notification as read.");
      }

      onRead(notification.id);
    } catch (err) {
      console.log("MARK NOTIFICATION READ ERROR:", err);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.notificationCard,
        !notification.is_read && styles.notificationCardUnread,
      ]}
    >
      <View style={styles.notificationRow}>
        <View
          style={[
            styles.notificationIcon,
            !notification.is_read && styles.notificationIconUnread,
          ]}
        >
          <Ionicons name={getIcon()} size={19} color="#6B4E45" />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.notificationTitle,
                !notification.is_read && styles.notificationTitleUnread,
              ]}
              numberOfLines={2}
            >
              {notification.title || "Notification"}
            </Text>

            {!notification.is_read ? <View style={styles.unreadDot} /> : null}
          </View>

          <Text style={styles.notificationMessage}>
            {notification.message || ""}
          </Text>

          <Text style={styles.notificationDate}>{date}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
    marginBottom: 25,
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
    marginTop: 2,
  },

  notificationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 10,
  },

  notificationCardUnread: {
    borderColor: "#D9C8C0",
  },

  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  notificationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  notificationIconUnread: {
    backgroundColor: "rgba(107, 78, 69, 0.09)",
  },

  notificationContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  notificationTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: "#302825",
  },

  notificationTitleUnread: {
    fontWeight: "700",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#6B4E45",
    marginTop: 6,
    marginLeft: 7,
  },

  notificationMessage: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    color: "#817771",
  },

  notificationDate: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: "600",
    color: "#9A918A",
  },

  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 17,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
  },

  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#302825",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: "#817771",
    textAlign: "center",
  },

  errorBox: {
    backgroundColor: "#F3E3DF",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    marginBottom: 13,
  },

  errorText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#8A4A3D",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 11,
    color: "#817771",
  },
});
