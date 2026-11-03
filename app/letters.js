import { useCallback, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Button,
  Card,
  Chip,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Press,
  Screen,
  Segmented,
  Sheet,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import DateInput from "../components/DateInput";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * LETTERS
 * ==========================================
 *
 * Written now, opened later. Pick the day it unseals --
 * an anniversary, a birthday, "open when you're sad" in a
 * month's time -- and until then they only see its title
 * and the date. On the day, it opens with a little
 * ceremony, and the writer hears it was read.
 */

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

function isoIn(days) {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

const WHEN = [
  { label: "Today", days: 0 },
  { label: "In a week", days: 7 },
  { label: "In a month", days: 30 },
  { label: "In six months", days: 182 },
  { label: "In a year", days: 365 },
];

function longDate(iso) {
  if (!iso) return "";

  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysTo(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000,
  );
}

export default function LettersScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `letters:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [inbox, setInbox] = useState(cached?.inbox ?? []);
  const [sent, setSent] = useState(cached?.sent ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [side, setSide] = useState("For you");
  const [error, setError] = useState("");

  /* Writing one. */
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openOn, setOpenOn] = useState(isoIn(30));
  const [sending, setSending] = useState(false);

  /* Reading one. */
  const [reading, setReading] = useState(null);
  const unseal = useState(() => new Animated.Value(1))[0];

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/letters`);
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to load.");

      setInbox(data.inbox || []);
      setSent(data.sent || []);

      if (cacheKey) setCachedData(cacheKey, data);

      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load your letters.");
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

  const closeWriting = () => {
    setWriting(false);
    setTitle("");
    setBody("");
    setOpenOn(isoIn(30));
  };

  const send = async () => {
    if (!title.trim() || !body.trim() || sending) return;

    if (!DATE_SHAPE.test(openOn) || daysTo(openOn) < 0) {
      Alert.alert("Check the date", "Pick today or a day in the future.");
      return;
    }

    try {
      setSending(true);

      const response = await apiFetch(`/users/${userId}/letters`, {
        method: "POST",
        body: JSON.stringify({
          clerk_id: userId,
          title: title.trim(),
          body: body.trim(),
          open_on: openOn,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to send it.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      closeWriting();
      setSide("From you");
      await load();
    } catch (err) {
      Alert.alert("We couldn't send that", err?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  };

  /* Show a letter, unsealing it gently the first time. */
  const show = (letter, firstTime) => {
    setReading(letter);

    if (firstTime) {
      unseal.setValue(0);

      Animated.timing(unseal, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      unseal.setValue(1);
    }
  };

  const openLetter = async (letter) => {
    if (letter.opened) {
      show(letter, false);
      return;
    }

    if (!letter.ready) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});

      Alert.alert(
        "Still sealed",
        `“${letter.title}” opens on ${longDate(letter.open_on)}.`,
      );
      return;
    }

    try {
      const response = await apiFetch(
        `/users/${userId}/letters/${letter.id}/open`,
        {
          method: "POST",
          body: JSON.stringify({ clerk_id: userId }),
        },
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to open it.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      show(data.letter, true);
      load();
    } catch (err) {
      Alert.alert("Not just yet", err?.message || "Please try again.");
    }
  };

  const removeLetter = (letter) => {
    Alert.alert(
      "Delete this letter?",
      "They haven't opened it, so they will never see it.",
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await apiFetch(
                `/users/${userId}/letters/${letter.id}`,
                { method: "DELETE" },
              );

              if (!response.ok) throw new Error("Unable to delete it.");

              setReading(null);
              await load();
            } catch (err) {
              Alert.alert("We couldn't delete that", err?.message);
            }
          },
        },
      ],
    );
  };

  if (connected === false) {
    return <ConnectFirst feature="Letters" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const list = side === "For you" ? inbox : sent;
  const waiting = inbox.filter((letter) => letter.ready && !letter.opened);

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
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        >
          <GlassButton
            icon="edit"
            label="Write a letter"
            onPress={() => setWriting(true)}
          />
        </NavBar>

        <LargeTitle>Letters</LargeTitle>

        <SubTitle>Written now, opened later.</SubTitle>

        <Segmented
          options={["For you", "From you"]}
          value={side}
          onChange={setSide}
        />

        <Notice>{error}</Notice>

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={3} />
          </View>
        ) : list.length === 0 ? (
          <Empty
            icon="mail"
            title={
              side === "For you"
                ? "No letters for you yet"
                : "Write the first one"
            }
            text={
              side === "For you"
                ? "When they write you one, it arrives sealed until its day."
                : "For your anniversary, their birthday, or a hard day months from now."
            }
            action={
              side === "From you"
                ? {
                    title: "Write a Letter",
                    icon: "edit",
                    onPress: () => setWriting(true),
                  }
                : undefined
            }
          />
        ) : (
          <>
            {side === "For you" && waiting.length > 0 ? (
              <GroupFooter>
                {waiting.length === 1
                  ? "One is ready to open."
                  : `${waiting.length} are ready to open.`}
              </GroupFooter>
            ) : null}

            {list.map((letter) => {
              const days = daysTo(letter.open_on);

              const status = letter.opened
                ? side === "For you"
                  ? "Opened"
                  : "They've read it"
                : letter.ready
                  ? side === "For you"
                    ? "Ready to open"
                    : "Ready for them"
                  : days === 1
                    ? "Opens tomorrow"
                    : `Opens ${longDate(letter.open_on)}`;

              return (
                <Press
                  key={letter.id}
                  onPress={() =>
                    side === "For you"
                      ? openLetter(letter)
                      : show(letter, false)
                  }
                >
                  <Card
                    style={[
                      styles.envelope,
                      letter.ready && !letter.opened && styles.envelopeReady,
                    ]}
                  >
                    <View
                      style={[
                        styles.seal,
                        letter.opened && styles.sealOpen,
                        letter.ready && !letter.opened && styles.sealReady,
                      ]}
                    >
                      <Icon
                        name={
                          letter.opened
                            ? "envelopeOpen"
                            : letter.ready
                              ? "heart"
                              : "lock"
                        }
                        size={18}
                        color={
                          letter.ready && !letter.opened ? "#FFFFFF" : T.accent
                        }
                        filled
                      />
                    </View>

                    <View style={styles.envelopeText}>
                      <Text style={styles.envelopeTitle} numberOfLines={2}>
                        {letter.title}
                      </Text>

                      <Text
                        style={[
                          styles.envelopeStatus,
                          letter.ready && !letter.opened && styles.statusReady,
                        ]}
                      >
                        {status}
                      </Text>
                    </View>

                    <Icon name="chevron" size={16} color={T.label3} />
                  </Card>
                </Press>
              );
            })}
          </>
        )}
      </Screen>

      {/* WRITING */}

      <Sheet
        visible={writing}
        title="New Letter"
        onCancel={closeWriting}
        onSave={send}
        saveLabel="Seal"
        saveDisabled={!title.trim() || !body.trim() || sending}
        dirty={Boolean(title.trim() || body.trim())}
      >
        <Group>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title, e.g. Open on our anniversary"
            placeholderTextColor={T.label3}
            style={styles.field}
          />
        </Group>

        <GroupHeader>Opens</GroupHeader>

        <View style={styles.chips}>
          {WHEN.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={openOn === isoIn(option.days)}
              onPress={() => setOpenOn(isoIn(option.days))}
            />
          ))}
        </View>

        <Group>
          <DateInput
            value={openOn}
            onChangeText={setOpenOn}
            placeholder="YYYY-MM-DD"
            style={styles.field}
          />
        </Group>

        <GroupFooter>
          {DATE_SHAPE.test(openOn) && daysTo(openOn) >= 0
            ? daysTo(openOn) === 0
              ? "They can open it straight away."
              : `Sealed until ${longDate(openOn)}. They'll see the title, not the words.`
            : "Pick today or a day in the future."}
        </GroupFooter>

        <View style={styles.paper}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Dear…"
            placeholderTextColor={T.label3}
            style={styles.paperInput}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Button
          title="Seal the Letter"
          icon="lock"
          onPress={send}
          busy={sending}
          disabled={!title.trim() || !body.trim()}
        />
      </Sheet>

      {/* READING */}

      <Sheet
        visible={Boolean(reading)}
        title={reading?.mine ? "Your Letter" : "A Letter for You"}
        onCancel={() => setReading(null)}
      >
        {reading ? (
          <>
            <Animated.View
              style={[
                styles.paper,
                {
                  opacity: unseal,
                  transform: [
                    {
                      translateY: unseal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.letterTitle}>{reading.title}</Text>

              <Text style={styles.letterMeta}>
                Written {longDate(String(reading.created_at).slice(0, 10))}
              </Text>

              <Text style={styles.letterBody} selectable>
                {reading.body}
              </Text>
            </Animated.View>

            {reading.mine && !reading.opened ? (
              <Button
                title="Delete Letter"
                kind="destructive"
                onPress={() => removeLetter(reading)}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  envelope: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  envelopeReady: {
    borderWidth: 1.5,
    borderColor: T.secondary,
  },

  seal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  sealReady: {
    backgroundColor: T.you,
  },

  sealOpen: {
    backgroundColor: T.fill3,
  },

  envelopeText: {
    flex: 1,
  },

  envelopeTitle: {
    fontFamily: "ui-serif",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "600",
    color: T.label,
  },

  envelopeStatus: {
    fontSize: 13,
    color: T.label2,
    marginTop: 3,
  },

  statusReady: {
    color: T.secondary,
    fontWeight: "600",
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },

  paper: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.separator,
  },

  paperInput: {
    fontFamily: "ui-serif",
    fontSize: 18,
    lineHeight: 27,
    color: T.label,
    minHeight: 220,
  },

  letterTitle: {
    fontFamily: "ui-serif",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    color: T.label,
  },

  letterMeta: {
    fontSize: 13,
    color: T.label2,
    marginTop: 4,
  },

  letterBody: {
    fontFamily: "ui-serif",
    fontSize: 18,
    lineHeight: 28,
    color: T.label,
    marginTop: 18,
  },
});
