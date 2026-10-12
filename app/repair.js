import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Avatar,
  Button,
  Card,
  Cell,
  Chip,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  Press,
  SheetHeader,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * REPAIR
 * ==========================================
 *
 * For after a row.
 *
 * Three ideas, all borrowed from how couples actually
 * come back together:
 *
 *   A pause first. Nothing useful is said in the
 *   first twenty minutes, so the app holds the door
 *   shut and says when it opens.
 *
 *   Each writes their own side -- what I felt, what I
 *   needed, what I am sorry for -- and neither sees
 *   the other's until both have written. Sealed, for
 *   the same reason the nightly question is sealed:
 *   so one answer doesn't shape the other.
 *
 *   Then one line you both agree on, and it closes.
 *
 * It never takes a side and never says who was right.
 */

const TOPICS = [
  "Something I said",
  "Something you said",
  "Feeling unheard",
  "Plans",
  "Money",
  "Family",
  "Nothing in particular",
];

const PAUSES = [
  { label: "20 minutes", minutes: 20 },
  { label: "An hour", minutes: 60 },
  { label: "Tonight", minutes: 240 },
];

function timeLeft(until) {
  if (!until) return 0;

  return Math.max(0, new Date(until).getTime() - Date.now());
}

function pauseLabel(ms) {
  const minutes = Math.ceil(ms / 60000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);

    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export default function RepairScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [topic, setTopic] = useState(null);
  const [pause, setPause] = useState(PAUSES[0]);

  const [felt, setFelt] = useState("");
  const [needed, setNeeded] = useState("");
  const [sorry, setSorry] = useState("");
  const [agreement, setAgreement] = useState("");

  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/repair`);
      const data = await response.json();

      setRepair(data?.repair || null);

      if (data?.repair?.your_side) {
        setFelt(data.repair.your_side.felt || "");
        setNeeded(data.repair.your_side.needed || "");
        setSorry(data.repair.your_side.sorry_for || "");
      }
    } catch (err) {
      console.log("REPAIR LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /* Count the pause down while the screen is open. */
  useEffect(() => {
    if (!repair?.cool_until) return;

    const timer = setInterval(() => setTick((value) => value + 1), 1000);

    return () => clearInterval(timer);
  }, [repair?.cool_until]);

  const start = async () => {
    try {
      setBusy(true);

      const response = await apiFetch(`/users/${userId}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, cool_minutes: pause.minutes }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to start.");

      await load();
    } catch (err) {
      Alert.alert("We couldn't start that", err?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveSide = async () => {
    if (!felt.trim() && !needed.trim() && !sorry.trim()) return;

    try {
      setBusy(true);

      const response = await apiFetch(`/users/${userId}/repair`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          felt: felt.trim(),
          needed: needed.trim(),
          sorry_for: sorry.trim(),
        }),
      });

      if (!response.ok) throw new Error("Unable to save your side.");

      await load();
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    try {
      setBusy(true);

      await apiFetch(`/users/${userId}/repair`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close: true, agreement: agreement.trim() }),
      });

      setRepair(null);
      setFelt("");
      setNeeded("");
      setSorry("");
      setAgreement("");

      router.back();
    } catch (err) {
      Alert.alert("We couldn't close that", err?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Repair" showBack={true} />;
  }

  const remaining = timeLeft(repair?.cool_until);
  const cooling = remaining > 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SheetHeader
          onClose={() => router.back()}
          closeIcon="chevronDown"
          title="Repair"
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <SkeletonList count={3} />
          ) : !repair ? (
            /* ---------- nothing open ---------- */
            <>
              <Text style={styles.kicker}>When it's gone wrong</Text>

              <Text style={styles.title}>Let&apos;s sort it out</Text>

              <Text style={styles.lede}>
                Take a pause first. Then you each write your own side, and
                neither of you sees the other&apos;s until you both have.
              </Text>

              <GroupHeader>What happened?</GroupHeader>

              <View style={styles.topics}>
                {TOPICS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={topic === item}
                    onPress={() => setTopic(topic === item ? null : item)}
                  />
                ))}
              </View>

              <GroupHeader>Pause for</GroupHeader>

              <Group inset={16}>
                {PAUSES.map((item) => (
                  <Cell
                    key={item.label}
                    title={item.label}
                    trailing={
                      pause.minutes === item.minutes ? (
                        <Icon name="check" size={18} color={T.accent} />
                      ) : null
                    }
                    onPress={() => setPause(item)}
                  />
                ))}
              </Group>

              <GroupFooter>
                They&apos;ll be told you want to sort things out, and that
                neither of you writes anything until the pause is over.
              </GroupFooter>

              <Button title="Start a Repair" onPress={start} busy={busy} />
            </>
          ) : cooling ? (
            /* ---------- the pause ---------- */
            <>
              <View style={styles.pauseRing}>
                <Icon name="clock" size={30} color={T.accent} />
              </View>

              <Text style={[styles.title, styles.centre]}>
                {pauseLabel(remaining)} left
              </Text>

              <Text style={[styles.lede, styles.centre]}>
                {repair.started_by_me
                  ? "You asked for a pause. Put the phone down; it will still be here."
                  : "They asked for a pause. Nothing to answer yet."}
              </Text>

              {repair.topic ? (
                <Group inset={16}>
                  <Cell title="About" value={repair.topic} />
                </Group>
              ) : null}

              <Card>
                <Text style={styles.tipTitle}>While you wait</Text>

                <Text style={styles.tipText}>
                  Work out what you actually felt, under the anger. Most rows
                  are one person feeling unimportant and the other feeling
                  accused.
                </Text>
              </Card>
            </>
          ) : !repair.your_side ? (
            /* ---------- write your side ---------- */
            <>
              <Text style={styles.kicker}>Your side</Text>

              <Text style={styles.title}>Only you can see this yet</Text>

              <Text style={styles.lede}>
                It unlocks for both of you the moment you have both written.
              </Text>

              <Card>
                <Text style={styles.label}>What I felt</Text>

                <TextInput
                  value={felt}
                  onChangeText={setFelt}
                  placeholder="I felt…"
                  placeholderTextColor={T.label3}
                  style={styles.input}
                  multiline
                  textAlignVertical="top"
                />
              </Card>

              <Card>
                <Text style={styles.label}>What I needed</Text>

                <TextInput
                  value={needed}
                  onChangeText={setNeeded}
                  placeholder="What would have helped…"
                  placeholderTextColor={T.label3}
                  style={styles.input}
                  multiline
                  textAlignVertical="top"
                />
              </Card>

              <Card>
                <Text style={styles.label}>What I&apos;m sorry for</Text>

                <TextInput
                  value={sorry}
                  onChangeText={setSorry}
                  placeholder="Even a small part of it…"
                  placeholderTextColor={T.label3}
                  style={styles.input}
                  multiline
                  textAlignVertical="top"
                />
              </Card>

              <Button
                title="Seal My Side"
                onPress={saveSide}
                busy={busy}
                disabled={!felt.trim() && !needed.trim() && !sorry.trim()}
              />
            </>
          ) : !repair.both_written ? (
            /* ---------- waiting for them ---------- */
            <>
              <View style={styles.pauseRing}>
                <Icon name="lock" size={28} color={T.accent} />
              </View>

              <Text style={[styles.title, styles.centre]}>Yours is sealed</Text>

              <Text style={[styles.lede, styles.centre]}>
                You&apos;ll both see them together as soon as they write theirs.
                We&apos;ve let them know.
              </Text>

              <Button
                title="Edit What I Wrote"
                kind="tinted"
                onPress={() => setRepair({ ...repair, your_side: null })}
              />
            </>
          ) : (
            /* ---------- both sides, then an agreement ---------- */
            <>
              <Text style={styles.kicker}>Both sides</Text>

              <Text style={styles.title}>Here&apos;s what you each said</Text>

              <Card style={styles.sideYou}>
                <View style={styles.sideHead}>
                  <Avatar name="You" who="you" size={30} />

                  <Text style={styles.sideWho}>You</Text>
                </View>

                <Side side={repair.your_side} />
              </Card>

              <Card style={styles.sideThem}>
                <View style={styles.sideHead}>
                  <Avatar name="Them" who="them" size={30} />

                  <Text style={styles.sideWho}>Them</Text>
                </View>

                <Side side={repair.partner_side} />
              </Card>

              <Card>
                <Text style={styles.label}>What we agree on</Text>

                <TextInput
                  value={agreement}
                  onChangeText={setAgreement}
                  placeholder="One line. What happens next time."
                  placeholderTextColor={T.label3}
                  style={styles.input}
                  multiline
                  textAlignVertical="top"
                />
              </Card>

              <Button title="We're Good" onPress={close} busy={busy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Side({ side }) {
  if (!side) return null;

  return (
    <View style={styles.sideBody}>
      {side.felt ? (
        <View style={styles.sideRow}>
          <Text style={styles.sideLabel}>Felt</Text>

          <Text style={styles.sideText}>{side.felt}</Text>
        </View>
      ) : null}

      {side.needed ? (
        <View style={styles.sideRow}>
          <Text style={styles.sideLabel}>Needed</Text>

          <Text style={styles.sideText}>{side.needed}</Text>
        </View>
      ) : null}

      {side.sorry_for ? (
        <View style={styles.sideRow}>
          <Text style={styles.sideLabel}>Sorry for</Text>

          <Text style={styles.sideText}>{side.sorry_for}</Text>
        </View>
      ) : null}
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: 16,
    paddingBottom: 60,
    gap: 14,
  },

  centre: {
    textAlign: "center",
  },

  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: T.accent,
  },

  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: T.label,
    marginTop: -6,
  },

  lede: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
  },

  topics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 0,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
  },

  input: {
    minHeight: 76,
    fontSize: 16,
    lineHeight: 22,
    color: T.label,
    marginTop: 8,
  },

  pauseRing: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  tipTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  tipText: {
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    marginTop: 6,
  },

  sideYou: {
    backgroundColor: "rgba(217,87,122,0.10)",
  },

  sideThem: {
    backgroundColor: "rgba(74,45,92,0.09)",
  },

  sideHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sideWho: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  sideBody: {
    marginTop: 12,
    gap: 10,
  },

  sideRow: {
    gap: 2,
  },

  sideLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
  },

  sideText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label,
  },
});
