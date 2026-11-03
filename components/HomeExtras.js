import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { T } from "../lib/theme";
import { Card, Icon, Press } from "./ui";
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
});
