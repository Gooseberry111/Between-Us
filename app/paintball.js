import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
 * PAINTBALL STANDOFF
 * ==========================================
 *
 * Five bits of cover across the field. Each round you both
 * pick, in secret, where to hide and where to fire; once
 * you have both locked in, the paint flies and the round
 * plays out on both phones. Three lives each.
 *
 *   you can't hide in the same spot twice running
 *   💣 paint grenade, once a match: splashes either side too
 *   🛡️ shield, once a match: stops one hit
 */

const COVER_EMOJI = ["📦", "🪖", "🌳", "🧱", "🛢️"];
const LIVES = 3;

const tap = (style) => Haptics.impactAsync(style).catch(() => {});

function Lives({ count, colour }) {
  useTheme();

  return (
    <View style={styles.lives}>
      {Array.from({ length: LIVES }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.life,
            {
              backgroundColor: index < count ? colour : "transparent",
              borderColor: colour,
            },
          ]}
        />
      ))}
    </View>
  );
}

/* A splash of paint that bursts onto a spot. */
function Splat({ colour, play, delay = 0 }) {
  useTheme();

  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!play) return;

    grow.setValue(0);
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(grow, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [play, delay, grow]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.splat,
        {
          backgroundColor: colour,
          opacity: grow.interpolate({
            inputRange: [0, 0.1, 1],
            outputRange: [0, 0.9, 0.82],
          }),
          transform: [
            {
              scale: grow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 1],
              }),
            },
            { rotate: `${(delay * 7) % 360}deg` },
          ],
        },
      ]}
    >
      <View style={[styles.drip, styles.dripA, { backgroundColor: colour }]} />
      <View style={[styles.drip, styles.dripB, { backgroundColor: colour }]} />
      <View style={[styles.drip, styles.dripC, { backgroundColor: colour }]} />
    </Animated.View>
  );
}

