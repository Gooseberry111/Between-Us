import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import { daysUntil, myTimeZone, timeIn } from "../lib/distance";
import {
  Button,
  Card,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import DateInput from "../components/DateInput";

/*
 * ==========================================
 * FAR APART
 * ==========================================
 *
 * For when you are in different places: what time it is
 * where each of you is, and a countdown to the next time
 * you see each other. Your time zone is picked up from
 * your phone; either of you can set the day you meet.
 */

function place(zone) {
  if (!zone) return "";

  return zone.split("/").pop().replace(/_/g, " ");
}

export default function DistanceScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const [data, setData] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [meet, setMeet] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, tick] = useState(0);

  /* Keep the clocks honest while the screen is open. */
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000);

    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;

    try {
      const zone = myTimeZone();

      const [distance, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/distance`, {
          method: "PUT",
          body: JSON.stringify({ clerk_id: userId, timezone: zone }),
        }).then((r) => r.json()),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      setData(distance);
      setMeet(distance?.next_meet || "");
      setPartnerName(
        partnerData?.partner?.nickname?.trim() ||
          partnerData?.partner?.first_name?.trim() ||
          "",
      );
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load.");
    }
  }, [isLoaded, isSignedIn, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveMeet = async (value) => {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || daysUntil(value) < 0)) {
      Alert.alert("Check the date", "Pick today or a day in the future.");
      return;
    }

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/distance`, {
        method: "PUT",
        body: JSON.stringify({ clerk_id: userId, next_meet: value || null }),
      });

      const next = await response.json();

      if (!response.ok) throw new Error(next?.error || "Unable to save.");

      setData(next);
      setMeet(next.next_meet || "");
    } catch (err) {
      setError(err?.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Far apart" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const them = partnerName || "Them";
  const days = daysUntil(data?.next_meet);

  return (
    <Screen keyboard>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Far apart</LargeTitle>

      <SubTitle>Your times, and the next time you meet.</SubTitle>

      <Notice>{error}</Notice>

      <View style={styles.clocks}>
        <Card style={styles.clock}>
          <Text style={styles.clockWho}>You</Text>

          <Text style={[styles.clockTime, { color: T.you }]}>
            {timeIn(data?.my_timezone || myTimeZone())}
          </Text>

          <Text style={styles.clockPlace}>
            {place(data?.my_timezone || myTimeZone())}
          </Text>
        </Card>

        <Card style={styles.clock}>
          <Text style={styles.clockWho}>{them}</Text>

          <Text style={[styles.clockTime, { color: T.accent }]}>
            {data?.partner_timezone ? timeIn(data.partner_timezone) : "—"}
          </Text>

          <Text style={styles.clockPlace}>
            {data?.partner_timezone
              ? place(data.partner_timezone)
              : "Opens the app to share"}
          </Text>
        </Card>
      </View>

      {days !== null && days >= 0 ? (
        <Card style={styles.countdown}>
          <Text style={styles.countNumber}>{days}</Text>

          <Text style={styles.countText}>
            {days === 0
              ? "Today's the day"
              : days === 1
                ? "day until you see each other"
                : "days until you see each other"}
          </Text>
        </Card>
      ) : null}

      <GroupHeader>Next time you meet</GroupHeader>

      <Group>
        <DateInput
          value={meet}
          onChangeText={setMeet}
          placeholder="YYYY-MM-DD"
          style={styles.field}
        />
      </Group>

      <GroupFooter>
        It shows on both your Home screens as a countdown.
      </GroupFooter>

      <Button
        title="Save the Date"
        onPress={() => saveMeet(meet.trim())}
        busy={saving}
        disabled={!meet.trim()}
      />

      {data?.next_meet ? (
        <Button title="Clear It" kind="plain" onPress={() => saveMeet("")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  clocks: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
  },

  clock: {
    flex: 1,
    marginHorizontal: 0,
    alignItems: "center",
    paddingVertical: 18,
  },

  clockWho: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
  },

  clockTime: {
    fontFamily: "ui-rounded",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    marginTop: 4,
  },

  clockPlace: {
    fontSize: 13,
    color: T.label2,
    marginTop: 2,
    textAlign: "center",
  },

  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  countNumber: {
    fontFamily: "ui-rounded",
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "700",
    letterSpacing: -1.6,
    color: T.you,
  },

  countText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: T.label,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
});
