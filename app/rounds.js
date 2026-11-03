import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Button,
  Card,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Ring,
  Screen,
  SubTitle,
} from "../components/ui";
import Celebration from "../components/Celebration";
import ConnectFirst from "../components/ConnectFirst";
import ProgressBar from "../components/onboarding/ProgressBar";

/*
 * ==========================================
 * QUICK ROUNDS
 * ==========================================
 *
 * This or That, and Who's More Likely To. Ten prompts,
 * one at a time, a big tap for your answer. Their answers
 * stay hidden until you have both played; then every
 * prompt shows side by side, with a ring for how many you
 * matched on.
 */

const KINDS = {
  this_or_that: {
    title: "This or That",
    intro: "Pick one of each pair. No overthinking.",
  },
  likely: {
    title: "Who's More Likely To",
    intro: "Point at one of you. Be honest.",
  },
};

export default function RoundsScreen() {
  const router = useRouter();
  const { kind: kindParam } = useLocalSearchParams();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const kind = KINDS[kindParam] ? kindParam : "this_or_that";
  const meta = KINDS[kind];

  const [round, setRound] = useState(null);
  const [stats, setStats] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);

  /* Answers being given now, one per prompt. */
  const [answers, setAnswers] = useState(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;

    try {
      const [data, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/rounds?kind=${kind}`).then((r) => r.json()),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      setRound(data.round || null);
      setStats(data.stats || null);
      setPartnerName(
        partnerData?.partner?.nickname?.trim() ||
          partnerData?.partner?.first_name?.trim() ||
          "",
      );
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load the game.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, kind]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const them = partnerName || "Them";

  const endCelebration = useCallback(() => setCelebrating(false), []);

  const start = async () => {
    try {
      setBusy(true);

      const response = await apiFetch(`/users/${userId}/rounds`, {
        method: "POST",
        body: JSON.stringify({ clerk_id: userId, kind }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to start.");

      setRound(data.round);
      setStats(data.stats);

      if (!data.round.mine) setAnswers([]);
    } catch (err) {
      setError(err?.message || "Unable to start.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (value) => {
    Haptics.selectionAsync().catch(() => {});

    const next = [...answers, value];

    if (next.length < round.items.length) {
      setAnswers(next);
      return;
    }

    try {
      setBusy(true);

      const response = await apiFetch(
        `/users/${userId}/rounds/${round.id}/answers`,
        {
          method: "POST",
          body: JSON.stringify({ clerk_id: userId, answers: next }),
        },
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to save.");

      setRound(data.round);
      setStats(data.stats);
      setAnswers(null);

      if (data.round.finished) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});

        if (data.round.matches >= 7) setCelebrating(true);
      }
    } catch (err) {
      setError(err?.message || "Your answers didn't save.");
      setAnswers(next.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature={meta.title} />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/games");
  };

  /* ---------- answering ---------- */

  if (round && answers) {
    const index = answers.length;
    const item = round.items[index];

    return (
      <Screen>
        <NavBar
          left={
            <GlassButton
              icon="close"
              label="Stop"
              onPress={() => setAnswers(null)}
            />
          }
        />

        <View style={styles.progress}>
          <ProgressBar current={index} total={round.items.length} />

          <Text style={styles.count}>
            {index + 1} of {round.items.length}
          </Text>
        </View>

        {kind === "this_or_that" ? (
          <View style={styles.pair}>
            {["a", "b"].map((side) => (
              <Pressable
                key={side}
                onPress={() => pick(side)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.option,
                  side === "a" ? styles.optionA : styles.optionB,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={styles.optionText}>{item[side]}</Text>
              </Pressable>
            ))}

            <View style={styles.or} pointerEvents="none">
              <Text style={styles.orText}>or</Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.prompt}>Who's more likely to {item.text}?</Text>

            <View style={styles.pair}>
              {[
                ["me", "Me"],
                ["you", them],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => pick(value)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.option,
                    value === "me" ? styles.optionMe : styles.optionThem,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text style={styles.optionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Notice>{error}</Notice>
      </Screen>
    );
  }

  /* ---------- the round, and results ---------- */

  return (
    <>
      <Screen>
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        />

        <LargeTitle>{meta.title}</LargeTitle>

        <SubTitle>{meta.intro}</SubTitle>

        <Notice>{error}</Notice>

        {loading ? null : !round || round.finished ? (
          <>
            {round?.finished ? (
              <Card style={styles.result}>
                <Ring
                  value={round.matches / 10}
                  size={96}
                  label={`${round.matches}/10`}
                />

                <Text style={styles.resultTitle}>
                  {round.matches >= 8
                    ? "Practically the same person"
                    : round.matches >= 5
                      ? "Nicely in sync"
                      : "Opposites, in the best way"}
                </Text>

                {stats?.played > 1 ? (
                  <Text style={styles.resultText}>
                    {stats.played} rounds played · {stats.average}% matched
                  </Text>
                ) : null}
              </Card>
            ) : null}

            <Button
              title={round ? "Play Another Round" : "Start a Round"}
              icon="sparkle"
              onPress={start}
              busy={busy}
            />

            {round?.finished ? (
              <>
                <GroupHeader>How you answered</GroupHeader>

                <Group>
                  {round.items.map((item, index) => {
                    const mine = round.mine[index];
                    const theirs = round.theirs[index];

                    const matched =
                      kind === "likely" ? mine !== theirs : mine === theirs;

                    const label =
                      kind === "likely" ? item.text : `${item.a} or ${item.b}`;

                    const show = (value, own) =>
                      kind === "likely"
                        ? (value === "me") === own
                          ? "You"
                          : them
                        : item[value];

                    return (
                      <View key={index} style={styles.answerRow}>
                        <Icon
                          name={matched ? "checkCircle" : "close"}
                          size={18}
                          color={matched ? T.green : T.label3}
                        />

                        <View style={styles.answerText}>
                          <Text style={styles.answerLabel}>
                            {kind === "likely"
                              ? `More likely to ${label}`
                              : label}
                          </Text>

                          <Text style={styles.answerPicks}>
                            <Text style={{ color: T.youText }}>
                              You: {show(mine, true)}
                            </Text>
                            {"  ·  "}
                            <Text style={{ color: T.accent }}>
                              {them}: {show(theirs, false)}
                            </Text>
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </Group>
              </>
            ) : null}
          </>
        ) : round.mine ? (
          <Card style={styles.waiting}>
            <Icon name="clock" size={22} color={T.accent} />

            <Text style={styles.waitingTitle}>Waiting for {them}</Text>

            <Text style={styles.resultText}>
              Your answers are in and hidden. You'll both see them once {them}{" "}
              plays.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.waiting}>
              <Icon name="sparkle" size={22} color={T.you} />

              <Text style={styles.waitingTitle}>
                {round.they_answered
                  ? `${them} has played`
                  : "A round is ready"}
              </Text>

              <Text style={styles.resultText}>
                {round.they_answered
                  ? "Play yours to see how you matched."
                  : "Play yours. They'll get a nudge to play theirs."}
              </Text>
            </Card>

            <Button title="Play Your Ten" onPress={() => setAnswers([])} />
          </>
        )}

        <GroupFooter>
          Every round has ten fresh prompts. Answers stay hidden until you have
          both played.
        </GroupFooter>
      </Screen>

      <Celebration
        visible={celebrating}
        title="So in sync"
        message={`${round?.matches ?? 0} out of 10 with ${them}.`}
        onDone={endCelebration}
      />
    </>
  );
}

const styles = StyleSheet.create({
  progress: {
    paddingHorizontal: 20,
    gap: 8,
  },

  count: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
    textAlign: "center",
  },

  prompt: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: T.label,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 12,
  },

  pair: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },

  option: {
    minHeight: 120,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  optionA: {
    backgroundColor: T.you,
  },

  optionB: {
    backgroundColor: T.accent,
  },

  optionMe: {
    backgroundColor: T.you,
  },

  optionThem: {
    backgroundColor: T.accent,
  },

  optionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  optionText: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#FFFFFF",
    textAlign: "center",
  },

  or: {
    position: "absolute",
    alignSelf: "center",
    top: 120 - 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  orText: {
    fontSize: 14,
    fontWeight: "700",
    color: T.label2,
  },

  result: {
    alignItems: "center",
    paddingVertical: 24,
  },

  resultTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: T.label,
    marginTop: 16,
    textAlign: "center",
  },

  resultText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    marginTop: 6,
    textAlign: "center",
  },

  waiting: {
    alignItems: "center",
    paddingVertical: 24,
  },

  waitingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: T.label,
    marginTop: 10,
  },

  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  answerText: {
    flex: 1,
  },

  answerLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  answerPicks: {
    fontSize: 14,
    marginTop: 3,
  },
});
