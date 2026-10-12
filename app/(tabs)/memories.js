import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useIsConnected } from "../../lib/connection";
import { T } from "../../lib/theme";
import {
  Button,
  Card,
  Empty,
  GlassButton,
  GroupHeader,
  LargeTitle,
  NavBar,
  Press,
  Screen,
  Segmented,
} from "../../components/ui";
import ConnectFirst from "../../components/ConnectFirst";
import { SkeletonList } from "../../components/Skeleton";
import DateInput from "../../components/DateInput";

/*
 * ==========================================
 * TIMELINE
 * ==========================================
 *
 * Everything the two of you have marked, newest
 * first: memories you saved, dates you had, and the
 * milestones that come round. One filter across the
 * top, and a sheet for adding a memory.
 */

const FILTERS = ["All", "Memories", "Dates", "Milestones"];

const PROMPTS = ["Our first date", "Our song", "An inside joke"];

function groupLabel(iso) {
  if (!iso) return "Undated";

  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const days = Math.round((today - date) / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function TimelineScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `timeline:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [entries, setEntries] = useState(cached?.entries ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const [memoriesData, platesData, datesData] = await Promise.all([
        apiFetch(`/users/${userId}/memories`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        apiFetch(`/users/${userId}/date-plans`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        apiFetch(`/users/${userId}/special-dates`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);

      const memories = (Array.isArray(memoriesData) ? memoriesData : []).map(
        (item) => ({
          id: `memory-${item.id}`,
          kind: "Memories",
          title: item.title,
          note: item.description,
          date: item.memory_date,
        }),
      );

      const plans = (platesData?.plans || [])
        .filter((plan) => plan.status === "done")
        .map((plan) => ({
          id: `date-${plan.id}`,
          kind: "Dates",
          title: plan.title,
          note: plan.place,
          date: plan.plan_date,
        }));

      const milestones = (Array.isArray(datesData) ? datesData : []).map(
        (item) => ({
          id: `milestone-${item.id}`,
          kind: "Milestones",
          title: item.title,
          note: "Comes round every year",
          date: item.event_date,
        }),
      );

      const all = [...memories, ...plans, ...milestones].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || "")),
      );

      setEntries(all);

      if (cacheKey) setCachedData(cacheKey, { entries: all });
    } catch (err) {
      console.log("TIMELINE LOAD ERROR:", err);
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

  const saveMemory = async () => {
    if (!title.trim() || saving) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_id: userId,
          title: title.trim(),
          description: note.trim() || null,
          memory_date: when.trim() || new Date().toISOString().slice(0, 10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this memory.");
      }

      setTitle("");
      setNote("");
      setWhen("");
      setSheetOpen(false);

      await load();
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Timeline" showBack={false} />;
  }

  const shown =
    filter === "All"
      ? entries
      : entries.filter((entry) => entry.kind === filter);

  /* Group by day, keeping the order. */
  const groups = [];

  shown.forEach((entry) => {
    const label = groupLabel(entry.date);
    const last = groups[groups.length - 1];

    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  });

  return (
    <>
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
        <NavBar>
          <GlassButton
            icon="add"
            label="Add a memory"
            onPress={() => setSheetOpen(true)}
          />
        </NavBar>

        <LargeTitle>Timeline</LargeTitle>

        <Segmented options={FILTERS} value={filter} onChange={setFilter} />

        {loading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SkeletonList count={3} />
          </View>
        ) : shown.length === 0 ? (
          <Empty
            icon="images-outline"
            title={
              entries.length === 0
                ? "Your story starts with one moment"
                : "Nothing here yet"
            }
            text="A place, a line they said, a night worth keeping. It shows up here for both of you."
            chips={PROMPTS.map((prompt) => ({
              label: prompt,
              onPress: () => {
                setTitle(prompt);
                setSheetOpen(true);
              },
            }))}
            action={{
              title: "Add a Memory",
              icon: "add",
              onPress: () => setSheetOpen(true),
            }}
          />
        ) : (
          groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <GroupHeader>{group.label}</GroupHeader>

              {group.items.map((entry) => (
                <Press
                  key={entry.id}
                  onPress={() =>
                    entry.kind === "Milestones"
                      ? router.push("/special-dates")
                      : entry.kind === "Dates"
                        ? router.push("/(tabs)/dates")
                        : null
                  }
                >
                  <Card style={styles.entry}>
                    <View
                      style={[
                        styles.entryIcon,
                        entry.kind === "Dates" && styles.entryIconDate,
                        entry.kind === "Milestones" && styles.entryIconMile,
                      ]}
                    >
                      <Ionicons
                        name={
                          entry.kind === "Dates"
                            ? "calendar"
                            : entry.kind === "Milestones"
                              ? "heart"
                              : "camera"
                        }
                        size={17}
                        color={
                          entry.kind === "Milestones" ? T.accentText : T.you
                        }
                      />
                    </View>

                    <View style={styles.entryText}>
                      <Text style={styles.entryTitle}>{entry.title}</Text>

                      {entry.note ? (
                        <Text style={styles.entryNote} numberOfLines={2}>
                          {entry.note}
                        </Text>
                      ) : null}
                    </View>
                  </Card>
                </Press>
              ))}
            </View>
          ))
        )}
      </Screen>

      {/* NEW MEMORY SHEET */}

      <Modal
        visible={sheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSheetOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheetNav}>
            <Text
              style={styles.sheetCancel}
              onPress={() => setSheetOpen(false)}
            >
              Cancel
            </Text>

            <Text style={styles.sheetTitle}>New Memory</Text>

            <Text
              style={[styles.sheetSave, !title.trim() && styles.sheetSaveOff]}
              onPress={saveMemory}
            >
              Save
            </Text>
          </View>

          <View style={styles.sheetBody}>
            <Card>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What happened?"
                placeholderTextColor={T.label3}
                style={styles.field}
              />

              <View style={styles.fieldLine} />

              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Say a little more (optional)"
                placeholderTextColor={T.label3}
                style={[styles.field, styles.fieldTall]}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.fieldLine} />

              <DateInput
                value={when}
                onChangeText={setWhen}
                placeholder="When? YYYY-MM-DD (optional)"
                style={styles.field}
              />
            </Card>

            <Button
              title="Save Memory"
              onPress={saveMemory}
              busy={saving}
              disabled={!title.trim()}
              style={styles.sheetButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },

  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },

  entryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.youTint,
    alignItems: "center",
    justifyContent: "center",
  },

  entryIconDate: {
    backgroundColor: T.youTint,
  },

  entryIconMile: {
    backgroundColor: T.accentTint,
  },

  entryText: {
    flex: 1,
  },

  entryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  entryNote: {
    fontSize: 13,
    lineHeight: 17,
    color: T.label2,
    marginTop: 2,
  },

  sheet: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  sheetNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  sheetCancel: {
    fontSize: 17,
    color: T.accent,
    width: 70,
  },

  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: T.label,
  },

  sheetSave: {
    fontSize: 17,
    fontWeight: "600",
    color: T.accent,
    width: 70,
    textAlign: "right",
  },

  sheetSaveOff: {
    color: T.label3,
  },

  sheetBody: {
    padding: 0,
    gap: 16,
  },

  field: {
    fontSize: 16,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  fieldTall: {
    minHeight: 92,
  },

  fieldLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.separator,
    marginLeft: 16,
  },

  sheetButton: {
    marginHorizontal: 16,
  },
});
