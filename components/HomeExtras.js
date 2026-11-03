import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { T } from "../lib/theme";
import { Button, Card, Icon, Press } from "./ui";
import { RemotePhoto } from "./Photo";

/*
 * ==========================================
 * ON HOME, WHEN THERE IS SOMETHING
 * ==========================================
 *
 * Two small cards that only appear when they have
 * something to say:
 *
 *   LetterWaiting   a letter from them is ready to open
 *   OnThisDay       a memory, date or dream from this day
 *                   in an earlier year
 *
 * and two that are always there:
 *
 *   Taps            a kiss, "miss you", "proud of you",
 *                   "thinking of you", one tap each
 *   Challenge       this week's love challenge
 */

function useOnFocus(path, pick) {
  const { userId } = useAuth();
  const [value, setValue] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;

      if (!userId) return undefined;

      apiFetch(`/users/${userId}/${path}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (live && data) setValue(pick(data));
        })
        .catch(() => {});

      return () => {
        live = false;
      };
    }, [userId, path]),
  );

  return value;
}

export function LetterWaiting({ partnerName }) {
  const router = useRouter();

  const ready = useOnFocus("letters", (data) =>
    (data.inbox || []).filter((letter) => letter.ready && !letter.opened),
  );

  if (!ready || ready.length === 0) return null;

  return (
    <Press onPress={() => router.push("/letters")}>
      <Card style={styles.letter}>
        <View style={styles.seal}>
          <Icon name="mail" size={18} color="#FFFFFF" />
        </View>

        <View style={styles.text}>
          <Text style={styles.title}>
            {ready.length === 1
              ? `A letter from ${partnerName} is ready`
              : `${ready.length} letters from ${partnerName} are ready`}
          </Text>

          <Text style={styles.sub} numberOfLines={1}>
            “{ready[0].title}”
          </Text>
        </View>

        <Icon name="chevron" size={16} color={T.label3} />
      </Card>
    </Press>
  );
}

export function OnThisDay() {
  const router = useRouter();

  const items = useOnFocus("on-this-day", (data) => data.items || []);

  if (!items || items.length === 0) return null;

  const first = items[0];
  const when =
    first.years_ago === 1
      ? "A year ago today"
      : `${first.years_ago} years ago today`;

  return (
    <Press
      onPress={() =>
        router.push(
          first.kind === "memory"
            ? "/(tabs)/memories"
            : first.kind === "date"
              ? "/dates"
              : "/completed-dreams",
        )
      }
    >
      <Card padded={false} style={styles.day}>
        {first.photo_id ? (
          <RemotePhoto
            id={first.photo_id}
            url={first.photo_url}
            style={styles.photo}
          />
        ) : null}

        <View style={styles.dayBody}>
          <View style={styles.dayHead}>
            <Icon name="clock" size={14} color={T.secondary} />

            <Text style={styles.dayLabel}>{when}</Text>
          </View>

          <Text style={styles.dayTitle}>{first.title}</Text>

          {first.detail ? (
            <Text style={styles.sub} numberOfLines={2}>
              {first.detail}
            </Text>
          ) : null}

          {items.length > 1 ? (
            <Text style={styles.more}>
              And {items.length - 1} more from this day
            </Text>
          ) : null}
        </View>
      </Card>
    </Press>
  );
}

const TAP_BUTTONS = [
  { kind: "kiss", emoji: "😘", label: "Kiss" },
  { kind: "miss", emoji: "🥺", label: "Miss you" },
  { kind: "proud", emoji: "🌟", label: "Proud" },
  { kind: "thinking", emoji: "💭", label: "Thinking of you" },
];

export function Taps({ partnerName }) {
  const { userId } = useAuth();
  const [sent, setSent] = useState(null);

  const send = (kind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setSent(kind);
    setTimeout(() => setSent(null), 1800);

    apiFetch(`/users/${userId}/tap`, {
      method: "POST",
      body: JSON.stringify({ clerk_id: userId, kind }),
    }).catch(() => {});
  };

  return (
    <Card style={styles.taps}>
      <Text style={styles.tapsTitle}>
        {sent
          ? `Sent to ${partnerName}`
          : `Send ${partnerName} a little something`}
      </Text>

      <View style={styles.tapRow}>
        {TAP_BUTTONS.map((tap) => (
          <Pressable
            key={tap.kind}
            onPress={() => send(tap.kind)}
            style={({ pressed }) => [styles.tap, pressed && styles.tapPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Send ${tap.label}`}
          >
            <View style={[styles.tapFace, sent === tap.kind && styles.tapSent]}>
              <Text style={styles.tapEmoji}>{tap.emoji}</Text>
            </View>

            <Text style={styles.tapLabel} numberOfLines={1}>
              {tap.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

export function Challenge() {
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(null);

  const data = useOnFocus("challenge", (value) => value);
  const challenge = override || data;

  if (!challenge?.challenge) return null;

  const done = async () => {
    try {
      setBusy(true);

      const response = await apiFetch(`/users/${userId}/challenge/done`, {
        method: "POST",
        body: JSON.stringify({ clerk_id: userId }),
      });

      const next = await response.json();

      if (response.ok) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});

        setOverride(next);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.challenge}>
      <View style={styles.dayHead}>
        <Icon name="heart" size={14} color={T.you} filled />

        <Text style={[styles.dayLabel, { color: T.you }]}>
          This week's challenge
        </Text>
      </View>

      <Text style={styles.challengeText}>{challenge.challenge}</Text>

      <Text style={styles.sub}>
        Chosen for how {challenge.for_name} likes to feel loved.
      </Text>

      {challenge.done ? (
        <View style={styles.challengeDone}>
          <Icon name="checkCircle" size={18} color={T.green} />

          <Text style={styles.challengeDoneText}>
            Done this week. {challenge.for_name} has been told.
          </Text>
        </View>
      ) : (
        <Button
          title="I Did It"
          kind="tinted"
          size="small"
          block={false}
          busy={busy}
          onPress={done}
          style={styles.challengeButton}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  letter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderColor: T.secondary,
  },

  seal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.you,
    alignItems: "center",
    justifyContent: "center",
  },

  text: {
    flex: 1,
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  sub: {
    fontSize: 14,
    lineHeight: 19,
    color: T.label2,
    marginTop: 2,
  },

  day: {
    overflow: "hidden",
  },

  photo: {
    width: "100%",
    height: 160,
  },

  dayBody: {
    padding: 16,
  },

  dayHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.secondary,
  },

  dayTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: T.label,
    marginTop: 6,
  },

  more: {
    fontSize: 13,
    color: T.accent,
    marginTop: 8,
  },

  taps: {
    gap: 12,
  },

  tapsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  tapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  tap: {
    alignItems: "center",
    gap: 6,
    width: 72,
  },

  tapPressed: {
    transform: [{ scale: 0.92 }],
  },

  tapFace: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  tapSent: {
    backgroundColor: T.youTint,
    borderWidth: 2,
    borderColor: T.you,
  },

  tapEmoji: {
    fontSize: 26,
  },

  tapLabel: {
    fontSize: 12,
    color: T.label2,
  },

  challenge: {
    gap: 6,
  },

  challengeText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: T.label,
  },

  challengeDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  challengeDoneText: {
    flex: 1,
    fontSize: 14,
    color: T.label2,
  },

  challengeButton: {
    marginTop: 8,
  },
});
