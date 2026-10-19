import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import {
  clearCachedData,
  getCachedData,
  setCachedData,
} from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Button,
  Cell,
  Check,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  Sheet,
  SubTitle,
} from "../components/ui";
import Celebration from "../components/Celebration";
import ConnectFirst from "../components/ConnectFirst";
import DateInput from "../components/DateInput";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * GOALS
 * ==========================================
 *
 * What the two of you are working on, as a Reminders
 * list: tick the round check when it is done (and get
 * the celebration), tap the goal to change it.
 */

function byWhen(date) {
  if (!date) return null;

  const value = new Date(String(date).slice(0, 10) + "T12:00:00");

  if (Number.isNaN(value.getTime())) return null;

  return `By ${value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

export default function GoalsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `goals:${userId}` : null;
  const cachedGoals = cacheKey ? getCachedData(cacheKey) : undefined;

  const [goals, setGoals] = useState(cachedGoals || []);
  const [loading, setLoading] = useState(!cachedGoals);
  const [refreshing, setRefreshing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const loadGoals = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    // Show what we fetched last time immediately, then
    // quietly refresh in the background.
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
        throw new Error(data?.error || "Unable to load goals.");
      }

      const allGoals = Array.isArray(data?.goals) ? data.goals : [];

      // Only show active goals here.
      const activeGoals = allGoals.filter(
        (goal) => goal.status !== "completed",
      );

      setGoals(activeGoals);

      if (cacheKey) setCachedData(cacheKey, activeGoals);
    } catch (err) {
      // Only surface the error if we have nothing cached to show.
      if (!cached) {
        setError(err?.message || "Unable to load your goals.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const endCelebration = useCallback(() => setCelebrating(false), []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGoals();
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTargetDate("");
    setEditingGoal(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingGoal(null);
    setTitle("");
    setDescription("");
    setTargetDate("");
    setShowForm(true);
  };

  const openEditForm = (goal) => {
    setEditingGoal(goal);

    setTitle(goal.title || "");
    setDescription(goal.description || "");

    if (goal.target_date) {
      setTargetDate(new Date(goal.target_date).toISOString().split("T")[0]);
    } else {
      setTargetDate("");
    }

    setShowForm(true);
  };

  const saveGoal = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please give this goal a title.");
      return;
    }

    if (!userId) return;

    try {
      setSaving(true);

      let response;

      if (editingGoal) {
        response = await apiFetch(
          `/users/${userId}/relationship-goals/${editingGoal.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              target_date: targetDate.trim() || null,
            }),
          },
        );
      } else {
        response = await apiFetch(`/users/${userId}/relationship-goals`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            target_date: targetDate.trim() || null,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save goal.");
      }

      resetForm();
      await loadGoals();
    } catch (err) {
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to save goal.",
      );
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (goal) => {
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
            status: "completed",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to complete goal.");
      }

      setCelebrating(true);

      setGoals((current) => {
        const next = current.filter((item) => item.id !== goal.id);
        if (cacheKey) setCachedData(cacheKey, next);
        return next;
      });

      // The Completed Goals screen may have a stale cached
      // list that doesn't include this goal yet.
      if (userId) clearCachedData(`completed-goals:${userId}`);
    } catch (err) {
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to complete goal.",
      );
    }
  };

  const deleteGoal = (goal) => {
    Alert.alert(
      "Delete goal?",
      `"${goal.title}" will be permanently removed.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await apiFetch(
                `/users/${userId}/relationship-goals/${goal.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data?.error || "Unable to delete goal.");
              }

              setGoals((current) => {
                const next = current.filter((item) => item.id !== goal.id);
                if (cacheKey) setCachedData(cacheKey, next);
                return next;
              });
            } catch (err) {
              Alert.alert(
                "Something went wrong",
                err?.message || "Unable to delete goal.",
              );
            }
          },
        },
      ],
    );
  };

  if (connected === false) {
    return <ConnectFirst feature="Goals" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  return (
    <>
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
        >
          <GlassButton icon="add" label="Add a goal" onPress={openCreateForm} />
        </NavBar>

        <LargeTitle>Goals</LargeTitle>

        <SubTitle>What you&apos;re both working on right now.</SubTitle>

        <Notice>{error}</Notice>

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={3} />
          </View>
        ) : goals.length === 0 ? (
          <Empty
            icon="flag"
            title="Nothing you're working on yet"
            text="One goal you both care about, with a date if you want a nudge."
            action={{
              title: "Add a Goal",
              icon: "add",
              onPress: openCreateForm,
            }}
          />
        ) : (
          <>
            <Group inset={50}>
              {goals.map((goal) => (
                <View key={goal.id} style={styles.row}>
                  <Check
                    on={false}
                    onPress={() => markComplete(goal)}
                    label={`Mark ${goal.title} done`}
                  />

                  <View style={styles.rowBody}>
                    <Cell
                      title={goal.title}
                      subtitle={[goal.description, byWhen(goal.target_date)]
                        .filter(Boolean)
                        .join(" · ")}
                      chevron
                      onPress={() => openEditForm(goal)}
                    />
                  </View>
                </View>
              ))}
            </Group>

            <GroupFooter>
              Tick one when it&apos;s done. Small, steady steps.
            </GroupFooter>
          </>
        )}

        <Group inset={52}>
          <Cell
            leading={<Icon name="trophy" size={22} color={T.secondary} />}
            title="Completed together"
            chevron
            onPress={() => router.push("/completed-goals")}
          />
        </Group>
      </Screen>

      {/* A GOAL, NEW OR OLD */}

      <Sheet
        visible={showForm}
        title={editingGoal ? "Edit Goal" : "New Goal"}
        onCancel={resetForm}
        onSave={saveGoal}
        saveDisabled={!title.trim() || saving}
        dirty={
          editingGoal
            ? title !== (editingGoal.title || "") ||
              description !== (editingGoal.description || "") ||
              targetDate !==
                (editingGoal.target_date
                  ? new Date(editingGoal.target_date)
                      .toISOString()
                      .split("T")[0]
                  : "")
            : Boolean(title.trim() || description.trim() || targetDate.trim())
        }
      >
        <Group>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Talk it through when we argue"
            placeholderTextColor={T.label3}
            style={styles.field}
            autoFocus={!editingGoal}
          />

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Why it matters (optional)"
            placeholderTextColor={T.label3}
            style={[styles.field, styles.fieldTall]}
            multiline
            textAlignVertical="top"
          />

          <DateInput
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="By when? YYYY-MM-DD (optional)"
            style={styles.field}
          />
        </Group>

        <GroupFooter>
          With a date, you both get a nudge as it gets close.
        </GroupFooter>

        <Button
          title={editingGoal ? "Save Changes" : "Add Goal"}
          onPress={saveGoal}
          busy={saving}
          disabled={!title.trim()}
        />

        {editingGoal ? (
          <Group inset={52}>
            <Cell
              leading={<Icon name="trash" size={20} color={T.red} />}
              title="Delete Goal"
              destructive
              onPress={() => {
                const goal = editingGoal;

                resetForm();
                setTimeout(() => deleteGoal(goal), 450);
              }}
            />
          </Group>
        ) : null}
      </Sheet>

      <Celebration
        visible={celebrating}
        title="Goal complete"
        message="Something you worked on together, done."
        onDone={endCelebration}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
  },

  rowBody: {
    flex: 1,
    marginLeft: -4,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },

  fieldTall: {
    minHeight: 92,
  },
});
