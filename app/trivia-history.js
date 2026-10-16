import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { timeAgo } from "../lib/activity";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Avatar,
  Button,
  Card,
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
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * TRIVIA, EVERY ROUND
 * ==========================================
 *
 * Three numbers across the top -- rounds, best score,
 * how often right -- then every round either of you
 * played, yours in rose and theirs in plum.
 */

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>

      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function TriviaHistoryScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

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

      const response = await apiFetch(`/users/${userId}/trivia/history`);

      const data = await response.json();

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

  if (connected === false) {
    return <ConnectFirst feature="Trivia" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

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

      <LargeTitle>Trivia</LargeTitle>

      <SubTitle>How well you know each other, round by round.</SubTitle>

      <Notice>{error}</Notice>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={3} />
        </View>
      ) : sessions.length === 0 ? (
        <Empty
          icon="sparkle"
          title="No rounds yet"
          text="Five questions about each other. They hear when you've played."
          action={{
            title: "Play a Round",
            icon: "sparkle",
            onPress: () => router.push("/trivia"),
          }}
        />
      ) : (
        <>
          {stats && stats.rounds_played > 0 ? (
            <Card style={styles.stats}>
              <Stat value={stats.rounds_played} label="Rounds" />

              <View style={styles.statRule} />

              <Stat value={stats.best_score} label="Best" />

              <View style={styles.statRule} />

              <Stat
                value={stats.accuracy === null ? "—" : `${stats.accuracy}%`}
                label="Right"
              />
            </Card>
          ) : null}

          <Button
            title="Play a Round"
            icon="sparkle"
            onPress={() => router.push("/trivia")}
          />

          <GroupHeader>Every round</GroupHeader>

          <Group inset={64}>
            {sessions.map((session) => {
              const total = session.total_questions || 0;
              const perfect = total > 0 && session.score === total;
              const name = session.is_you
                ? "You"
                : session.player_first_name?.trim() || "Your partner";

              return (
                <Cell
                  key={session.id}
                  leading={
                    <Avatar
                      name={name}
                      who={session.is_you ? "you" : "them"}
                      size={40}
                    />
                  }
                  title={`${name} scored ${session.score}/${total}`}
                  subtitle={timeAgo(session.completed_at)}
                  trailing={
                    perfect ? (
                      <Icon name="trophy" size={18} color={T.secondary} />
                    ) : null
                  }
                />
              );
            })}
          </Group>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
  },

  stat: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    fontFamily: "ui-rounded",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: T.accent,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
    marginTop: 2,
  },

  statRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: T.separator,
  },
});
