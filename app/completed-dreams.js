import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { coverFor, progressOf } from "../lib/dreams";
import { T } from "../lib/theme";
import {
  Button,
  Card,
  Empty,
  GlassButton,
  LargeTitle,
  NavBar,
  Screen,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import DreamCover from "../components/DreamCover";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * COMPLETED DREAMS
 * ==========================================
 *
 * Everything the two of you have finished, newest
 * first, each with its cover and when it was done. One
 * that was ticked off too soon can go back on the board.
 */

function finishedOn(date) {
  if (!date) return "Finished together";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "Finished together";

  return `Finished ${parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}

export default function CompletedDreamsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `completed-dreams:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [dreams, setDreams] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/dreams`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load completed dreams.");
      }

      const finished = (Array.isArray(data?.dreams) ? data.dreams : [])
        .filter((dream) => dream.is_completed)
        .sort(
          (a, b) =>
            new Date(b.completed_at || 0).getTime() -
            new Date(a.completed_at || 0).getTime(),
        );

      setDreams(finished);

      if (cacheKey) setCachedData(cacheKey, finished);
    } catch (err) {
      console.log("COMPLETED DREAMS LOAD ERROR:", err);
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dreams");
  };

  const putBack = (dream) => {
    Alert.alert(
      "Put it back on the board?",
      `“${dream.title}” moves back to your dreams, steps and all.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Put Back",
          onPress: async () => {
            try {
              setMoving(dream.id);

              const response = await apiFetch(
                `/users/${userId}/dreams/${dream.id}`,
                {
                  method: "PUT",
                  body: JSON.stringify({
                    clerk_id: userId,
                    is_completed: false,
                  }),
                },
              );

              if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Unable to move it back.");
              }

              setDreams((current) => {
                const next = current.filter((item) => item.id !== dream.id);

                if (cacheKey) setCachedData(cacheKey, next);

                return next;
              });
            } catch (err) {
              Alert.alert(
                "We couldn't do that",
                err?.message || "Please try again.",
              );
            } finally {
              setMoving(null);
            }
          },
        },
      ],
    );
  };

  if (connected === false) {
    return <ConnectFirst feature="Completed dreams" showBack />;
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={T.accent}
        />
      }
    >
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Completed</LargeTitle>

      <SubTitle>
        {dreams.length === 1
          ? "One dream, done together."
          : dreams.length > 1
            ? `${dreams.length} dreams, done together.`
            : "Everything you finish together lands here."}
      </SubTitle>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={3} />
        </View>
      ) : dreams.length === 0 ? (
        <Empty
          icon="trophy"
          title="Nothing finished yet"
          text="Tick the last step on a dream and it comes here, with a celebration."
          action={{
            title: "Back to Dreams",
            icon: "dreams",
            onPress: goBack,
          }}
        />
      ) : (
        dreams.map((dream) => {
          const steps = progressOf(dream);

          return (
            <Card key={dream.id} padded={false} style={styles.card}>
              <DreamCover
                cover={coverFor(dream)}
                photoId={dream.photo_id}
                height={110}
                iconSize={30}
              >
                <View style={styles.doneChip}>
                  <Text style={styles.doneChipText}>✓ Done</Text>
                </View>
              </DreamCover>

              <View style={styles.body}>
                <Text style={styles.title}>{dream.title}</Text>

                <Text style={styles.meta}>
                  {[
                    finishedOn(dream.completed_at),
                    steps.total ? `${steps.total} steps` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>

                {dream.description ? (
                  <Text style={styles.note}>{dream.description}</Text>
                ) : null}

                <Button
                  title="Put Back on the Board"
                  icon="undo"
                  kind="gray"
                  size="small"
                  block={false}
                  busy={moving === dream.id}
                  onPress={() => putBack(dream)}
                  style={styles.putBack}
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  card: {
    overflow: "hidden",
  },

  doneChip: {
    position: "absolute",
    left: 12,
    top: 12,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },

  doneChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  body: {
    padding: 16,
  },

  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: T.label,
  },

  meta: {
    fontSize: 13,
    color: T.label2,
    marginTop: 2,
  },

  note: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label,
    marginTop: 10,
  },

  putBack: {
    alignSelf: "flex-start",
    marginTop: 14,
  },
});
