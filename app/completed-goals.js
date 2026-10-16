import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { chooseAction } from "../lib/actions";
import {
  clearCachedData,
  getCachedData,
  setCachedData,
} from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Card,
  Cell,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
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
 * COMPLETED GOALS
 * ==========================================
 *
 * What the two of you have worked through, newest first.
 * Tap one that was ticked too soon to put it back.
 */

function finishedOn(date) {
  if (!date) return null;

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return null;

  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CompletedGoalsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

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

      const response = await apiFetch(`/users/${userId}/relationship-goals`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load completed goals.");
      }

      const completedGoals = Array.isArray(data?.goals)
        ? data.goals.filter((goal) => goal.status === "completed")
        : [];

      setGoals(completedGoals);

      if (cacheKey) setCachedData(cacheKey, completedGoals);
    } catch (err) {
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
      const response = await apiFetch(
        `/users/${userId}/relationship-goals/${goal.id}`,
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
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to move goal back.",
      );
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Completed goals" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/goals");
  };

  const sorted = [...goals].sort(
    (a, b) =>
      new Date(b.completed_at || 0).getTime() -
      new Date(a.completed_at || 0).getTime(),
  );

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

      <LargeTitle>Completed</LargeTitle>

      <SubTitle>Everything you&apos;ve worked through together.</SubTitle>

      <Notice>{error}</Notice>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={3} />
        </View>
      ) : sorted.length === 0 ? (
        <Empty
          icon="trophy"
          title="Nothing finished yet"
          text="Tick a goal when it's done and it lands here, with a celebration."
          action={{ title: "Back to Goals", icon: "flag", onPress: goBack }}
        />
      ) : (
        <>
          <Card style={styles.tally}>
            <Text style={styles.tallyNumber}>{sorted.length}</Text>

            <Text style={styles.tallyText}>
              {sorted.length === 1
                ? "goal done together"
                : "goals done together"}
            </Text>

            <Icon name="trophy" size={26} color={T.secondary} />
          </Card>

          <Group inset={52}>
            {sorted.map((goal) => (
              <Cell
                key={goal.id}
                leading={<Icon name="checkCircle" size={22} color={T.green} />}
                title={goal.title}
                subtitle={[goal.description, finishedOn(goal.completed_at)]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() =>
                  chooseAction({
                    title: goal.title,
                    options: [
                      {
                        label: "Put Back in Goals",
                        onPress: () => markActive(goal),
                      },
                    ],
                  })
                }
              />
            ))}
          </Group>

          <GroupFooter>Progress, not perfection.</GroupFooter>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  tally: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  tallyNumber: {
    fontFamily: "ui-rounded",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -1.6,
    color: T.accent,
  },

  tallyText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },
});
