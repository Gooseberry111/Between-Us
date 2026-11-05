import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  PanResponder,
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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { onLive } from "../lib/live";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T, themedStyles, useTheme } from "../lib/theme";
import { useDiscardGuard } from "../lib/useDiscardGuard";
import {
  BUBBLES,
  WALLPAPERS,
  bubbleFor,
  useNoteStyle,
  wallpaperFor,
} from "../lib/noteStyle";
import {
  Avatar,
  GlassButton,
  Icon,
  Mark,
  Notice,
  Sheet,
  keyboardBehavior,
} from "../components/ui";
import {
  RemotePhoto,
  photosAvailable,
  pickPhoto,
  uploadPhoto,
} from "../components/Photo";
import ConnectFirst from "../components/ConnectFirst";
import {
  VoicePlayer,
  VoiceRecorder,
  voiceAvailable,
} from "../components/Voice";
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
 * Swipe a note to the right to answer it. Notes are never
 * deleted: what was said stays, for both of you. Each of
 * you can pick your bubble colours and a wallpaper.
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
  useTheme();

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
  /* The note you are answering, quoted above yours. */
  const [replyTo, setReplyTo] = useState(null);
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

  /* A note arriving while you are here shows straight away. */
  useEffect(
    () =>
      onLive((type) => {
        if (type === "appreciation") load();
      }),
    [load],
  );

  const send = async () => {
    const message = draft.trim();

    if (!message || sending || !userId) return;

    try {
      setSending(true);

      const response = await apiFetch(`/users/${userId}/appreciations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, reply_to: replyTo?.id || null }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to send that.");
      }

      setDraft("");
      setReplyTo(null);

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

  /* A voice note, already uploaded by the recorder. */
  const sendVoice = async (audioId, seconds) => {
    try {
      const response = await apiFetch(`/users/${userId}/appreciations`, {
        method: "POST",
        body: JSON.stringify({
          audio_id: audioId,
          audio_seconds: seconds,
          reply_to: replyTo?.id || null,
        }),
      });

      const json = await response.json();

      if (!response.ok) throw new Error(json?.error || "Unable to send that.");

      setReplyTo(null);

      const list = Array.isArray(json?.appreciations) ? json.appreciations : [];

      setNotes(list);

      if (cacheKey) setCachedData(cacheKey, list);
    } catch (err) {
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to send that.",
      );
    }
  };

  /* A half-written note, not just a tapped starter. */
  useDiscardGuard(
    draft.trim() !== "" &&
      !STARTERS.some((text) => text.trim() === draft.trim()),
  );

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
      onSendVoice={sendVoice}
      userId={userId}
      replyTo={replyTo}
      onReply={setReplyTo}
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

/* Their first name, from any note of theirs. */
function partnerFirst(notes) {
  return notes.find((note) => !note.mine)?.from_first_name || "Them";
}

function timeLabel(iso) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* Notes from the same one of you, close together, read as one. */
const GROUP_MS = 4 * 60 * 1000;

function sameGroup(a, b) {
  if (!a || !b || a.mine !== b.mine) return false;

  return (
    Math.abs(new Date(b.created_at) - new Date(a.created_at)) < GROUP_MS &&
    dayLabel(a.created_at) === dayLabel(b.created_at)
  );
}

/* ---------- the wallpaper ---------- */

/* Fixed spots, so the pattern never jumps between renders. */
const SPRINKLE = Array.from({ length: 26 }, (_, index) => ({
  left: `${(index * 37 + 11) % 96}%`,
  top: `${(index * 53 + 7) % 97}%`,
  size: 10 + ((index * 7) % 14),
  turn: `${((index * 41) % 60) - 30}deg`,
}));

function Wallpaper({ look, photoId, userId }) {
  useTheme();

  if (look.key === "photo" && photoId) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RemotePhoto id={photoId} style={StyleSheet.absoluteFill} />
        <View style={styles.photoDim} />
      </View>
    );
  }

  if (!look.colors) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={look.colors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {look.hearts
        ? SPRINKLE.map((spot, index) => (
            <Text
              key={index}
              style={[
                styles.sprinkleHeart,
                {
                  left: spot.left,
                  top: spot.top,
                  fontSize: spot.size,
                  transform: [{ rotate: spot.turn }],
                },
              ]}
            >
              ♥
            </Text>
          ))
        : null}

      {look.stars
        ? SPRINKLE.map((spot, index) => (
            <View
              key={index}
              style={[
                styles.star,
                {
                  left: spot.left,
                  top: spot.top,
                  width: spot.size > 18 ? 3 : 2,
                  height: spot.size > 18 ? 3 : 2,
                  opacity: spot.size > 16 ? 0.9 : 0.5,
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

/* ---------- one bubble ---------- */

function BubbleFace({ mine, colour, last, flash, children }) {
  useTheme();

  const shape = [
    styles.bubble,
    mine ? styles.bubbleMine : styles.bubbleTheirs,
    !last && (mine ? styles.bubbleMineJoined : styles.bubbleTheirsJoined),
    flash && styles.bubbleFlash,
  ];

  if (!colour) {
    return <View style={[shape, styles.bubblePlain]}>{children}</View>;
  }

  return (
    <LinearGradient
      colors={colour.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={shape}
    >
      {children}
    </LinearGradient>
  );
}

/*
 * Swipe a bubble to the right to answer it, like Messages.
 * The reply arrow fades in behind it; past the line the
 * phone taps once, and letting go starts the reply.
 */
const SWIPE_AT = 56;

function SwipeToReply({ onReply, children }) {
  useTheme();

  const drag = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);

  /* The latest handler, so a re-render mid-swipe changes nothing. */
  const replyRef = useRef(onReply);
  replyRef.current = onReply;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          armed.current = false;
        },
        onPanResponderMove: (_, g) => {
          const pull = Math.max(0, g.dx);
          const eased =
            pull < SWIPE_AT ? pull : SWIPE_AT + (pull - SWIPE_AT) * 0.3;

          drag.setValue(eased);

          if (!armed.current && pull >= SWIPE_AT) {
            armed.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
          } else if (armed.current && pull < SWIPE_AT) {
            armed.current = false;
          }
        },
        onPanResponderRelease: () => {
          if (armed.current) replyRef.current();
          armed.current = false;

          Animated.spring(drag, {
            toValue: 0,
            friction: 7,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          armed.current = false;
          Animated.spring(drag, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [drag],
  );

  return (
    <View {...pan.panHandlers}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeIcon,
          {
            opacity: drag.interpolate({
              inputRange: [10, SWIPE_AT],
              outputRange: [0, 1],
              extrapolate: "clamp",
            }),
            transform: [
              {
                scale: drag.interpolate({
                  inputRange: [10, SWIPE_AT, SWIPE_AT + 10],
                  outputRange: [0.4, 1, 1.15],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <Icon name="reply" size={16} color={T.accent} />
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX: drag }] }}>
        {children}
      </Animated.View>
    </View>
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
  onSendVoice,
  userId,
  replyTo,
  onReply,
  onRefresh,
  onBack,
}) {
  useTheme();

  const scroller = useRef(null);
  const input = useRef(null);
  const [recording, setRecording] = useState(false);
  const [customising, setCustomising] = useState(false);

  const [look, saveLook] = useNoteStyle(userId);
  const mineColour = bubbleFor(look.mine) || BUBBLES[0];
  const theirColour = look.theirs === "default" ? null : bubbleFor(look.theirs);
  const wall =
    look.wallpaper === "photo" && look.photoId
      ? { key: "photo", dark: true }
      : wallpaperFor(look.wallpaper);
  /* Over a dark wallpaper the day labels and times go light. */
  const overDark = wall.dark === true;
  const onWall = wall.dark !== null;

  /* Where each note sits, so a quote can take you to it. */
  const positions = useRef({});
  const [flash, setFlash] = useState(null);

  const goTo = (id) => {
    const y = positions.current[id];

    if (y === undefined) return;

    scroller.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    setFlash(id);
    setTimeout(() => setFlash(null), 1400);
  };

  /* Oldest at the top, like any conversation. */
  const thread = [...notes].sort(
    (a, b) =>
      new Date(a.created_at || 0).getTime() -
      new Date(b.created_at || 0).getTime(),
  );

  /* A day label wherever the day changes. */
  const rows = [];

  thread.forEach((note, index) => {
    const label = dayLabel(note.created_at);

    if (rows.length === 0 || rows[rows.length - 1].label !== label) {
      rows.push({ type: "day", key: `day-${label}-${note.id}`, label });
    }

    rows.push({
      type: "note",
      key: note.id,
      label,
      note,
      first: !sameGroup(thread[index - 1], note),
      last: !sameGroup(note, thread[index + 1]),
    });
  });

  const them = partnerFirst(notes);

  const reply = (note) => {
    Haptics.selectionAsync().catch(() => {});
    onReply(note);
    setTimeout(() => input.current?.focus(), 150);
  };

  const pickWallpaper = async () => {
    try {
      const photo = await pickPhoto({ aspect: [9, 16] });

      if (!photo?.base64) return;

      const id = await uploadPhoto(userId, photo.base64);

      saveLook({ wallpaper: "photo", photoId: id });
    } catch (err) {
      Alert.alert("That photo didn't work", err?.message || "Try another one.");
    }
  };

  const dayStyle = [
    styles.day,
    onWall && styles.dayOnWall,
    overDark && styles.dayOnDark,
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Wallpaper look={wall} photoId={look.photoId} userId={userId} />

      <KeyboardAvoidingView style={styles.fill} behavior={keyboardBehavior}>
        <View style={[styles.nav, onWall && styles.navOnWall]}>
          <View style={styles.navSide}>
            <GlassButton icon="back" label="Back" onPress={onBack} />
          </View>

          <View style={styles.navCentre}>
            <Avatar name={them} size={30} />

            <Text
              style={[styles.navTitle, overDark && styles.navTitleOnDark]}
              numberOfLines={1}
            >
              {notes.some((note) => !note.mine)
                ? `Notes with ${them}`
                : "Notes"}
            </Text>
          </View>

          <View style={[styles.navSide, styles.navSideEnd]}>
            <GlassButton
              icon="palette"
              label="Customise"
              onPress={() => setCustomising(true)}
            />
          </View>
        </View>

        <ScrollView
          ref={scroller}
          style={styles.fill}
          contentContainerStyle={[
            styles.thread,
            !loading && rows.length === 0 && styles.threadEmpty,
          ]}
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
            <View style={[styles.empty, onWall && styles.emptyOnWall]}>
              <Mark size={52} />

              <Text style={styles.emptyTitle}>Say it out loud</Text>

              <Text style={styles.emptyText}>
                The small things are the ones worth saying. They see it the
                moment you send it.
              </Text>

              {/* A way in: tap one and finish the sentence. */}
              <View style={styles.starterList}>
                {STARTERS.map((text) => (
                  <Pressable
                    key={text}
                    onPress={() => onDraft(text)}
                    style={({ pressed }) => [
                      styles.starter,
                      pressed && styles.starterPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.starterText}>{text.trim()}…</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            rows.map((row) => {
              if (row.type === "day") {
                return (
                  <Text key={row.key} style={dayStyle}>
                    {row.label}
                  </Text>
                );
              }

              const { note } = row;
              const colour = note.mine ? mineColour : theirColour;
              const ink = colour ? colour.text : T.label;

              return (
                <View
                  key={row.key}
                  onLayout={(event) => {
                    positions.current[note.id] = event.nativeEvent.layout.y;
                  }}
                  style={[styles.noteRow, row.first && styles.noteRowFirst]}
                >
                  <SwipeToReply onReply={() => reply(note)}>
                    <View
                      style={[
                        styles.bubbleRow,
                        note.mine ? styles.rowMine : styles.rowTheirs,
                      ]}
                    >
                      <BubbleFace
                        mine={note.mine}
                        colour={colour}
                        last={row.last}
                        flash={flash === note.id}
                      >
                        {/* The note this answers: tap it to see it. */}
                        {note.reply ? (
                          <Pressable
                            onPress={() => goTo(note.reply.id)}
                            style={[
                              styles.quote,
                              colour && styles.quoteOnColour,
                              colour && { borderLeftColor: ink },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Show the note this answers"
                          >
                            <Text
                              style={[
                                styles.quoteWho,
                                colour && { color: ink },
                              ]}
                            >
                              {note.reply.mine ? "You" : them}
                            </Text>

                            <Text
                              style={[
                                styles.quoteText,
                                colour && { color: ink, opacity: 0.85 },
                              ]}
                              numberOfLines={2}
                            >
                              {note.reply.voice
                                ? "🎙 Voice note"
                                : note.reply.message}
                            </Text>
                          </Pressable>
                        ) : null}

                        {note.audio_id ? (
                          <VoicePlayer
                            url={note.audio_url}
                            seconds={note.audio_seconds}
                            light={Boolean(colour) && ink === "#FFFFFF"}
                          />
                        ) : (
                          <Text style={[styles.bubbleText, { color: ink }]}>
                            {note.message}
                          </Text>
                        )}
                      </BubbleFace>

                      {row.last ? (
                        <Text
                          style={[
                            styles.stamp,
                            note.mine ? styles.stampMine : styles.stampTheirs,
                            onWall && styles.stampOnWall,
                            overDark && styles.stampOnDark,
                          ]}
                        >
                          {timeLabel(note.created_at)}
                        </Text>
                      ) : null}
                    </View>
                  </SwipeToReply>
                </View>
              );
            })
          )}
        </ScrollView>

        {replyTo ? (
          <View style={styles.replyBar}>
            <View style={styles.replyAccent} />

            <View style={styles.replyText}>
              <Text style={styles.quoteWho}>
                Replying to {replyTo.mine ? "yourself" : them}
              </Text>

              <Text style={styles.quoteText} numberOfLines={1}>
                {replyTo.audio_id ? "🎙 Voice note" : replyTo.message}
              </Text>
            </View>

            <Pressable
              onPress={() => onReply(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Stop replying"
            >
              <Icon name="close" size={16} color={T.label2} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.composer, onWall && styles.composerOnWall]}>
          {!recording ? (
            <TextInput
              ref={input}
              value={draft}
              onChangeText={onDraft}
              placeholder={
                replyTo ? "Write your reply…" : "Say something sweet…"
              }
              placeholderTextColor={T.label3}
              style={styles.input}
              multiline
            />
          ) : null}

          {/* No text yet: the mic, which becomes the recording bar. */}
          {!draft.trim() && voiceAvailable ? (
            <VoiceRecorder
              userId={userId}
              onRecording={setRecording}
              onSent={onSendVoice}
            />
          ) : null}

          {recording ? null : (
            <Pressable
              onPress={onSend}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send"
              hitSlop={8}
            >
              <LinearGradient
                colors={
                  !draft.trim() || sending
                    ? [T.label3, T.label3]
                    : mineColour.colors
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.send}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Icon name="arrowUp" size={16} color="#FFFFFF" />
                )}
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Customise
        visible={customising}
        look={look}
        onChange={saveLook}
        onPhoto={pickWallpaper}
        onClose={() => setCustomising(false)}
        them={them}
        userId={userId}
      />
    </SafeAreaView>
  );
}

/* ---------- making it yours ---------- */

function Swatch({ colour, on, label, onPress }) {
  useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={styles.swatchWrap}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
    >
      <View style={[styles.swatchRing, on && styles.swatchRingOn]}>
        {colour ? (
          <LinearGradient
            colors={colour.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.swatch}
          />
        ) : (
          <View style={[styles.swatch, styles.swatchPlain]} />
        )}
      </View>

      <Text style={[styles.swatchLabel, on && styles.swatchLabelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Customise({
  visible,
  look,
  onChange,
  onPhoto,
  onClose,
  them,
  userId,
}) {
  useTheme();

  const tap = (next) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const mine = bubbleFor(look.mine) || BUBBLES[0];
  const theirs = look.theirs === "default" ? null : bubbleFor(look.theirs);
  const wall =
    look.wallpaper === "photo" && look.photoId
      ? { key: "photo", dark: true }
      : wallpaperFor(look.wallpaper);

  return (
    <Sheet
      visible={visible}
      title="Make it yours"
      subtitle="Only you see these"
      onCancel={onClose}
      onSave={onClose}
      saveLabel="Done"
    >
      {/* A little thread, so you see it as you choose. */}
      <View style={styles.preview}>
        <Wallpaper look={wall} photoId={look.photoId} userId={userId} />

        <View style={[styles.rowTheirs, styles.previewRow]}>
          <BubbleFace mine={false} colour={theirs} last>
            <Text
              style={[
                styles.bubbleText,
                { color: theirs ? theirs.text : T.label },
              ]}
            >
              Thinking of you 💭
            </Text>
          </BubbleFace>
        </View>

        <View style={[styles.rowMine, styles.previewRow]}>
          <BubbleFace mine colour={mine} last>
            <Text style={[styles.bubbleText, { color: mine.text }]}>
              Come home soon ❤️
            </Text>
          </BubbleFace>
        </View>
      </View>

      <Text style={styles.pickTitle}>Your bubbles</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatches}
      >
        {BUBBLES.map((item) => (
          <Swatch
            key={item.key}
            colour={item}
            label={item.label}
            on={look.mine === item.key}
            onPress={() => tap({ mine: item.key })}
          />
        ))}
      </ScrollView>

      <Text style={styles.pickTitle}>{them}'s bubbles</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatches}
      >
        <Swatch
          colour={null}
          label="Classic"
          on={look.theirs === "default"}
          onPress={() => tap({ theirs: "default" })}
        />

        {BUBBLES.map((item) => (
          <Swatch
            key={item.key}
            colour={item}
            label={item.label}
            on={look.theirs === item.key}
            onPress={() => tap({ theirs: item.key })}
          />
        ))}
      </ScrollView>

      <Text style={styles.pickTitle}>Wallpaper</Text>

      <View style={styles.walls}>
        {photosAvailable ? (
          <Pressable
            onPress={onPhoto}
            style={[
              styles.wallTile,
              styles.wallPhoto,
              look.wallpaper === "photo" && styles.wallTileOn,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Use one of your photos"
          >
            {look.photoId ? (
              <RemotePhoto id={look.photoId} style={StyleSheet.absoluteFill} />
            ) : null}

            <View style={styles.wallPhotoBadge}>
              <Icon name="photo" size={16} color="#FFFFFF" />
            </View>

            <Text style={[styles.wallLabel, styles.wallLabelLight]}>
              {look.photoId ? "Change photo" : "Your photo"}
            </Text>
          </Pressable>
        ) : null}

        {WALLPAPERS.map((item) => {
          const on = look.wallpaper === item.key;

          return (
            <Pressable
              key={item.key}
              onPress={() => tap({ wallpaper: item.key })}
              style={[styles.wallTile, on && styles.wallTileOn]}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} wallpaper`}
              accessibilityState={{ selected: on }}
            >
              {item.colors ? (
                <Wallpaper look={item} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.wallPlain]} />
              )}

              <Text
                style={[styles.wallLabel, item.dark && styles.wallLabelLight]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = themedStyles(() => ({
  bubbleFlash: {
    borderWidth: 2,
    borderColor: T.secondary,
  },

  quote: {
    borderLeftWidth: 3,
    borderLeftColor: T.accent,
    backgroundColor: T.fill4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },

  quoteOnColour: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  quoteWho: {
    fontSize: 12,
    fontWeight: "700",
    color: T.accent,
  },

  quoteText: {
    fontSize: 13,
    lineHeight: 17,
    color: T.label2,
  },

  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: T.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  replyAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    backgroundColor: T.accent,
  },

  replyText: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  fill: {
    flex: 1,
  },

  photoDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },

  sprinkleHeart: {
    position: "absolute",
    color: "#E0607E",
    opacity: 0.14,
  },

  star: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.separator,
    paddingBottom: 6,
  },

  navOnWall: {
    borderBottomWidth: 0,
  },

  navSide: {
    flex: 1,
    flexDirection: "row",
  },

  navSideEnd: {
    justifyContent: "flex-end",
  },

  navCentre: {
    alignItems: "center",
    gap: 3,
    maxWidth: "50%",
  },

  navTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label,
  },

  navTitleOnDark: {
    color: "#FFFFFF",
  },

  thread: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },

  loading: {
    paddingHorizontal: 2,
  },

  threadEmpty: {
    justifyContent: "center",
  },

  empty: {
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 4,
  },

  emptyOnWall: {
    marginHorizontal: 8,
    paddingVertical: 24,
    borderRadius: 24,
    backgroundColor: T.surface,
  },

  starterList: {
    alignSelf: "stretch",
    gap: 8,
    marginTop: 20,
  },

  starter: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: T.fill4,
  },

  starterPressed: {
    backgroundColor: T.pressed,
  },

  starterText: {
    fontSize: 16,
    color: T.label,
  },

  emptyTitle: {
    marginTop: 14,
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
    marginTop: 16,
    marginBottom: 6,
  },

  dayOnWall: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.6)",
    color: "#4A2D3C",
  },

  dayOnDark: {
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "#FFFFFF",
  },

  noteRow: {
    marginTop: 2,
  },

  noteRowFirst: {
    marginTop: 8,
  },

  swipeIcon: {
    position: "absolute",
    left: 4,
    top: "50%",
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
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
    shadowColor: "#000000",
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  bubblePlain: {
    backgroundColor: T.surface,
  },

  bubbleMine: {
    borderBottomRightRadius: 6,
  },

  bubbleTheirs: {
    borderBottomLeftRadius: 6,
  },

  /* Inside a run, the corner on your side stays soft. */
  bubbleMineJoined: {
    borderBottomRightRadius: 20,
    borderTopRightRadius: 8,
  },

  bubbleTheirsJoined: {
    borderBottomLeftRadius: 20,
    borderTopLeftRadius: 8,
  },

  bubbleText: {
    fontSize: 17,
    lineHeight: 22,
    color: T.label,
  },

  stamp: {
    fontSize: 11,
    color: T.label3,
    marginTop: 3,
    marginBottom: 2,
  },

  stampMine: {
    marginRight: 6,
  },

  stampTheirs: {
    marginLeft: 6,
  },

  stampOnWall: {
    color: "rgba(74,45,60,0.65)",
  },

  stampOnDark: {
    color: "rgba(255,255,255,0.75)",
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

  composerOnWall: {
    borderWidth: 0,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
    alignItems: "center",
    justifyContent: "center",
  },

  /* the customise sheet */

  preview: {
    height: 150,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: T.appBackground,
    marginBottom: 8,
  },

  previewRow: {
    maxWidth: "80%",
  },

  pickTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 10,
  },

  swatches: {
    gap: 14,
    paddingRight: 8,
  },

  swatchWrap: {
    alignItems: "center",
    gap: 5,
  },

  swatchRing: {
    padding: 3,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "transparent",
  },

  swatchRingOn: {
    borderColor: T.accent,
  },

  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  swatchPlain: {
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.separator,
  },

  swatchLabel: {
    fontSize: 11,
    color: T.label2,
  },

  swatchLabelOn: {
    color: T.label,
    fontWeight: "600",
  },

  walls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  wallTile: {
    width: "31%",
    aspectRatio: 0.72,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },

  wallTileOn: {
    borderColor: T.accent,
  },

  wallPlain: {
    backgroundColor: T.appBackground,
  },

  wallPhoto: {
    backgroundColor: T.accent,
  },

  wallPhotoBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  wallLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A2D3C",
  },

  wallLabelLight: {
    color: "#FFFFFF",
  },
}));