export default function PaintballScreen() {
  useTheme();

  const router = useRouter();
  const connected = useIsConnected();

  const { duel, score, partnerName, loading, busy, error, start, move } =
    useDuel("paintball", {
      waitingOnThem: (current) => current.you_locked,
    });

  const [hide, setHide] = useState(null);
  const [shoot, setShoot] = useState(null);
  const [gear, setGear] = useState(null);

  /* The round that just played, shown until you carry on. */
  const [replay, setReplay] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const seenRounds = useRef(null);

  /* Stable, so the confetti is not restarted by a re-render. */
  const endCelebrate = useCallback(() => setCelebrate(false), []);

  useEffect(() => {
    if (!duel) return;

    const played = duel.history?.length || 0;

    if (seenRounds.current === null || seenRounds.current.id !== duel.id) {
      seenRounds.current = { id: duel.id, played };
      return;
    }

    if (played > seenRounds.current.played) {
      const last = duel.history[played - 1];

      seenRounds.current = { id: duel.id, played };
      setReplay(last);
      setHide(null);
      setShoot(null);
      setGear(null);

      if (last.hit.them && !last.hit.you) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else if (last.hit.you) {
        tap(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        tap(Haptics.ImpactFeedbackStyle.Light);
      }

      if (duel.status !== "playing" && duel.winner === "you")
        setCelebrate(true);
    }
  }, [duel]);

  if (connected === false) {
    return <ConnectFirst feature="Paintball Standoff" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/games");
  };

  const playing = duel?.status === "playing";
  const over = duel && !playing;

  const lockIn = async () => {
    if (hide === null || shoot === null) return;

    tap(Haptics.ImpactFeedbackStyle.Medium);
    await move({ hide, shoot, gear });
  };

  const challenge = async () => {
    setReplay(null);
    setHide(null);
    setShoot(null);
    setGear(null);
    seenRounds.current = null;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    await start();
  };

  /* ---------- what each spot shows ---------- */

  const cover = duel?.cover || ["Crates", "Bunker", "Tree", "Wall", "Barrel"];

  const reaches = (shot) =>
    shot
      ? shot.gear === "grenade"
        ? [shot.shoot - 1, shot.shoot, shot.shoot + 1]
        : [shot.shoot]
      : [];

  const spot = (index) => {
    if (replay) {
      return {
        you: replay.you.hide === index,
        them: replay.them.hide === index,
        yourPaint: reaches(replay.you).includes(index),
        theirPaint: reaches(replay.them).includes(index),
      };
    }

    return {
      you: hide === index,
      aim:
        shoot === index ||
        (gear === "grenade" && shoot !== null && Math.abs(shoot - index) === 1),
      blocked: duel?.last_hide === index,
    };
  };

  const roundLine = () => {
    if (!replay) return null;

    const { hit, blocked } = replay;

    if (hit.you && hit.them)
      return { title: "Both tagged! 💥", text: "You each lose a life." };
    if (hit.them)
      return {
        title: "You tagged them! 🎯",
        text: `${partnerName} loses a life.`,
      };
    if (hit.you)
      return {
        title: "You got hit 💥",
        text: `${partnerName} found you behind the ${cover[replay.you.hide]}.`,
      };
    if (blocked.you)
      return { title: "Shield up! 🛡️", text: "Their shot bounced off." };
    if (blocked.them)
      return { title: "Blocked 🛡️", text: `${partnerName} had a shield.` };
    return { title: "Both missed", text: "Paint everywhere, nobody tagged." };
  };

  const line = roundLine();

  const step = !playing
    ? null
    : duel.you_locked
      ? "waiting"
      : hide === null
        ? "hide"
        : "aim";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.nav}>
        <GlassButton icon="back" label="Back" onPress={goBack} />

        <Text style={styles.navTitle}>Paintball Standoff</Text>

        <View style={styles.scoreChip}>
          <Text style={styles.scoreText}>
            {score.you}–{score.them}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && !duel ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 60 }} />
        ) : !duel ? (
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>🎯</Text>

            <Text style={styles.introTitle}>Hide. Aim. Fire.</Text>

            <Text style={styles.introText}>
              Five spots of cover. Each round you both pick, in secret, where to
              hide and where to shoot. When you've both locked in, the paint
              flies. Three lives each. You can't hide in the same place twice
              running.
            </Text>

            <Text style={styles.introText}>
              💣 One paint grenade a match: it splashes the spots either side
              too.{"\n"}🛡️ One shield a match: it stops a hit.
            </Text>

            <Button
              title={`Challenge ${partnerName}`}
              onPress={challenge}
              busy={busy}
            />
          </View>
        ) : (
          <>
            {/* LIVES */}
            <View style={styles.board}>
              <View style={styles.side}>
                <Text style={styles.who}>You</Text>
                <Lives count={duel.lives.you} colour={T.you} />
              </View>

              <Text style={styles.round}>
                {over ? "Final" : `Round ${duel.round}`}
              </Text>

              <View style={[styles.side, styles.sideEnd]}>
                <Text style={styles.who} numberOfLines={1}>
                  {partnerName}
                </Text>
                <Lives count={duel.lives.them} colour={T.accent} />
              </View>
            </View>

            {/* THE FIELD */}
            <LinearGradient
              colors={["#2F4A2B", "#3E5E33", "#4C6B3A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.field}
            >
              <Text style={styles.fieldLabel}>
                {replay
                  ? `Round ${replay.round}`
                  : step === "hide"
                    ? "Where will you hide?"
                    : step === "aim"
                      ? "Where will you fire?"
                      : step === "waiting"
                        ? `Locked in. Waiting for ${partnerName}…`
                        : over
                          ? "Match over"
                          : ""}
              </Text>

              <View style={styles.spots}>
                {cover.map((name, index) => {
                  const s = spot(index);
                  const pickable = playing && !replay && !duel.you_locked;
                  const disabled = pickable && step === "hide" && s.blocked;

                  return (
                    <Pressable
                      key={name}
                      disabled={!pickable || disabled}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        if (step === "hide") setHide(index);
                        else setShoot(index);
                      }}
                      style={({ pressed }) => [
                        styles.spot,
                        s.you && styles.spotYou,
                        s.aim && styles.spotAim,
                        disabled && styles.spotOff,
                        pressed && styles.spotPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={name}
                    >
                      <Text style={styles.spotEmoji}>{COVER_EMOJI[index]}</Text>
                      <Text style={styles.spotName} numberOfLines={1}>
                        {name}
                      </Text>

                      {s.you ? (
                        <View style={[styles.marker, styles.markerYou]} />
                      ) : null}
                      {s.them ? (
                        <View style={[styles.marker, styles.markerThem]} />
                      ) : null}
                      {s.aim ? <Text style={styles.crosshair}>⌖</Text> : null}

                      {s.yourPaint ? (
                        <Splat colour={T.you} play delay={index * 60} />
                      ) : null}
                      {s.theirPaint ? (
                        <Splat
                          colour={T.accent}
                          play
                          delay={180 + index * 60}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {replay ? (
                <View style={styles.legend}>
                  <View style={[styles.dot, { backgroundColor: T.you }]} />
                  <Text style={styles.legendText}>You</Text>
                  <View style={[styles.dot, { backgroundColor: T.accent }]} />
                  <Text style={styles.legendText}>{partnerName}</Text>
                </View>
              ) : null}
            </LinearGradient>

            {/* WHAT HAPPENED */}
            {line ? (
              <View style={styles.result}>
                <Text style={styles.resultTitle}>{line.title}</Text>
                <Text style={styles.resultText}>{line.text}</Text>
              </View>
            ) : null}

            {over && !replay ? (
              <View style={styles.result}>
                <Text style={styles.resultTitle}>
                  {duel.winner === "you"
                    ? "You won the standoff! 🏆"
                    : duel.winner === "them"
                      ? `${partnerName} won this one`
                      : "A draw. Both out at once!"}
                </Text>
              </View>
            ) : null}

            {/* GEAR */}
            {playing && !replay && !duel.you_locked && hide !== null ? (
              <View style={styles.gearRow}>
                {[
                  {
                    key: "grenade",
                    emoji: "💣",
                    label: "Grenade",
                    hint: "Splash either side",
                  },
                  {
                    key: "shield",
                    emoji: "🛡️",
                    label: "Shield",
                    hint: "Stop one hit",
                  },
                ].map((item) => {
                  const left = duel.gear.you[item.key];
                  const on = gear === item.key;

                  return (
                    <Pressable
                      key={item.key}
                      disabled={!left}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setGear(on ? null : item.key);
                      }}
                      style={[
                        styles.gear,
                        on && styles.gearOn,
                        !left && styles.gearOff,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on, disabled: !left }}
                    >
                      <Text style={styles.gearEmoji}>{item.emoji}</Text>
                      <View>
                        <Text
                          style={[styles.gearLabel, on && styles.gearLabelOn]}
                        >
                          {item.label} {left ? "×1" : "used"}
                        </Text>
                        <Text
                          style={[styles.gearHint, on && styles.gearLabelOn]}
                        >
                          {item.hint}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Notice>{error}</Notice>
          </>
        )}
      </ScrollView>

      {duel ? (
        <View style={styles.footer}>
          {replay ? (
            <Button
              title={over ? "See the result" : "Next round"}
              onPress={() => setReplay(null)}
            />
          ) : over ? (
            <Button
              title="Rematch"
              icon="undo"
              onPress={challenge}
              busy={busy}
            />
          ) : step === "waiting" ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.waitingText}>
                {duel.them_locked ? "Firing…" : `${partnerName} is choosing…`}
              </Text>
            </View>
          ) : step === "aim" ? (
            <View style={styles.footerRow}>
              <Button
                title="Move"
                kind="gray"
                block={false}
                onPress={() => {
                  setHide(null);
                  setShoot(null);
                }}
              />
              <View style={{ flex: 1 }}>
                <Button
                  title={shoot === null ? "Pick a target" : "Lock in & fire"}
                  disabled={shoot === null}
                  busy={busy}
                  onPress={lockIn}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.hint}>
              {duel.them_locked
                ? `${partnerName} has locked in. Your move.`
                : "Tap a spot to hide behind it."}
            </Text>
          )}
        </View>
      ) : null}

      <Celebration
        visible={celebrate}
        title="You won"
        message={`The standoff is yours, against ${partnerName}.`}
        onDone={endCelebrate}
      />
    </SafeAreaView>
  );
}

const SPOT = 62;

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

  intro: {
    alignItems: "center",
    gap: 12,
    paddingTop: 30,
  },

  introEmoji: {
    fontSize: 64,
  },

  introTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: T.label,
  },

  introText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    textAlign: "center",
    marginBottom: 6,
  },

  board: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
  },

  side: {
    flex: 1,
    gap: 6,
  },

  sideEnd: {
    alignItems: "flex-end",
  },

  who: {
    fontSize: 14,
    fontWeight: "700",
    color: T.label,
  },

  round: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.label2,
  },

  lives: {
    flexDirection: "row",
    gap: 5,
  },

  life: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },

  field: {
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 10,
    gap: 14,
  },

  fieldLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },

  spots: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  spot: {
    width: SPOT,
    height: SPOT + 18,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "visible",
  },

  spotYou: {
    backgroundColor: "rgba(229,112,143,0.35)",
    borderWidth: 2,
    borderColor: T.you,
  },

  spotAim: {
    borderWidth: 2,
    borderColor: "#FFD54A",
  },

  spotOff: {
    opacity: 0.35,
  },

  spotPressed: {
    transform: [{ scale: 0.94 }],
  },

  spotEmoji: {
    fontSize: 28,
  },

  spotName: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },

  marker: {
    position: "absolute",
    top: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  markerYou: {
    left: 6,
    backgroundColor: T.you,
  },

  markerThem: {
    right: 6,
    backgroundColor: T.accent,
  },

  crosshair: {
    position: "absolute",
    bottom: -4,
    fontSize: 20,
    color: "#FFD54A",
    fontWeight: "800",
  },

  splat: {
    position: "absolute",
    width: 44,
    height: 40,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 24,
  },

  drip: {
    position: "absolute",
    borderRadius: 6,
  },

  dripA: { width: 10, height: 10, top: -6, left: 4 },
  dripB: { width: 8, height: 14, bottom: -10, right: 10 },
  dripC: { width: 12, height: 8, right: -6, top: 12 },

  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  legendText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginRight: 8,
  },

  result: {
    alignItems: "center",
    gap: 4,
  },

  resultTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: T.label,
    textAlign: "center",
  },

  resultText: {
    fontSize: 15,
    color: T.label2,
    textAlign: "center",
  },

  gearRow: {
    flexDirection: "row",
    gap: 10,
  },

  gear: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: T.surface,
  },

  gearOn: {
    backgroundColor: T.accent,
  },

  gearOff: {
    opacity: 0.4,
  },

  gearEmoji: {
    fontSize: 24,
  },

  gearLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: T.label,
  },

  gearLabelOn: {
    color: "#FFFFFF",
  },

  gearHint: {
    fontSize: 12,
    color: T.label2,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  footerRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 50,
  },

  waitingText: {
    fontSize: 16,
    color: T.label2,
  },

  hint: {
    fontSize: 15,
    color: T.label2,
    textAlign: "center",
    paddingVertical: 14,
  },
}));
