import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import { useDiscardGuard } from "../lib/useDiscardGuard";
import {
  Avatar,
  Button,
  Card,
  GlassButton,
  Group,
  GroupHeader,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * CHECK-IN
 * ==========================================
 *
 * A weekly temperature check. One number each, once a
 * week, is enough to spot a dip early -- and a bad week
 * is far easier to talk about while it is still one bad
 * week.
 *
 *   you        five steps, a line if you want, save
 *   them       their number and line, once they have
 *   the trend  your last weeks as bars
 */

const SCALE = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Off" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export default function CheckInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `checkin:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(cached?.your_checkin?.rating ?? null);
  const [note, setNote] = useState(cached?.your_checkin?.note ?? "");
  const [error, setError] = useState("");

  /*
   * Saving looked identical to not saving: same panel, same
   * button, nothing moved. The answer was going in, but there
   * was no way to know that, so it read as broken.
   */
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await apiFetch(`/users/${userId}/checkin`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to load your check-in.");
      }

      setData(json);
      setRating(json?.your_checkin?.rating ?? null);
      setNote(json?.your_checkin?.note ?? "");

      if (cacheKey) setCachedData(cacheKey, json);
    } catch (err) {
      setError(err?.message || "Unable to load your check-in.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!rating || saving || !userId) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, note: note.trim() || null }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to save your check-in.");
      }

      setData(json);

      if (cacheKey) setCachedData(cacheKey, json);

      setJustSaved(true);

      setTimeout(() => setJustSaved(false), 2600);
    } catch (err) {
      Alert.alert("Something went wrong", err?.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const partnerName = data?.partner_name || "Your partner";
  const mineDone = Boolean(data?.your_checkin);

  /* Your own recent weeks, oldest first, for the trend. */
  const trend = (data?.history || [])
    .filter((h) => h.mine)
    .slice(0, 8)
    .reverse();

  useDiscardGuard(
    note.trim() !== String(data?.your_checkin?.note || "").trim(),
  );

  if (connected === false) {
    return <ConnectFirst feature="Check-in" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  return (
    <Screen keyboard>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Check-in</LargeTitle>

      <SubTitle>How are we doing this week?</SubTitle>

      <Notice>{error}</Notice>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={2} />
        </View>
      ) : (
        <>
          {/* YOU */}

          <Card style={styles.you}>
            <View style={styles.scale}>
              {SCALE.map((step) => {
                const active = rating === step.value;

                return (
                  <Pressable
                    key={step.value}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setRating(step.value);
                    }}
                    style={styles.step}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${step.value}, ${step.label}`}
                  >
                    <View style={[styles.dot, active && styles.dotOn]}>
                      <Text
                        style={[styles.dotText, active && styles.dotTextOn]}
                      >
                        {step.value}
                      </Text>
                    </View>

                    <Text
                      style={[styles.stepLabel, active && styles.stepLabelOn]}
                    >
                      {step.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Group>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything worth saying about it? (optional)"
              placeholderTextColor={T.label3}
              style={styles.field}
              multiline
              textAlignVertical="top"
            />
          </Group>

          <Button
            title={mineDone ? "Update This Week" : "Save This Week"}
            onPress={submit}
            busy={saving}
            disabled={!rating}
          />

          {justSaved ? (
            <Notice tone="info">
              {data?.partner_checkin
                ? `You've both checked in. ${partnerName} said ${data.partner_checkin.rating} of 5.`
                : `Saved. ${partnerName} hasn't checked in yet.`}
            </Notice>
          ) : null}

          {/* THEM */}

          <GroupHeader>{partnerName}</GroupHeader>

          <Card style={styles.them}>
            <Avatar name={partnerName} who="them" size={44} />

            {data?.partner_checkin ? (
              <View style={styles.themBody}>
                <Text style={styles.themRating}>
                  {data.partner_checkin.rating}
                  <Text style={styles.themOutOf}> of 5 · </Text>
                  <Text style={styles.themOutOf}>
                    {SCALE[data.partner_checkin.rating - 1]?.label}
                  </Text>
                </Text>

                {data.partner_checkin.note ? (
                  <Text style={styles.themNote}>
                    {data.partner_checkin.note}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.themWaiting}>
                Hasn&apos;t checked in this week yet.
              </Text>
            )}
          </Card>

          {/* YOUR LAST WEEKS */}

          {trend.length > 1 ? (
            <>
              <GroupHeader>Your last weeks</GroupHeader>

              <Card style={styles.trend}>
                {trend.map((week, index) => (
                  <View key={index} style={styles.trendColumn}>
                    <View
                      style={[
                        styles.trendBar,
                        { height: 10 + week.rating * 14 },
                        index === trend.length - 1 && styles.trendBarNow,
                      ]}
                    />

                    <Text style={styles.trendValue}>{week.rating}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  you: {
    paddingVertical: 18,
  },

  scale: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  step: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  dot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: T.fill3,
    alignItems: "center",
    justifyContent: "center",
  },

  dotOn: {
    backgroundColor: T.accent,
  },

  dotText: {
    fontFamily: "ui-rounded",
    fontSize: 19,
    fontWeight: "700",
    color: T.label2,
  },

  dotTextOn: {
    color: "#FFFFFF",
  },

  stepLabel: {
    fontSize: 12,
    color: T.label2,
  },

  stepLabelOn: {
    color: T.accent,
    fontWeight: "600",
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 92,
  },

  them: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  themBody: {
    flex: 1,
  },

  themRating: {
    fontFamily: "ui-rounded",
    fontSize: 28,
    fontWeight: "700",
    color: T.accent,
  },

  themOutOf: {
    fontFamily: undefined,
    fontSize: 15,
    fontWeight: "500",
    color: T.label2,
  },

  themNote: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label,
    marginTop: 4,
  },

  themWaiting: {
    flex: 1,
    fontSize: 15,
    color: T.label2,
  },

  trend: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingTop: 20,
    minHeight: 120,
  },

  trendColumn: {
    alignItems: "center",
    gap: 6,
  },

  trendBar: {
    width: 18,
    borderRadius: 6,
    backgroundColor: T.accentTint,
  },

  trendBarNow: {
    backgroundColor: T.accent,
  },

  trendValue: {
    fontSize: 12,
    color: T.label2,
  },
});
