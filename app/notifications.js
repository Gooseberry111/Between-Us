import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { timeAgo } from "../lib/activity";
import {
  clearCachedData,
  getCachedData,
  setCachedData,
} from "../lib/dataCache";
import { T } from "../lib/theme";
import {
  Cell,
  Empty,
  GlassButton,
  Group,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
} from "../components/ui";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * NOTIFICATIONS
 * ==========================================
 *
 * Everything the app has told you, newest first, grouped
 * by day. Each kind has its symbol, and tapping one takes
 * you to the thing it is about. Opening the screen marks
 * them all read.
 */

const KINDS = {
  appreciation: { icon: "heart", tint: T.you, to: "/appreciations" },
  love: { icon: "heart", tint: T.you, to: "/activity" },
  mood: { icon: "mood", tint: T.you, to: "/(tabs)/home" },
  hug: { icon: "heart", tint: T.you, to: "/(tabs)/home" },
  hug_declined: { icon: "heartOutline", tint: T.label2, to: null },
  game_turn: { icon: "sparkle", tint: T.accent, to: "/game" },
  game_over: { icon: "trophy", tint: T.secondary, to: "/game" },
  daily_question: { icon: "lock", tint: T.accent, to: "/daily-question" },
  daily_question_answered: {
    icon: "lock",
    tint: T.accent,
    to: "/daily-question",
  },
  dream: { icon: "sparkle", tint: T.accent, to: "/(tabs)/dreams" },
  dream_upcoming: { icon: "sparkle", tint: T.accent, to: "/(tabs)/dreams" },
  dream_overdue: { icon: "sparkle", tint: T.orange, to: "/(tabs)/dreams" },
  goal_upcoming: { icon: "flag", tint: T.accent, to: "/goals" },
  goal_overdue: { icon: "flag", tint: T.orange, to: "/goals" },
  birthday: { icon: "calendar", tint: T.you, to: "/special-dates" },
  anniversary: { icon: "heart", tint: T.you, to: "/special-dates" },
  special_date: { icon: "calendar", tint: T.accent, to: "/special-dates" },
  date_idea: { icon: "calendar", tint: T.secondary, to: "/dates" },
  trivia_played: { icon: "sparkle", tint: T.secondary, to: "/trivia-history" },
  trivia_nudge: { icon: "sparkle", tint: T.secondary, to: "/trivia" },
  repair: { icon: "chat", tint: T.accent, to: "/repair" },
  connection_request: { icon: "personAdd", tint: T.accent, to: "/find-person" },
  connection_accepted: { icon: "personAdd", tint: T.green, to: "/(tabs)/home" },
  connection_closed: { icon: "person", tint: T.label2, to: null },
  connection_unlinked: { icon: "person", tint: T.label2, to: null },
  quote_of_day: { icon: "bulb", tint: T.secondary, to: null },
  inactivity: { icon: "bell", tint: T.accent, to: "/(tabs)/home" },
};

function kindOf(type) {
  return KINDS[type] || { icon: "bell", tint: T.accent, to: null };
}

function dayGroup(iso) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "Earlier";

  const today = new Date();
  const days = Math.floor(
    (new Date(today.toDateString()) - new Date(date.toDateString())) / 86400000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";

  return "Earlier";
}

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

      const response = await apiFetch(`/users/${userId}/notifications`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your notifications.");
      }

      const nextNotifications = Array.isArray(data?.notifications)
        ? data.notifications
        : [];

      setNotifications(nextNotifications);

      if (cacheKey) setCachedData(cacheKey, nextNotifications);

      /*
       * Opening this screen means they have been seen. Mark
       * them read on the server, then locally, so the bell
       * clears without anyone tapping each card in turn.
       */
      if (nextNotifications.some((item) => item.is_read === false)) {
        try {
          await apiFetch(`/users/${userId}/notifications/read-all`, {
            method: "POST",
          });

          const readNotifications = nextNotifications.map((item) => ({
            ...item,
            is_read: true,
          }));

          setNotifications(readNotifications);

          if (cacheKey) setCachedData(cacheKey, readNotifications);

          /* Home reads this cache for the dot on the bell. */
          clearCachedData(`home:${userId}`);
        } catch (readError) {}
      }
    } catch (err) {
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const open = (notification) => {
    if (!notification.is_read) {
      apiFetch(`/users/${userId}/notifications/${notification.id}`, {
        method: "PATCH",
      }).catch(() => {});

      setNotifications((current) => {
        const next = current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        );

        if (cacheKey) setCachedData(cacheKey, next);

        return next;
      });
    }

    const to = kindOf(notification.type).to;

    if (to) router.push(to);
  };

  /* Grouped by day, keeping newest first. */
  const groups = [];

  notifications.forEach((item) => {
    const label = dayGroup(item.created_at);
    const last = groups[groups.length - 1];

    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={T.accent}
        />
      }
    >
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Notifications</LargeTitle>

      <Notice>{error}</Notice>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={4} />
        </View>
      ) : notifications.length === 0 ? (
        <Empty
          icon="bell"
          title="Nothing new"
          text="Reminders, notes and anything they do for you show up here."
        />
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.group}>
            <GroupHeader>{group.label}</GroupHeader>

            <Group inset={62}>
              {group.items.map((item) => {
                const kind = kindOf(item.type);

                return (
                  <Cell
                    key={item.id}
                    leading={
                      <View style={styles.badge}>
                        <Icon name={kind.icon} size={17} color={kind.tint} />

                        {!item.is_read ? <View style={styles.unread} /> : null}
                      </View>
                    }
                    title={item.title || "Notification"}
                    subtitle={[item.message, timeAgo(item.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                    chevron={Boolean(kind.to)}
                    onPress={() => open(item)}
                  />
                );
              })}
            </Group>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  group: {
    gap: 14,
  },

  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  unread: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: T.you,
    borderWidth: 2,
    borderColor: T.surface,
  },
});
