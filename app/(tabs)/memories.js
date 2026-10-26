import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  Sheet,
  Icon,
} from "../../components/ui";
import ConnectFirst from "../../components/ConnectFirst";
import { SkeletonList } from "../../components/Skeleton";
import DateInput from "../../components/DateInput";
import {
  RemotePhoto,
  photosAvailable,
  pickPhoto,
  uploadPhoto,
} from "../../components/Photo";

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
  const [photoId, setPhotoId] = useState(null);

  /* The memory open in full, from tapping its card. */
  const [viewing, setViewing] = useState(null);
  const [localUri, setLocalUri] = useState(null);
  const [uploading, setUploading] = useState(false);

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
          photoId: item.photo_id || null,
          photoUrl: item.photo_url || null,
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

  const choosePhoto = async () => {
    try {
      const picked = await pickPhoto({ aspect: [4, 3] });

      if (!picked) return;

      setLocalUri(picked.uri);
      setUploading(true);

      setPhotoId(await uploadPhoto(userId, picked.base64));
    } catch (err) {
      setLocalUri(null);

      Alert.alert(
        "That photo didn't go up",
        err?.message || "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setTitle("");
    setNote("");
    setWhen("");
    setPhotoId(null);
    setLocalUri(null);
  };

  const saveMemory = async () => {
    if (!title.trim() || saving || uploading) return;

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
          photo_id: photoId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this memory.");
      }

      setTitle("");
      setNote("");
      setWhen("");
      closeSheet();

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
                        ? router.push("/dates")
                        : setViewing(entry)
                  }
                >
                  <Card padded={false} style={styles.entryCard}>
                    {entry.photoId ? (
                      <RemotePhoto
                        id={entry.photoId}
                        url={entry.photoUrl}
                        style={styles.photo}
                      />
                    ) : null}

                    <View style={styles.entry}>
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

                      {entry.kind === "Memories" ? (
                        <Icon name="chevron" size={16} color={T.label3} />
                      ) : null}
                    </View>
                  </Card>
                </Press>
              ))}
            </View>
          ))
        )}
      </Screen>

      {/* A MEMORY IN FULL */}

      <Sheet
        visible={Boolean(viewing)}
        title="Memory"
        onCancel={() => setViewing(null)}
      >
        {viewing ? (
          <>
            {viewing.photoId ? (
              <View style={styles.fullPhotoWrap}>
                <RemotePhoto
                  id={viewing.photoId}
                  url={viewing.photoUrl}
                  style={styles.fullPhoto}
                />
              </View>
            ) : null}

            <View style={styles.full}>
              <Text style={styles.fullTitle}>{viewing.title}</Text>

              {viewing.date ? (
                <Text style={styles.fullDate}>
                  {new Date(
                    `${String(viewing.date).slice(0, 10)}T12:00:00`,
                  ).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              ) : null}

              {viewing.note ? (
                <Text style={styles.fullNote} selectable>
                  {viewing.note}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </Sheet>

      {/* NEW MEMORY SHEET */}

      <Sheet
        visible={sheetOpen}
        title="New Memory"
        onCancel={closeSheet}
        onSave={saveMemory}
        saveDisabled={!title.trim() || saving || uploading}
        dirty={Boolean(
          title.trim() || note.trim() || when.trim() || photoId || localUri,
        )}
      >
        {/* The photo first, as in the prototype. */}
        {photosAvailable ? (
          <Press
            onPress={choosePhoto}
            scaleTo={0.98}
            outerStyle={styles.photoPress}
          >
            {localUri || photoId ? (
              <View style={styles.photoPicked}>
                <RemotePhoto
                  id={photoId}
                  localUri={localUri}
                  style={StyleSheet.absoluteFill}
                />

                {uploading ? (
                  <View style={styles.photoBusy}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}

                <View style={styles.photoPill}>
                  <Text style={styles.photoPillText}>Change Photo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.photoAdd}>
                <Ionicons name="image-outline" size={26} color={T.accent} />

                <Text style={styles.photoAddText}>Add a Photo</Text>
              </View>
            )}
          </Press>
        ) : null}

        <Card padded={false}>
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
          disabled={!title.trim() || uploading}
        />
      </Sheet>
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

  fullPhotoWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
  },

  fullPhoto: {
    width: "100%",
    aspectRatio: 4 / 3,
  },

  full: {
    paddingHorizontal: 20,
    gap: 6,
  },

  fullTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: T.label,
  },

  fullDate: {
    fontSize: 14,
    color: T.label2,
  },

  fullNote: {
    fontSize: 17,
    lineHeight: 25,
    color: T.label,
    marginTop: 8,
  },

  entryCard: {
    overflow: "hidden",
  },

  photo: {
    width: "100%",
    height: 190,
  },

  photoPress: {
    marginHorizontal: 16,
  },

  photoAdd: {
    height: 120,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: T.label3,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  photoAddText: {
    fontSize: 15,
    fontWeight: "600",
    color: T.accent,
  },

  photoPicked: {
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: T.fill3,
  },

  photoBusy: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  photoPill: {
    position: "absolute",
    right: 12,
    bottom: 12,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  photoPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
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
});
