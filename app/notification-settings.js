import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { T } from "../lib/theme";
import {
  Cell,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  SubTitle,
  Toggle,
} from "../components/ui";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * NOTIFICATIONS, ALL OF THEM
 * ==========================================
 *
 * Every kind the app can send, as Settings lists them:
 * grouped, one switch each, saved the moment it moves.
 *
 * Connection requests are not here on purpose -- those
 * are account events and always send.
 */

const NOTIFICATION_GROUPS = [
  {
    label: "From your person",
    footer: "When they do something for you.",
    items: [
      { type: "appreciation", title: "Notes", icon: "heart" },
      { type: "love", title: "Hearts on what you did", icon: "heartOutline" },
      { type: "mood", title: "Their mood", icon: "mood" },
      {
        type: "daily_question_answered",
        title: "They answered tonight",
        icon: "lock",
      },
      { type: "repair", title: "Repairs", icon: "chat" },
      { type: "trivia_played", title: "They played trivia", icon: "sparkle" },
    ],
  },
  {
    label: "Dates that matter",
    items: [
      { type: "birthday", title: "Birthdays", icon: "calendar" },
      { type: "anniversary", title: "Anniversaries", icon: "heart" },
      { type: "special_date", title: "Special dates", icon: "calendar" },
      { type: "date_idea", title: "Date ideas", icon: "bulb" },
    ],
  },
  {
    label: "Dreams and goals",
    footer: "As a target date gets close, and once it has passed.",
    items: [
      { type: "dream_upcoming", title: "Dream coming up", icon: "dreams" },
      { type: "dream_overdue", title: "Dream overdue", icon: "dreams" },
      { type: "goal_upcoming", title: "Goal coming up", icon: "flag" },
      { type: "goal_overdue", title: "Goal overdue", icon: "flag" },
    ],
  },
  {
    label: "Every day",
    items: [
      { type: "daily_question", title: "Tonight's questions", icon: "lock" },
      { type: "quote_of_day", title: "Quote of the day", icon: "bulb" },
      { type: "trivia_nudge", title: "Trivia reminders", icon: "sparkle" },
      {
        type: "inactivity",
        title: "Haven't opened it in a while",
        icon: "bell",
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

      const response = await apiFetch(
        `/users/${userId}/notification-preferences`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your settings.");
      }

      const nextPreferences = data?.preferences || {};

      setPreferences(nextPreferences);

      if (cacheKey) setCachedData(cacheKey, nextPreferences);
    } catch (err) {
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

      const response = await apiFetch(
        `/users/${userId}/notification-preferences`,
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

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save that setting.");
      }

      const saved = data?.preferences || next;

      setPreferences(saved);

      if (cacheKey) setCachedData(cacheKey, saved);
    } catch (err) {
      setPreferences(previous);

      if (cacheKey) setCachedData(cacheKey, previous);

      setError(err?.message || "Unable to save that setting.");
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  return (
    <Screen>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Notifications</LargeTitle>

      <SubTitle>Choose what reaches your phone.</SubTitle>

      <Notice>{error}</Notice>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={4} />
        </View>
      ) : (
        NOTIFICATION_GROUPS.map((group) => (
          <View key={group.label} style={styles.group}>
            <GroupHeader>{group.label}</GroupHeader>

            <Group inset={52}>
              {group.items.map((item) => (
                <Cell
                  key={item.type}
                  leading={<Icon name={item.icon} size={20} color={T.accent} />}
                  title={item.title}
                  trailing={
                    <Toggle
                      value={preferences?.[item.type] !== false}
                      onChange={(value) => toggle(item.type, value)}
                    />
                  }
                />
              ))}
            </Group>

            {group.footer ? <GroupFooter>{group.footer}</GroupFooter> : null}
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
});
