import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { useIsConnected } from "../lib/connection";
import { useDuel } from "../lib/useDuel";
import { T, themedStyles, useTheme } from "../lib/theme";
import { Button, GlassButton, Notice } from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import Celebration from "../components/Celebration";

/*
 * ==========================================
 * ZOMBIE RUSH
 * ==========================================
 *
 * Zombies shamble down towards you. Tap them before they
 * reach the barricade: walkers go down in one tap, runners
 * are quicker, brutes take three. Three hearts, 45 seconds.
 *
 * The server writes one wave per match and you each play it
 * once, whenever you like, so it is the same horde for both
 * of you and nobody waits on the other mid-game. Higher score
 * wins.
 */

const FACE = { walker: "🧟", runner: "🧟‍♀️", brute: "🧌" };
const SIZE = { walker: 40, runner: 36, brute: 58 };
const TICK_MS = 33;

const tap = (style) => Haptics.impactAsync(style).catch(() => {});

export default function ZombiesScreen() {
  useTheme();

  const router = useRouter();
  const connected = useIsConnected();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const { duel, score, partnerName, loading, busy, error, start, move } =
    useDuel("zombies", {
      waitingOnThem: (current) => current.played?.you && !current.played?.them,
    });

  /* "ready" → "countdown" → "running" → "sending" → back to the match. */
  const [phase, setPhase] = useState("ready");
  const [count, setCount] = useState(3);
  const [, setFrame] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const endCelebrate = useCallback(() => setCelebrate(false), []);

  /* The run itself lives in a ref: it changes thirty times a second. */
  const run = useRef(null);
  const loop = useRef(null);

  const arenaW = screenW - 32;
  const arenaH = Math.min(
    Math.round(screenH * 0.58),
    Math.round(arenaW * 1.45),
  );

  const stopLoop = () => {
    if (loop.current) clearInterval(loop.current);
    loop.current = null;
  };

  const finish = useCallback(
    async (reason) => {
      const current = run.current;

      if (!current || current.done) return;

      current.done = true;
      current.reason = reason;
      stopLoop();
      setFrame((n) => n + 1);

      Haptics.notificationAsync(
        reason === "time"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});

      setPhase("sending");
      const after = await move({ score: current.score, kills: current.kills });
      setPhase("ready");

      if (after && after.status !== "playing" && after.winner === "you") {
        setCelebrate(true);
      }
    },
    [move],
  );

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const step = useCallback(() => {
    const current = run.current;

    if (!current || current.done) return;

    const elapsed = Date.now() - current.began;

    /* New arrivals. */
    while (
      current.next < current.wave.length &&
      current.wave[current.next].t <= elapsed
    ) {
      const z = current.wave[current.next];
      current.alive.push({ ...z, hp: current.kinds[z.kind].hp, y: 0 });
      current.next += 1;
    }

    /* Everyone shuffles forward; anyone at the barricade costs a heart. */
    current.alive = current.alive.filter((z) => {
      z.y = ((elapsed - z.t) / 1000) * z.speed;

      if (z.y < 1) return true;

      current.hearts -= 1;
      current.hurtAt = Date.now();
      tap(Haptics.ImpactFeedbackStyle.Heavy);
      return false;
    });

    current.splats = current.splats.filter((s) => Date.now() - s.at < 450);

    if (current.hearts <= 0) {
      finishRef.current("hearts");
      return;
    }

    if (elapsed >= current.duration) {
      finishRef.current("time");
      return;
    }

    setFrame((n) => n + 1);
  }, []);

  const hit = (id) => {
    const current = run.current;

    if (!current || current.done) return;

    const z = current.alive.find((item) => item.id === id);

    if (!z) return;

    z.hp -= 1;

    if (z.hp > 0) {
      z.hitAt = Date.now();
      tap(Haptics.ImpactFeedbackStyle.Medium);
      setFrame((n) => n + 1);
      return;
    }

    current.alive = current.alive.filter((item) => item.id !== id);
    current.score += current.kinds[z.kind].points;
    current.kills += 1;
    current.splats.push({
      id: `${id}-${Date.now()}`,
      x: z.x,
      y: z.y,
      points: current.kinds[z.kind].points,
      at: Date.now(),
    });
    tap(
      z.kind === "brute"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light,
    );
    setFrame((n) => n + 1);
  };

  /* 3, 2, 1, then go. */
  const begin = () => {
    if (!duel) return;

    run.current = {
      wave: duel.wave,
      kinds: duel.kinds,
      duration: duel.duration,
      hearts: duel.hearts,
      score: 0,
      kills: 0,
      next: 0,
      alive: [],
      splats: [],
      began: 0,
      done: false,
    };

    setCount(3);
    setPhase("countdown");
    tap(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    if (phase !== "countdown") return undefined;

    if (count === 0) {
      run.current.began = Date.now();
      setPhase("running");
      loop.current = setInterval(step, TICK_MS);
      return undefined;
    }

    const timer = setTimeout(() => {
      setCount((n) => n - 1);
      tap(Haptics.ImpactFeedbackStyle.Light);
    }, 750);

    return () => clearTimeout(timer);
  }, [phase, count, step]);

  /* Leaving the app mid-run ends it with what you have. */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (
        next !== "active" &&
        run.current &&
        !run.current.done &&
        phase === "running"
      ) {
        finishRef.current("left");
      }
    });

    return () => sub.remove();
  }, [phase]);

  useEffect(() => () => stopLoop(), []);

  if (connected === false) {
    return <ConnectFirst feature="Zombie Rush" showBack />;
  }

  const goBack = () => {
    if (phase === "running" || phase === "countdown") return;
    if (router.canGoBack()) router.back();
    else router.replace("/games");
  };

  const challenge = async () => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    await start();
  };

  const playing = duel?.status === "playing";
  const over = duel && !playing;
  const myTurn = playing && !duel.played?.you;
  const inRun = phase === "countdown" || phase === "running";
  const current = run.current;

  /* ---------- the arena ---------- */

  const arena = () => {
    const left = current
      ? Math.max(0, current.duration - (Date.now() - current.began))
      : 0;
    const hurt = current?.hurtAt && Date.now() - current.hurtAt < 250;

    return (
      <View>
        <View style={styles.hud}>
          <Text style={styles.hearts}>
            {"❤️".repeat(Math.max(0, current?.hearts ?? 0))}
            {"🖤".repeat(
              Math.max(0, (duel?.hearts ?? 3) - (current?.hearts ?? 0)),
            )}
          </Text>

          <Text style={styles.hudScore}>{current?.score ?? 0}</Text>

          <Text style={styles.hudTime}>
            {phase === "running" ? `${Math.ceil(left / 1000)}s` : ""}
          </Text>
        </View>

        <LinearGradient
          colors={["#0B1410", "#15281C", "#24402B"]}
          style={[
            styles.arena,
            { width: arenaW, height: arenaH },
            hurt && styles.arenaHurt,
          ]}
        >
          {(current?.alive || []).map((z) => {
            const size = SIZE[z.kind];
            const flinch = z.hitAt && Date.now() - z.hitAt < 120;

            return (
              <Pressable
                key={z.id}
                onPressIn={() => hit(z.id)}
                hitSlop={10}
                style={[
                  styles.zombie,
                  {
                    left: z.x * arenaW - size / 2,
                    top: z.y * (arenaH - size),
                    width: size,
                    height: size,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Zombie, ${z.kind}`}
              >
                <Text
                  style={{
                    fontSize: size * 0.85,
                    opacity: flinch ? 0.5 : 1,
                    transform: [{ scale: flinch ? 0.9 : 1 }],
                  }}
                >
                  {FACE[z.kind]}
                </Text>

                {z.kind === "brute" ? (
                  <View style={styles.hp}>
                    {Array.from({ length: duel.kinds.brute.hp }).map((_, i) => (
                      <View
                        key={i}
                        style={[styles.hpPip, i < z.hp && styles.hpPipOn]}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {(current?.splats || []).map((s) => {
            const age = (Date.now() - s.at) / 450;

            return (
              <View
                key={s.id}
                pointerEvents="none"
                style={[
                  styles.splat,
                  {
                    left: s.x * arenaW - 24,
                    top: s.y * (arenaH - 40) - age * 30,
                    opacity: 1 - age,
                  },
                ]}
              >
                <Text style={styles.splatBoom}>💥</Text>
                <Text style={styles.splatPoints}>+{s.points}</Text>
              </View>
            );
          })}

          {/* The barricade you are holding. */}
          <View style={styles.barricade} pointerEvents="none">
            <Text style={styles.barricadeText}>🧱🧱🧱🧱🧱🧱🧱🧱🧱</Text>
          </View>

          {phase === "countdown" ? (
            <View style={styles.countWrap} pointerEvents="none">
              <Text style={styles.count}>{count > 0 ? count : "GO!"}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    );
  };

  /* ---------- the match, outside a run ---------- */

  const scoreCard = (who, value, kills, mine) => (
    <View style={[styles.card, mine ? styles.cardYou : styles.cardThem]}>
      <Text style={styles.cardWho} numberOfLines={1}>
        {who}
      </Text>
      <Text style={styles.cardScore}>{value ?? "—"}</Text>
      <Text style={styles.cardKills}>
        {value === null || value === undefined
          ? "Not played yet"
          : `${kills} zombies down`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.nav}>
        <GlassButton
          icon="back"
          label="Back"
          onPress={goBack}
          disabled={inRun}
        />

        <Text style={styles.navTitle}>Zombie Rush</Text>

        <View style={styles.scoreChip}>
          <Text style={styles.scoreText}>
            {score.you}–{score.them}
          </Text>
        </View>
      </View>

      {inRun ? (
        <View style={styles.runWrap}>{arena()}</View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading && !duel ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 60 }} />
          ) : !duel ? (
            <View style={styles.intro}>
              <Text style={styles.introEmoji}>🧟</Text>
              <Text style={styles.introTitle}>Hold the barricade</Text>
              <Text style={styles.introText}>
                Zombies shamble towards you. Tap them before they reach the
                wall. Walkers take one tap, runners are quick, and the big
                brutes 🧌 take three. Three hearts, 45 seconds.
              </Text>
              <Text style={styles.introText}>
                You each face the same horde, whenever you like. Highest score
                wins.
              </Text>
              {/* Full width of the card: in a centred column a
                  stretching native button has no width to stop at. */}
              <Button
                title={`Challenge ${partnerName}`}
                onPress={challenge}
                busy={busy}
                style={styles.introButton}
              />

              <Notice>{error}</Notice>
            </View>
          ) : (
            <>
              <View style={styles.cards}>
                {scoreCard("You", duel.scores.you, duel.kills.you, true)}
                {scoreCard(
                  partnerName,
                  duel.scores.them,
                  duel.kills.them,
                  false,
                )}
              </View>

              {over ? (
                <Text style={styles.result}>
                  {duel.winner === "you"
                    ? "You survived the longest! 🏆"
                    : duel.winner === "them"
                      ? `${partnerName} held the wall better this time`
                      : "A dead heat 🧟"}
                </Text>
              ) : myTurn ? (
                <View style={styles.readyCard}>
                  <Text style={styles.readyTitle}>
                    {duel.played.them
                      ? `Beat ${duel.scores.them} 🎯`
                      : "Your run"}
                  </Text>
                  <Text style={styles.readyText}>
                    Tap the zombies before they reach the wall. One go only, 45
                    seconds, three hearts. Ready when you are.
                  </Text>
                </View>
              ) : (
                <View style={styles.readyCard}>
                  <Text style={styles.readyTitle}>
                    You scored {duel.scores.you}
                  </Text>
                  <Text style={styles.readyText}>
                    Waiting for {partnerName} to face the same horde. You'll
                    hear when they have.
                  </Text>
                </View>
              )}

              <Notice>{error}</Notice>
            </>
          )}
        </ScrollView>
      )}

      {duel && !inRun ? (
        <View style={styles.footer}>
          {phase === "sending" ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.waitingText}>Counting the bodies…</Text>
            </View>
          ) : over ? (
            <Button
              title="Rematch"
              icon="undo"
              onPress={challenge}
              busy={busy}
            />
          ) : myTurn ? (
            <Button title="Start the run" icon="bolt" onPress={begin} />
          ) : (
            <View style={styles.waiting}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.waitingText}>
                {partnerName} hasn't played yet…
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <Celebration
        visible={celebrate}
        title="You won"
        message={`Zombie Rush, against ${partnerName}.`}
        onDone={endCelebrate}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    minHeight: 52,
  },

  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: T.label,
  },

  scoreChip: {
    minWidth: 52,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  scoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: T.label,
    fontVariant: ["tabular-nums"],
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },

  runWrap: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },

  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  hearts: {
    fontSize: 18,
    minWidth: 80,
  },

  hudScore: {
    fontSize: 28,
    fontWeight: "800",
    color: T.label,
    fontVariant: ["tabular-nums"],
  },

  hudTime: {
    minWidth: 80,
    textAlign: "right",
    fontSize: 17,
    fontWeight: "700",
    color: T.label2,
    fontVariant: ["tabular-nums"],
  },

  arena: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "transparent",
  },

  arenaHurt: {
    borderColor: "#FF453A",
  },

  zombie: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  hp: {
    position: "absolute",
    top: -6,
    flexDirection: "row",
    gap: 3,
  },

  hpPip: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  hpPipOn: {
    backgroundColor: "#FF453A",
  },

  splat: {
    position: "absolute",
    width: 48,
    alignItems: "center",
  },

  splatBoom: {
    fontSize: 30,
  },

  splatPoints: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFD54A",
  },

  barricade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  barricadeText: {
    fontSize: 16,
    letterSpacing: 2,
  },

  countWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  count: {
    fontSize: 72,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  intro: {
    alignItems: "center",
    gap: 14,
    paddingTop: 40,
  },

  introButton: {
    alignSelf: "stretch",
    marginHorizontal: 0,
  },

  introEmoji: {
    fontSize: 64,
  },

  introTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: T.label,
  },

  introText: {
    fontSize: 16,
    lineHeight: 22,
    color: T.label2,
    textAlign: "center",
  },

  cards: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },

  card: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: 20,
    gap: 2,
  },

  cardYou: {
    backgroundColor: T.youTint,
  },

  cardThem: {
    backgroundColor: T.accentTint,
  },

  cardWho: {
    fontSize: 14,
    fontWeight: "600",
    color: T.label2,
  },

  cardScore: {
    fontSize: 36,
    fontWeight: "800",
    color: T.label,
    fontVariant: ["tabular-nums"],
  },

  cardKills: {
    fontSize: 13,
    color: T.label2,
  },

  result: {
    fontSize: 20,
    fontWeight: "800",
    color: T.label,
    textAlign: "center",
  },

  readyCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: T.surface,
    gap: 6,
  },

  readyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: T.label,
  },

  readyText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 50,
  },

  waitingText: {
    fontSize: 15,
    color: T.label2,
  },
}));
