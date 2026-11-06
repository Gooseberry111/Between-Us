import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Line,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
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
 * TANK DUEL
 * ==========================================
 *
 * Two tanks on either side of the hills. Take turns: set
 * the angle and the power, read the wind, fire. The shell
 * flies on both phones exactly as the server worked it out,
 * so you watch their shot land before you fire back.
 * A direct hit does 40, near misses less. First to 0 loses.
 */

const WORLD_H = 560;
const GRAVITY = 50;

const tap = (style) => Haptics.impactAsync(style).catch(() => {});

function groundAt(heights, step, x) {
  const i = Math.max(0, Math.min(heights.length - 2, Math.floor(x / step)));
  const f = x / step - i;
  return heights[i] * (1 - f) + heights[i + 1] * f;
}

/* The first stretch of your shot, as an aiming guide. */
function aimGuide(duel, angle, power) {
  const { terrain, step, tank } = duel;
  const dir = tank.you.facing;
  const speed = power * 3;
  const rad = (angle * Math.PI) / 180;
  let x = tank.you.x + dir * 14;
  let y = groundAt(terrain, step, tank.you.x) + 16;
  let vx = Math.cos(rad) * speed * dir;
  let vy = Math.sin(rad) * speed;
  const points = [];

  for (let i = 0; i < 70; i++) {
    vy -= GRAVITY * 0.02;
    x += vx * 0.02;
    y += vy * 0.02;
    if (i % 5 === 0) points.push([x, y]);
  }

  return points;
}

function Tank({ x, y, facing, angle, colour, scaleX, scaleY }) {
  const rad = (angle * Math.PI) / 180;
  const cx = x * scaleX;
  const cy = (WORLD_H - y) * scaleY;
  const barrel = 16;

  return (
    <G>
      <Path
        d={`M ${cx - 13} ${cy} L ${cx + 13} ${cy} L ${cx + 10} ${cy - 7} L ${cx - 10} ${cy - 7} Z`}
        fill={colour}
      />
      <Circle cx={cx} cy={cy - 8} r={6} fill={colour} />
      <Path
        d={`M ${cx} ${cy - 9} L ${cx + Math.cos(rad) * barrel * facing} ${cy - 9 - Math.sin(rad) * barrel}`}
        stroke={colour}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Rect
        x={cx - 12}
        y={cy - 2}
        width={24}
        height={4}
        rx={2}
        fill="#1A1A1A"
        opacity={0.55}
      />
    </G>
  );
}

