import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { chooseAction } from "../lib/actions";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import { Chip, GlassButton, Icon, Mark, Notice } from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * NOTES
 * ==========================================
 *
 * Saying thank you out loud is the cheapest thing that
 * makes a relationship feel better, and the thing people
 * most often forget. So it reads like Messages: yours in
 * rose on the right, theirs in plum on the left, newest
 * at the bottom, and the box to write in always there.
 *
 * Hold one of yours to delete it.
 */

const STARTERS = ["Thank you for ", "I noticed ", "I loved it when "];

function dayLabel(iso) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const days = Math.floor(
    (new Date(today.toDateString()) - new Date(date.toDateString())) / 86400000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });

  return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

export default function AppreciationsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `appreciations:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [notes, setNotes] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await apiFetch(`/users/${userId}/appreciations`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to load appreciations.");
      }

      const list = Array.isArray(json?.appreciations) ? json.appreciations : [];

      setNotes(list);

      if (cacheKey) setCachedData(cacheKey, list);
    } catch (err) {
      setError(err?.message || "Unable to load appreciations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const message = draft.trim();

    if (!message || sending || !userId) return;

    try {
      setSending(true);

      const response = await apiFetch(`/users/${userId}/appreciations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to send that.");
      }

      setDraft("");

      const list = Array.isArray(json?.appreciations) ? json.appreciations : [];

      setNotes(list);

      if (cacheKey) setCachedData(cacheKey, list);
    } catch (err) {
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to send that.",
      );
    } finally {
      setSending(false);
    }
  };

  const remove = (note) => {
    Alert.alert("Delete this note?", "It will be removed for both of you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await apiFetch(
              `/users/${userId}/appreciations/${note.id}`,
              { method: "DELETE" },
            );

            const json = await response.json();

            if (!response.ok) {
              throw new Error(json?.error || "Unable to delete that.");
            }

            setNotes((current) => {
              const next = current.filter((item) => item.id !== note.id);
              if (cacheKey) setCachedData(cacheKey, next);
              return next;
            });
          } catch (err) {
            Alert.alert(
              "Something went wrong",
              err?.message || "Unable to delete that.",
            );
          }
        },
      },
    ]);
  };

  if (connected === false) {
    return <ConnectFirst feature="Notes" showBack />;
  }

  return (
    <NotesThread
      notes={notes}
      loading={loading}
      refreshing={refreshing}
      error={error}
      draft={draft}
      sending={sending}
      onDraft={setDraft}
      onSend={send}
      onRemove={remove}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/home");
      }}
    />
  );
}

function NotesThread({
  notes,
  loading,
  refreshing,
  error,
  draft,
  sending,
  onDraft,
  onSend,
  onRemove,
  onRefresh,
  onBack,
}) {
  const scroller = useRef(null);

  /* Oldest at the top, like any conversation. */
  const thread = [...notes].sort(
    (a, b) =>
      new Date(a.created_at || 0).getTime() -
      new Date(b.created_at || 0).getTime(),
  );

  /* A day label wherever the day changes. */
  const rows = [];

  thread.forEach((note) => {
    const label = dayLabel(note.created_at);

    if (rows.length === 0 || rows[rows.length - 1].label !== label) {
      rows.push({ type: "day", key: `day-${label}-${note.id}`, label });
    }

    rows.push({ type: "note", key: note.id, label, note });
  });

  const hold = (note) => {
    if (!note.mine) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    chooseAction({
      title: "Your note",
      options: [
        { label: "Delete", destructive: true, onPress: () => onRemove(note) },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.nav}>
          <View style={styles.navSide}>
            <GlassButton icon="back" label="Back" onPress={onBack} />
          </View>

          <View style={styles.navCentre}>
            <Mark size={22} />

            <Text style={styles.navTitle}>Notes</Text>
          </View>

          <View style={styles.navSide} />
        </View>

        <ScrollView
          ref={scroller}
          style={styles.fill}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            scroller.current?.scrollToEnd({ animated: false })
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.accent}
            />
          }
        >
          <Notice>{error}</Notice>

          {loading ? (
            <View style={styles.loading}>
              <SkeletonList count={3} />
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Say it out loud</Text>

              <Text style={styles.emptyText}>
                The small things are the ones worth saying. They see it the
                moment you send it.
              </Text>
            </View>
          ) : (
            rows.map((row) =>
              row.type === "day" ? (
                <Text key={row.key} style={styles.day}>
                  {row.label}
                </Text>
              ) : (
                <Pressable
                  key={row.key}
                  onLongPress={() => hold(row.note)}
                  delayLongPress={350}
                  style={[
                    styles.bubbleRow,
                    row.note.mine ? styles.rowMine : styles.rowTheirs,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      row.note.mine ? styles.bubbleMine : styles.bubbleTheirs,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        row.note.mine && styles.bubbleTextMine,
                      ]}
                    >
                      {row.note.message}
                    </Text>
                  </View>

                  {!row.note.mine && row.note.from_first_name ? (
                    <Text style={styles.from}>{row.note.from_first_name}</Text>
                  ) : null}
                </Pressable>
              ),
            )
          )}
        </ScrollView>

        {/* A way in when the box is empty. */}
        {!draft ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.starters}
            keyboardShouldPersistTaps="always"
          >
            {STARTERS.map((text) => (
              <Chip
                key={text}
                label={`${text.trim()}…`}
                tinted
                onPress={() => onDraft(text)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={onDraft}
            placeholder="Say thank you…"
            placeholderTextColor={T.label3}
            style={styles.input}
            multiline
          />

          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            hitSlop={8}
          >
            <View
              style={[
                styles.send,
                (!draft.trim() || sending) && styles.sendOff,
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="arrowUp" size={16} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  fill: {
    flex: 1,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.separator,
    paddingBottom: 6,
  },

  navSide: {
    flex: 1,
    flexDirection: "row",
  },

  navCentre: {
    alignItems: "center",
    gap: 2,
  },

  navTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label,
  },

  thread: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },

  loading: {
    paddingHorizontal: 2,
  },

  empty: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: T.label,
  },

  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    textAlign: "center",
    marginTop: 6,
  },

  day: {
    alignSelf: "center",
    fontSize: 12,
    fontWeight: "600",
    color: T.label2,
    marginTop: 14,
    marginBottom: 4,
  },

  bubbleRow: {
    maxWidth: "80%",
  },

  rowMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },

  rowTheirs: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },

  bubbleMine: {
    backgroundColor: T.you,
    borderBottomRightRadius: 6,
  },

  bubbleTheirs: {
    backgroundColor: T.surface,
    borderBottomLeftRadius: 6,
  },

  bubbleText: {
    fontSize: 17,
    lineHeight: 22,
    color: T.label,
  },

  bubbleTextMine: {
    color: "#FFFFFF",
  },

  from: {
    fontSize: 11,
    color: T.label2,
    marginTop: 3,
    marginLeft: 8,
  },

  starters: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.separator,
    backgroundColor: T.surface,
  },

  input: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    maxHeight: 120,
    paddingTop: 7,
    paddingBottom: 7,
  },

  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  sendOff: {
    backgroundColor: T.label3,
  },
});
