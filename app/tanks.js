import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
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

/* A slider of our own: drag along it, or tap a point. */
function Slider({ label, value, min, max, unit, onChange }) {
  useTheme();

  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const pick = (x) => {
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    const next = Math.round(min + ratio * (max - min));
    changeRef.current(next);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => pick(event.nativeEvent.locationX),
        onPanResponderMove: (event) => pick(event.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max],
  );

  const ratio = (value - min) / (max - min);
  const nudge = (by) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(Math.max(min, Math.min(max, value + by)));
  };

  return (
    <View style={styles.slider}>
      <View style={styles.sliderTop}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>
          {value}
          {unit}
        </Text>
      </View>

      <View style={styles.sliderRow}>
        <Pressable
          onPress={() => nudge(-1)}
          style={styles.nudge}
          hitSlop={6}
          accessibilityLabel={`Less ${label}`}
        >
          <Text style={styles.nudgeText}>−</Text>
        </Pressable>

        <View
          style={styles.track}
          onLayout={(event) => {
            widthRef.current = event.nativeEvent.layout.width;
            setWidth(event.nativeEvent.layout.width);
          }}
          {...responder.panHandlers}
        >
          <View style={styles.rail} />
          <View
            style={[styles.trackFill, { width: Math.max(0, ratio * width) }]}
          />
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: ratio * width - 13 }]}
          />
        </View>

        <Pressable
          onPress={() => nudge(1)}
          style={styles.nudge}
          hitSlop={6}
          accessibilityLabel={`More ${label}`}
        >
          <Text style={styles.nudgeText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
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

  /* The shot in the air, 0 → 1, and the one last shown. */
  const [flight, setFlight] = useState(1);
  const [shot, setShot] = useState(null);
  const shownShot = useRef(null);
  const [celebrate, setCelebrate] = useState(false);
  const endCelebrate = useCallback(() => setCelebrate(false), []);

  useEffect(() => {
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

        if (duel.status !== "playing" && duel.winner === "you")
          setCelebrate(true);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [duel]);

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
      >
        {loading && !duel ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 60 }} />
        ) : !duel ? (
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>💥</Text>
            <Text style={styles.introTitle}>Aim over the hill</Text>
            <Text style={styles.introText}>
              Your tank on one side, theirs on the other. Take turns setting the
              angle and the power, mind the wind, and fire. A direct hit does 40
              damage; close calls do less. First tank to 0 loses.
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
            <View style={styles.field}>
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
                <Slider
                  label="Angle"
                  value={angle}
                  min={5}
                  max={85}
                  unit="°"
                  onChange={setAngle}
                />
                <Slider
                  label="Power"
                  value={power}
                  min={10}
                  max={100}
                  unit=""
                  onChange={setPower}
                />
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
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: T.surface,
  },

  slider: {
    gap: 8,
  },

  sliderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  sliderLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  sliderValue: {
    fontSize: 15,
    fontWeight: "700",
    color: T.accent,
    fontVariant: ["tabular-nums"],
  },

  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  nudge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.fill3,
    alignItems: "center",
    justifyContent: "center",
  },

  nudgeText: {
    fontSize: 20,
    fontWeight: "600",
    color: T.label,
    marginTop: -2,
  },

  track: {
    flex: 1,
    height: 30,
    justifyContent: "center",
  },

  rail: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.fill3,
  },

  trackFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.accent,
  },

  thumb: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: T.accent,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