export default function TanksScreen() {
  useTheme();

  const router = useRouter();
  const connected = useIsConnected();
  const { width: screenW } = useWindowDimensions();

  const { duel, score, partnerName, loading, busy, error, start, move } =
    useDuel("tanks", {
      waitingOnThem: (current) => current.turn === "them",
    });

  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(65);

  /*
   * Aim like a slingshot: press anywhere on the field and
   * pull back. The band stretches from your tank, the shot
   * goes the other way, and the further you pull the harder
   * it flies. Letting go keeps the aim; Fire! fires.
   */
  const [pull, setPull] = useState(null);
  const aimLive = useRef({ can: false, facing: 1, reach: 150 });
  const lastPowerTick = useRef(0);

  const stretch = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => aimLive.current.can,
        onMoveShouldSetPanResponder: () => aimLive.current.can,
        /* While you are stretching, the page never takes the finger. */
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          setPull({ dx: 0, dy: 0 });
          Haptics.selectionAsync().catch(() => {});
        },
        onPanResponderMove: (_, g) => {
          const { facing, reach } = aimLive.current;
          const length = Math.hypot(g.dx, g.dy);
          const scale = length > reach ? reach / length : 1;

          setPull({ dx: g.dx * scale, dy: g.dy * scale });

          if (length < 8) return;

          /* Pull down and back, aim up and forward. */
          const forward = -g.dx * facing;
          const up = g.dy;
          const degrees = (Math.atan2(up, forward) * 180) / Math.PI;
          const nextAngle = Math.round(Math.max(5, Math.min(85, degrees)));
          const nextPower = Math.round(
            Math.max(
              10,
              Math.min(100, (Math.min(length, reach) / reach) * 100),
            ),
          );

          setAngle(nextAngle);
          setPower(nextPower);

          const tick = Math.floor(nextPower / 10);
          if (tick !== lastPowerTick.current) {
            lastPowerTick.current = tick;
            Haptics.selectionAsync().catch(() => {});
          }
        },
        onPanResponderRelease: () => setPull(null),
        onPanResponderTerminate: () => setPull(null),
      }),
    [],
  );

  /* The shot in the air, 0 → 1, and the one last shown. */
  const [flight, setFlight] = useState(1);
  const [shot, setShot] = useState(null);
  const shownShot = useRef(null);
  const [celebrate, setCelebrate] = useState(false);
  const endCelebrate = useCallback(() => setCelebrate(false), []);

  /* The latest match, read by the flight without restarting it. */
  const duelRef = useRef(duel);
  duelRef.current = duel;

  const shotKey = duel
    ? `${duel.id}:${duel.last ? duel.last.turn : "none"}`
    : null;

  useEffect(() => {
    const duel = duelRef.current;
    const last = duel?.last;

    if (!duel) return undefined;

    const key = last ? `${duel.id}:${last.turn}` : `${duel.id}:none`;

    /* First sight of a match: show where things stand, no replay. */
    if (
      shownShot.current === null ||
      !shownShot.current.startsWith(`${duel.id}:`)
    ) {
      shownShot.current = key;
      setShot(last || null);
      setFlight(1);
      return undefined;
    }

    if (!last || shownShot.current === key) return undefined;

    shownShot.current = key;
    setShot(last);
    setFlight(0);

    let frame;
    const began = Date.now();
    const length = 1500;

    const step = () => {
      const progress = Math.min(1, (Date.now() - began) / length);
      setFlight(progress);

      if (progress < 1) frame = requestAnimationFrame(step);
      else {
        if (last.damage >= 30 || last.direct)
          tap(Haptics.ImpactFeedbackStyle.Heavy);
        else if (last.damage > 0) tap(Haptics.ImpactFeedbackStyle.Medium);
        else tap(Haptics.ImpactFeedbackStyle.Light);

        const now = duelRef.current;
        if (now && now.status !== "playing" && now.winner === "you")
          setCelebrate(true);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [shotKey]);

  if (connected === false) {
    return <ConnectFirst feature="Tank Duel" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/games");
  };

  const fire = async () => {
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    await move({ angle, power });
  };

  const challenge = async () => {
    shownShot.current = null;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    await start();
  };

  const playing = duel?.status === "playing";
  const over = duel && !playing;
  const yourTurn = playing && duel.turn === "you";

  /* ---------- the battlefield ---------- */

  const W = screenW - 32;
  const H = Math.round(W * 0.6);
  const scaleX = duel ? W / duel.width : 1;
  const scaleY = H / WORLD_H;
  const sx = (x) => x * scaleX;
  const sy = (y) => (WORLD_H - y) * scaleY;

  const ground = duel
    ? `M 0 ${H} ` +
      duel.terrain.map((h, i) => `L ${sx(i * duel.step)} ${sy(h)}`).join(" ") +
      ` L ${W} ${H} Z`
    : "";

  const flying = shot && flight < 1;
  const shown = shot ? Math.max(1, Math.floor(shot.path.length * flight)) : 0;
  const trail = shot ? shot.path.slice(0, shown) : [];
  const head = trail[trail.length - 1];
  const landed = shot && flight >= 1 && shot.impact;

  const guide = duel && yourTurn && !flying ? aimGuide(duel, angle, power) : [];

  aimLive.current = {
    can: Boolean(yourTurn && !flying && !busy),
    facing: duel?.tank?.you?.facing || 1,
    reach: W * 0.42,
  };

  /* Where the band starts: your tank's turret, on screen. */
  const turret = duel
    ? { x: sx(duel.tank.you.x), y: sy(duel.tank.you.y) - 9 }
    : null;

  const hpBar = (value, colour) => (
    <View style={styles.hpTrack}>
      <View
        style={[
          styles.hpFill,
          {
            width: `${Math.max(0, (value / duel.hp.max) * 100)}%`,
            backgroundColor: colour,
          },
        ]}
      />
    </View>
  );

  const shotLine = () => {
    if (!shot || flying) return null;

    const by = shot.by === "you" ? "Your" : `${partnerName}'s`;

    if (shot.direct) return `${by} shell — direct hit! −${shot.damage}`;
    if (shot.damage > 0) return `${by} shell landed close. −${shot.damage}`;
    if (!shot.impact) return `${by} shell flew off the map.`;
    return `${by} shell missed.`;
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.nav}>
        <GlassButton icon="back" label="Back" onPress={goBack} />

        <Text style={styles.navTitle}>Tank Duel</Text>

        <View style={styles.scoreChip}>
          <Text style={styles.scoreText}>
            {score.you}–{score.them}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!pull}
      >
        {loading && !duel ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 60 }} />
        ) : !duel ? (
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>💥</Text>
            <Text style={styles.introTitle}>Aim over the hill</Text>
            <Text style={styles.introText}>
              Your tank on one side, theirs on the other. Take turns: pull back
              from your tank like a slingshot to aim, mind the wind, and fire. A
              direct hit does 40 damage; close calls do less. First tank to 0
              loses.
            </Text>
            <Button
              title={`Challenge ${partnerName}`}
              onPress={challenge}
              busy={busy}
            />
          </View>
        ) : (
          <>
            {/* HEALTH */}
            <View style={styles.board}>
              <View style={styles.side}>
                <Text style={styles.who}>You · {duel.hp.you}</Text>
                {hpBar(duel.hp.you, T.you)}
              </View>

              <View style={[styles.side, styles.sideEnd]}>
                <Text style={styles.who} numberOfLines={1}>
                  {partnerName} · {duel.hp.them}
                </Text>
                {hpBar(duel.hp.them, T.accent)}
              </View>
            </View>

            {/* THE FIELD */}
            <View style={styles.field} {...stretch.panHandlers}>
              <Svg width={W} height={H}>
                <Defs>
                  <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <Stop
                      offset="0"
                      stopColor={T.dark ? "#1B1630" : "#7FB7E8"}
                    />
                    <Stop
                      offset="1"
                      stopColor={T.dark ? "#3A2A4F" : "#F6D7A7"}
                    />
                  </SvgGradient>
                  <SvgGradient id="hill" x1="0" y1="0" x2="0" y2="1">
                    <Stop
                      offset="0"
                      stopColor={T.dark ? "#3E5E33" : "#6FA34F"}
                    />
                    <Stop
                      offset="1"
                      stopColor={T.dark ? "#1F2E1A" : "#3D6B2D"}
                    />
                  </SvgGradient>
                </Defs>

                <Rect x={0} y={0} width={W} height={H} fill="url(#sky)" />
                <Path d={ground} fill="url(#hill)" />

                <Tank
                  {...duel.tank.you}
                  angle={
                    yourTurn ? angle : shot?.by === "you" ? shot.angle : 45
                  }
                  colour={T.you}
                  scaleX={scaleX}
                  scaleY={scaleY}
                />
                <Tank
                  {...duel.tank.them}
                  angle={shot?.by === "them" ? shot.angle : 45}
                  colour={T.accent}
                  scaleX={scaleX}
                  scaleY={scaleY}
                />

                {yourTurn && !flying && turret && !pull ? (
                  <Circle
                    cx={turret.x}
                    cy={turret.y}
                    r={22}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    strokeDasharray="3 4"
                    opacity={0.7}
                  />
                ) : null}

                {pull && turret ? (
                  <G>
                    <Line
                      x1={turret.x}
                      y1={turret.y}
                      x2={turret.x + pull.dx}
                      y2={turret.y + pull.dy}
                      stroke={T.you}
                      strokeWidth={3}
                      strokeLinecap="round"
                      opacity={0.9}
                    />
                    <Circle
                      cx={turret.x + pull.dx}
                      cy={turret.y + pull.dy}
                      r={9}
                      fill={T.you}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  </G>
                ) : null}

                {guide.length > 1 ? (
                  <Polyline
                    points={guide
                      .map(([x, y]) => `${sx(x)},${sy(y)}`)
                      .join(" ")}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeDasharray="2 6"
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                ) : null}

                {trail.length > 1 ? (
                  <Polyline
                    points={trail
                      .map(([x, y]) => `${sx(x)},${sy(y)}`)
                      .join(" ")}
                    fill="none"
                    stroke={shot.by === "you" ? T.you : T.accent}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    opacity={flying ? 0.9 : 0.45}
                  />
                ) : null}

                {flying && head ? (
                  <Circle
                    cx={sx(head[0])}
                    cy={sy(head[1])}
                    r={4}
                    fill="#1A1A1A"
                  />
                ) : null}

                {landed ? (
                  <G>
                    <Circle
                      cx={sx(shot.impact[0])}
                      cy={sy(shot.impact[1])}
                      r={18}
                      fill="#FF9F0A"
                      opacity={0.55}
                    />
                    <Circle
                      cx={sx(shot.impact[0])}
                      cy={sy(shot.impact[1])}
                      r={9}
                      fill="#FFD54A"
                      opacity={0.9}
                    />
                    {shot.damage > 0 ? (
                      <SvgText
                        x={sx(shot.impact[0])}
                        y={sy(shot.impact[1]) - 22}
                        fill="#FFFFFF"
                        stroke="#000000"
                        strokeWidth={0.6}
                        fontSize={16}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        −{shot.damage}
                      </SvgText>
                    ) : null}
                  </G>
                ) : null}
              </Svg>

              <View style={styles.wind} pointerEvents="none">
                <Text style={styles.windText}>
                  Wind{" "}
                  {duel.wind === 0
                    ? "calm"
                    : `${duel.wind < 0 ? "←" : "→"} ${Math.abs(duel.wind).toFixed(1)}`}
                </Text>
              </View>
            </View>

            {shotLine() ? (
              <Text style={styles.shotLine}>{shotLine()}</Text>
            ) : null}

            {over && !flying ? (
              <Text style={styles.resultTitle}>
                {duel.winner === "you"
                  ? "Victory! Their tank is scrap 🏆"
                  : duel.winner === "them"
                    ? `${partnerName} blew you away this time`
                    : "A draw. Both still smoking."}
              </Text>
            ) : null}

            {yourTurn && !flying ? (
              <View style={styles.controls}>
                <Text style={styles.aimHint}>
                  {pull
                    ? "Let go to keep this aim"
                    : "Press the field and pull back to aim"}
                </Text>

                <View style={styles.aimRow}>
                  <View style={styles.aimStat}>
                    <Text style={styles.aimLabel}>Angle</Text>
                    <Text style={styles.aimValue}>{angle}°</Text>
                  </View>

                  <View style={styles.aimStat}>
                    <Text style={styles.aimLabel}>Power</Text>
                    <Text style={styles.aimValue}>{power}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Notice>{error}</Notice>
          </>
        )}
      </ScrollView>

      {duel ? (
        <View style={styles.footer}>
          {flying ? (
            <Text style={styles.hint}>Incoming…</Text>
          ) : over ? (
            <Button
              title="Rematch"
              icon="undo"
              onPress={challenge}
              busy={busy}
            />
          ) : yourTurn ? (
            <Button title="Fire!" icon="bolt" onPress={fire} busy={busy} />
          ) : (
            <View style={styles.waiting}>
              <ActivityIndicator color={T.accent} />
              <Text style={styles.waitingText}>
                {partnerName} is lining up a shot…
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <Celebration
        visible={celebrate}
        title="You won"
        message={`Tank Duel, against ${partnerName}.`}
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
    gap: 16,
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

  hpTrack: {
    alignSelf: "stretch",
    height: 10,
    borderRadius: 5,
    backgroundColor: T.fill3,
    overflow: "hidden",
  },

  hpFill: {
    height: 10,
    borderRadius: 5,
  },

  field: {
    borderRadius: 20,
    overflow: "hidden",
  },

  wind: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  windText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  shotLine: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
    textAlign: "center",
  },

  resultTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: T.label,
    textAlign: "center",
  },

  controls: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: T.surface,
  },

  aimHint: {
    fontSize: 14,
    color: T.label2,
    textAlign: "center",
  },

  aimRow: {
    flexDirection: "row",
    gap: 12,
  },

  aimStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: T.fill4,
  },

  aimLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: T.label2,
  },

  aimValue: {
    fontSize: 22,
    fontWeight: "800",
    color: T.you,
    fontVariant: ["tabular-nums"],
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
    fontSize: 16,
    color: T.label2,
  },

  hint: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label2,
    textAlign: "center",
    paddingVertical: 14,
  },
}));
