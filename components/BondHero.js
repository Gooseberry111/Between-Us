import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { TAP_LIST } from "../lib/taps";
import { T, themedStyles, useTheme } from "../lib/theme";
import { motionAllowed } from "./ui";

/*
 * ==========================================
 * BOND HERO
 * ==========================================
 *
 * The two of them, joined by a thread, under the day
 * count. Everything else on Home is a feature; this is
 * the relationship, so it leads.
 *
 * Holding the heart for 1.2s fills its ring and sends
 * a hug: a thick stroke travels the thread and their
 * avatar pops.
 *
 * Needs backend: hug delivery, partner presence, the
 * partner's chosen mood.
 */

const HOLD_MS = 1200;

/*
 * What the hug feels like in the hand, using the system
 * haptic engine (the Taptic Engine on iPhone):
 *
 *   touch down      a selection click, so the press registers
 *   while holding   three taps that grow -- soft, light,
 *                   medium -- as the ring fills, the way a
 *                   long-press builds on iOS
 *   ring full       the success pattern: it's sent
 *   it lands        a light tap as their avatar takes it
 *
 * Letting go early is silent: you just let go.
 */
const BUILD_UP = [
  { at: 300, style: Haptics.ImpactFeedbackStyle.Soft },
  { at: 600, style: Haptics.ImpactFeedbackStyle.Light },
  { at: 900, style: Haptics.ImpactFeedbackStyle.Medium },
];

/* Haptics can be unavailable (some Android devices, low
 * power mode); the hug must never fail because of that. */
function feel(run) {
  try {
    run()?.catch?.(() => {});
  } catch {
    /* no haptics on this device */
  }
}
/* "a bit lonely" -> "A bit lonely": the pill under each circle. */
const capital = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const WIRE = "M0,30 C48,2 122,58 170,30";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/* The heart's progress ring: 2πr with r = 31. */
const RING = 195;

export default function BondHero({
  youName,
  partnerName,
  days,
  youAnswered,
  partnerAnswered,
  streak,
  monthsLine,
  mood,
  moodLabel,
  partnerMood,
  partnerMoodLabel,
  partnerOnline,
  onHug,
  moods,
  moodKey,
  onChooseMood,
  onSendTap,
  onWheel,
}) {
  useTheme();

  const [sent, setSent] = useState(false);
  const [animate, setAnimate] = useState(true);

  /* Which wheel is out ("you", "them" or none), and where
   * each circle is on the card. */
  const [wheel, setWheel] = useState(null);
  const [rowAt, setRowAt] = useState(null);
  const [youAt, setYouAt] = useState(null);
  const [themAt, setThemAt] = useState(null);

  const closeWheel = useCallback(() => setWheel(null), []);

  const toggleWheel = (which) => {
    Haptics.selectionAsync().catch(() => {});
    setWheel((current) => (current === which ? null : which));
  };

  /* Home stops scrolling while a wheel is out. */
  const wheelRef = useRef(onWheel);
  wheelRef.current = onWheel;

  useEffect(() => {
    wheelRef.current?.(Boolean(wheel));
  }, [wheel]);

  const centreOf = (at) =>
    rowAt && at ? { x: rowAt.x + at.x + 48, y: rowAt.y + at.y + 45 } : null;

  const moodItems = useMemo(
    () => (moods || []).map((item) => ({ ...item })),
    [moods],
  );

  const hold = useRef(new Animated.Value(0)).current;
  const hug = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const themPop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    motionAllowed().then((allowed) => {
      if (!cancelled) setAnimate(allowed);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* Loops: the heartbeat, the dashed ring turning, and
   * "Your turn" breathing. All off under Reduce Motion. */
  useEffect(() => {
    if (!animate) return;

    const beatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1.16,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1.1,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ]),
    );

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 0.55,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    beatLoop.start();
    spinLoop.start();

    if (!youAnswered) breatheLoop.start();

    return () => {
      beatLoop.stop();
      spinLoop.stop();
      breatheLoop.stop();
    };
  }, [animate, youAnswered, beat, spin, breathe]);

  const ticks = useRef([]);

  const clearTicks = () => {
    ticks.current.forEach(clearTimeout);
    ticks.current = [];
  };

  /* No stray taps if the screen goes while someone holds. */
  useEffect(() => clearTicks, []);

  const startHold = () => {
    if (sent) return;

    feel(() => Haptics.selectionAsync());

    clearTicks();

    ticks.current = BUILD_UP.map(({ at, style }) =>
      setTimeout(() => feel(() => Haptics.impactAsync(style)), at),
    );

    Animated.timing(hold, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      clearTicks();

      if (!finished) return;

      feel(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      );

      setSent(true);
      onHug?.();

      Animated.sequence([
        Animated.timing(hug, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(60),
      ]).start(() => {
        /* Their avatar takes the hug. */
        feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

        Animated.sequence([
          Animated.spring(themPop, {
            toValue: 1.22,
            useNativeDriver: true,
            speed: 20,
            bounciness: 14,
          }),
          Animated.spring(themPop, {
            toValue: 1,
            useNativeDriver: true,
            speed: 14,
            bounciness: 10,
          }),
        ]).start();

        setTimeout(() => {
          setSent(false);
          hold.setValue(0);
          hug.setValue(0);
        }, 2600);
      });
    });
  };

  const cancelHold = () => {
    if (sent) return;

    clearTicks();

    Animated.timing(hold, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  /* The dashes crawl along the thread: 1.4s per cycle. */
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;

    const loop = Animated.loop(
      Animated.timing(flow, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );

    loop.start();

    return () => loop.stop();
  }, [animate, flow]);

  const flowOffset = flow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const ringOffset = hold.interpolate({
    inputRange: [0, 1],
    outputRange: [RING, 0],
  });

  const hugOffset = hug.interpolate({
    inputRange: [0, 1],
    outputRange: [32, -200],
  });

  const hugOpacity = hug.interpolate({
    inputRange: [0, 0.05, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View style={styles.wrap}>
      {/*
        .bond::before, exactly: two radial gradients, not
        circles. Each is an ellipse 42% wide and 46% tall,
        centred at 22% and 78% across and 62% down, starting
        at 22% of the colour and fading to nothing by 70% of
        its radius -- yours on the left, theirs on the right.
      */}
      <View style={styles.glow} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient
              id="glowYou"
              cx="22%"
              cy="62%"
              rx="42%"
              ry="46%"
              fx="22%"
              fy="62%"
            >
              <Stop offset="0" stopColor={T.you} stopOpacity="0.22" />
              <Stop offset="0.7" stopColor={T.you} stopOpacity="0" />
            </RadialGradient>

            <RadialGradient
              id="glowThem"
              cx="78%"
              cy="62%"
              rx="42%"
              ry="46%"
              fx="78%"
              fy="62%"
            >
              <Stop offset="0" stopColor={T.accent} stopOpacity="0.22" />
              <Stop offset="0.7" stopColor={T.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Rect width="100%" height="100%" fill="url(#glowYou)" />
          <Rect width="100%" height="100%" fill="url(#glowThem)" />
        </Svg>
      </View>

      {days ? (
        <>
          <Text style={styles.dayLabel}>Day</Text>

          <Text
            style={styles.dayCount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {days}
          </Text>
        </>
      ) : null}

      <Text
        style={[styles.names, !days && styles.namesAlone]}
        numberOfLines={1}
      >
        {days ? "of " : ""}
        {youName} &amp; {partnerName}
      </Text>

      <View style={styles.row} onLayout={(e) => setRowAt(e.nativeEvent.layout)}>
        {/* YOU -- tap your circle for the wheel of moods. */}
        <View
          style={styles.person}
          onLayout={(e) => setYouAt(e.nativeEvent.layout)}
        >
          <View style={styles.orb}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    {
                      rotate: spin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Svg width="90" height="90" viewBox="0 0 100 100">
                <Circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke={T.you}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="3 8"
                />
              </Svg>
            </Animated.View>

            <View style={[styles.av, styles.avYou]}>
              <Text style={[styles.avText, { color: T.youText }]}>
                {(youName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* The whole circle opens the mood wheel. */}
            {onChooseMood ? (
              <Pressable
                onPress={() => toggleWheel("you")}
                style={styles.youTarget}
                accessibilityRole="button"
                accessibilityLabel={mood ? "Change your mood" : "Add a mood"}
              />
            ) : null}

            <View style={styles.moodBadge} pointerEvents="none">
              {mood ? (
                <Text style={styles.moodEmoji}>{mood}</Text>
              ) : (
                <Ionicons name="add" size={15} color={T.youText} />
              )}
            </View>
          </View>

          <Text style={styles.personName}>You</Text>

          {/* How you are, in a word -- tap to change it. */}
          <Pressable
            onPress={() => toggleWheel("you")}
            hitSlop={6}
            accessibilityRole="button"
            style={[styles.state, styles.stateTurn]}
          >
            <Text
              style={[styles.stateText, { color: T.youText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {wheel === "you"
                ? "Spin for more"
                : moodLabel
                  ? capital(moodLabel)
                  : "Your mood"}
            </Text>
          </Pressable>
        </View>

        {/* THE THREAD */}
        <View style={styles.thread}>
          <View style={styles.wire} pointerEvents="none">
            <Svg width="100%" height="60" viewBox="0 0 170 60">
              <Defs>
                <SvgGradient id="bondGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={T.you} />
                  <Stop offset="0.55" stopColor={T.accent} />
                  <Stop offset="1" stopColor={T.secondary} />
                </SvgGradient>
              </Defs>

              {/* The thread itself. */}
              <Path
                d={WIRE}
                fill="none"
                stroke="rgba(74,45,92,0.12)"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* The dashes that travel between them, in the
                  full gradient: you, the accent, the sky. */}
              <AnimatedPath
                d={WIRE}
                fill="none"
                stroke="url(#bondGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="2 8"
                strokeDashoffset={flowOffset}
              />

              {/* The hug travelling across. */}
              <AnimatedPath
                d={WIRE}
                fill="none"
                stroke="url(#bondGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="32 600"
                strokeDashoffset={hugOffset}
                opacity={hugOpacity}
              />
            </Svg>
          </View>

          <Pressable
            onPressIn={startHold}
            onPressOut={cancelHold}
            accessibilityRole="button"
            accessibilityLabel={`Hold to send ${partnerName} a hug`}
          >
            <View style={styles.heartWrap}>
              {/* The ring filling as you hold. */}
              <Svg width="68" height="68" style={styles.heartRing}>
                <AnimatedCircle
                  cx="34"
                  cy="34"
                  r="31"
                  fill="none"
                  stroke={T.accent}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 34 34)"
                />
              </Svg>

              <Animated.View
                style={[
                  styles.heart,
                  sent && styles.heartSent,
                  { transform: [{ scale: animate && !sent ? beat : 1 }] },
                ]}
              >
                <Ionicons
                  name="heart"
                  size={26}
                  color={sent ? "#FFFFFF" : T.accent}
                />
              </Animated.View>
            </View>
          </Pressable>
        </View>

        {/* THEM -- tap their circle for a burst of little somethings. */}
        <View
          style={styles.person}
          onLayout={(e) => setThemAt(e.nativeEvent.layout)}
        >
          {onSendTap ? (
            <Pressable
              onPress={() => toggleWheel("them")}
              style={styles.burstTarget}
              accessibilityRole="button"
              accessibilityLabel={`Send ${partnerName} a little something`}
            />
          ) : null}

          <Animated.View
            style={[styles.orb, { transform: [{ scale: themPop }] }]}
          >
            <Svg
              width="90"
              height="90"
              viewBox="0 0 100 100"
              style={StyleSheet.absoluteFill}
            >
              <Circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke={T.accent}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </Svg>

            <View style={[styles.av, styles.avThem]}>
              <Text style={[styles.avText, { color: T.accentText }]}>
                {(partnerName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>

            {partnerOnline ? <View style={styles.online} /> : null}

            {/* How they are feeling today, if they have said. */}
            {partnerMood ? (
              <View
                style={styles.moodBadge}
                accessibilityLabel={`${partnerName}'s mood today`}
              >
                <Text style={styles.moodEmoji}>{partnerMood}</Text>
              </View>
            ) : null}
          </Animated.View>

          <Text style={styles.personName} numberOfLines={1}>
            {partnerName}
          </Text>

          {partnerMoodLabel || partnerOnline || onSendTap ? (
            <View style={[styles.state, styles.stateWaiting]}>
              <Text
                style={[styles.stateText, { color: T.label2 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {wheel === "them"
                  ? "Spin for more"
                  : partnerMoodLabel
                    ? capital(partnerMoodLabel)
                    : partnerOnline
                      ? "Here now"
                      : "Tap to send"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {sent ? (
        <Text style={[styles.caption, styles.captionSent]}>
          Hug sent. {partnerName} just felt it.
        </Text>
      ) : null}

      {streak > 0 || monthsLine ? (
        <View style={styles.chips}>
          {streak > 0 ? (
            <View style={styles.chip}>
              <Ionicons name="flame" size={15} color={T.orange} />

              <Text style={styles.chipText}>{streak}-night streak</Text>
            </View>
          ) : null}

          {monthsLine ? (
            <View style={styles.chip}>
              <Ionicons name="sparkles" size={14} color={T.accent} />

              <Text style={styles.chipText}>{monthsLine}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {onChooseMood && moodItems.length ? (
        <Wheel
          items={moodItems}
          mirror
          open={wheel === "you"}
          centre={centreOf(youAt)}
          chosen={moodKey}
          describe={(item) =>
            moodKey === item.key
              ? `Feeling ${item.label}: tap to clear it`
              : `Feeling ${item.label}`
          }
          onPick={(item) => onChooseMood(item.key)}
          onClose={closeWheel}
        />
      ) : null}

      {onSendTap ? (
        <Wheel
          items={TAP_ITEMS}
          open={wheel === "them"}
          centre={centreOf(themAt)}
          describe={(item) => `Send ${partnerName}: ${item.label}`}
          onPick={(item) => onSendTap(item.kind)}
          onClose={closeWheel}
        />
      ) : null}
    </View>
  );
}

/*
 * A wheel around one of the circles. Tap the circle: the
 * wheel springs out in an arc. Drag along it to spin
 * through everything on it; it settles on the nearest, with
 * a tick you can feel. Tap one: it flies up off the circle.
 * Tap anywhere else on the wheel to fold it away.
 *
 *   their circle   the little somethings (lib/taps.js)
 *   your circle    how you are feeling
 *
 * Their circle sits near the right edge, so its arc runs
 * from their left, round the top, towards the middle of
 * the card; yours is the mirror of it. The wheel is drawn
 * over the whole card rather than inside the circle's own
 * box, because Android does not pass on touches outside a
 * view's edges. While one is open, Home stops scrolling, so
 * a spin is never taken for a pull to refresh.
 */
const WHEEL_R = 82;
const WHEEL_START = 190; /* degrees: just left of their circle */
const WHEEL_STEP = 33;
const WHEEL_SHOWN = 4;
const WHEEL_BOX = (WHEEL_R + 30) * 2;
/* Finger travel along the arc for one step of the wheel. */
const WHEEL_PX = 62;

const toXY = (slot, mirror) => {
  const rad = ((WHEEL_START - slot * WHEEL_STEP) * Math.PI) / 180;
  const x = WHEEL_R * Math.cos(rad);
  return { x: mirror ? -x : x, y: -WHEEL_R * Math.sin(rad) };
};

/* Where bubble `index` sits, for every turn of the wheel. */
function wheelPath(index, mirror) {
  const input = [];
  const x = [];
  const y = [];
  const fade = [];
  const size = [];

  for (let turn = index - WHEEL_SHOWN - 2; turn <= index + 2; turn += 0.25) {
    const slot = index - turn;
    const at = toXY(slot, mirror);
    const out =
      slot < -0.5
        ? -0.5 - slot
        : slot > WHEEL_SHOWN - 0.5
          ? slot - (WHEEL_SHOWN - 0.5)
          : 0;

    input.push(turn);
    x.push(at.x);
    y.push(at.y);
    fade.push(Math.max(0, 1 - out * 1.6));
    size.push(Math.max(0.55, 1 - out * 0.6));
  }

  return { input, x, y, fade, size };
}

/* The faint track the bubbles ride on. */
function arcPath(mirror) {
  const from = toXY(-0.45, mirror);
  const to = toXY(WHEEL_SHOWN - 0.55, mirror);
  const c = WHEEL_BOX / 2;

  return `M${c + from.x},${c + from.y} A${WHEEL_R},${WHEEL_R} 0 0 ${mirror ? 0 : 1} ${c + to.x},${c + to.y}`;
}

function Wheel({
  items,
  mirror = false,
  open,
  centre,
  chosen,
  describe,
  onPick,
  onClose,
}) {
  useTheme();

  const [flying, setFlying] = useState(null);

  const spread = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;

  const turnNow = useRef(0);
  const turnStart = useRef(0);
  const lastTick = useRef(0);
  const moved = useRef(false);

  const most = Math.max(0, items.length - WHEEL_SHOWN);
  const paths = useMemo(
    () => items.map((_, index) => wheelPath(index, mirror)),
    [items, mirror],
  );
  const arc = useMemo(() => arcPath(mirror), [mirror]);

  /* Along the arc, away from the start: up and towards the
   * middle of the card, whichever side the circle is on. */
  const along = (dx, dy) => (mirror ? -dx : dx) - dy;

  useEffect(() => {
    const id = turn.addListener(({ value }) => {
      turnNow.current = value;
    });

    return () => turn.removeListener(id);
  }, [turn]);

  useEffect(() => {
    Animated.spring(spread, {
      toValue: open ? 1 : 0,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [open, spread]);

  const settle = (target) => {
    const to = Math.max(0, Math.min(most, Math.round(target)));

    Animated.spring(turn, {
      toValue: to,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        /* Empty space on the wheel: a tap there folds it away. */
        onStartShouldSetPanResponder: () => true,
        /* A drag that starts on a bubble spins the wheel instead. */
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        /* Once spinning, the page never takes the finger back. */
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          moved.current = false;
          turn.stopAnimation((value) => {
            turnStart.current = value;
            lastTick.current = Math.round(value);
          });
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) moved.current = true;

          let next = turnStart.current - along(g.dx, g.dy) / WHEEL_PX;

          if (next < 0) next *= 0.35;
          if (next > most) next = most + (next - most) * 0.35;

          turn.setValue(next);

          const tick = Math.round(next);

          if (tick !== lastTick.current && tick >= 0 && tick <= most) {
            lastTick.current = tick;
            Haptics.selectionAsync().catch(() => {});
          }
        },
        onPanResponderRelease: (_, g) => {
          if (!moved.current) {
            onClose();
            return;
          }

          settle(turnNow.current - (along(g.vx, g.vy) * 220) / WHEEL_PX);
        },
        onPanResponderTerminate: () => settle(turnNow.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turn, onClose, most, mirror],
  );

  const pick = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    onPick(item);
    onClose();
    setFlying(item);

    fly.setValue(0);

    Animated.timing(fly, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setFlying(null));
  };

  if (!centre) return null;

  const box = {
    left: centre.x - WHEEL_BOX / 2,
    top: centre.y - WHEEL_BOX / 2,
  };

  const grow = spread.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <>
      <View
        {...pan.panHandlers}
        pointerEvents={open ? "auto" : "none"}
        style={[styles.wheel, box]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: spread }]}
        >
          <Svg width={WHEEL_BOX} height={WHEEL_BOX}>
            <Path
              d={arc}
              fill="none"
              stroke={mirror ? T.you : T.accent}
              strokeOpacity={0.22}
              strokeWidth={50}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>

        {items.map((item, index) => {
          const path = paths[index];
          const follow = (output) =>
            turn.interpolate({
              inputRange: path.input,
              outputRange: output,
              extrapolate: "clamp",
            });

          return (
            <Animated.View
              key={item.key}
              style={[
                styles.wheelBubble,
                {
                  opacity: Animated.multiply(spread, follow(path.fade)),
                  transform: [
                    { translateX: Animated.multiply(spread, follow(path.x)) },
                    { translateY: Animated.multiply(spread, follow(path.y)) },
                    { scale: Animated.multiply(grow, follow(path.size)) },
                  ],
                },
              ]}
            >
              <Pressable
                onPress={() => pick(item)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={describe(item)}
                accessibilityState={{ selected: chosen === item.key }}
                style={({ pressed }) => [
                  styles.burstPress,
                  chosen === item.key && styles.burstChosen,
                  pressed && styles.burstPressed,
                ]}
              >
                <Text style={styles.burstEmoji}>{item.emoji}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {flying ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.flyer,
            {
              left: centre.x - 30,
              top: centre.y - 24,
              opacity: fly.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
              transform: [
                {
                  translateY: fly.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -150],
                  }),
                },
                {
                  scale: fly.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.2],
                  }),
                },
              ],
            },
          ]}
        >
          {flying.emoji}
        </Animated.Text>
      ) : null}
    </>
  );
}

/* The little somethings, keyed for the wheel. */
const TAP_ITEMS = TAP_LIST.map((tap) => ({ ...tap, key: tap.kind }));

const styles = themedStyles(() => ({
  wrap: {
    alignItems: "center",
    paddingTop: 2,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  glow: {
    position: "absolute",
    left: -40,
    right: -40,
    top: 40,
    height: 280,
  },

  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
  },

  /*
   * 76pt bold, rounded, tight -- the prototype's 76px/0.92.
   * The line box has to be taller than the glyphs or the top
   * of the numerals is cut off, so the tightness comes from
   * pulling the neighbours in, not from squeezing the line.
   */
  dayCount: {
    fontSize: 76,
    lineHeight: 90,
    fontWeight: "700",
    letterSpacing: -3.8,
    color: T.accent,
    marginTop: -8,
    marginBottom: -10,
    paddingHorizontal: 8,
    includeFontPadding: false,
    textAlign: "center",
    ...Platform.select({
      /* --f-round: SF Rounded */
      ios: { fontFamily: "ui-rounded" },
      default: {},
    }),
  },

  namesAlone: {
    fontSize: 26,
    lineHeight: 32,
    fontStyle: "normal",
    fontWeight: "700",
    color: T.label,
    marginTop: 2,
  },

  names: {
    fontSize: 21,
    lineHeight: 25,
    fontStyle: "italic",
    color: T.label2,
    marginTop: 4,
    letterSpacing: -0.2,
    /* --f-serif: New York */
    ...Platform.select({ ios: { fontFamily: "ui-serif" }, default: {} }),
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    width: "100%",
  },

  person: {
    width: 96,
    alignItems: "center",
    gap: 3,
  },

  /* The burst sits over their 90pt circle, centred on it. */
  youTarget: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 45,
  },

  burstTarget: {
    position: "absolute",
    top: 0,
    left: 3,
    width: 90,
    height: 90,
    borderRadius: 45,
    zIndex: 5,
  },

  burstPress: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  burstEmoji: {
    fontSize: 20,
  },

  flyer: {
    position: "absolute",
    width: 60,
    textAlign: "center",
    fontSize: 36,
    zIndex: 7,
  },

  wheel: {
    position: "absolute",
    width: WHEEL_BOX,
    height: WHEEL_BOX,
    zIndex: 6,
  },

  wheelBubble: {
    position: "absolute",
    left: WHEEL_BOX / 2 - 21,
    top: WHEEL_BOX / 2 - 21,
    width: 42,
    height: 42,
  },

  burstChosen: {
    borderWidth: 2.5,
    borderColor: T.you,
  },

  burstPressed: {
    transform: [{ scale: 0.88 }],
  },

  orb: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  av: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: T.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },

  avYou: {
    backgroundColor: T.youTint,
  },

  avThem: {
    backgroundColor: T.accentTint,
  },

  avText: {
    fontSize: 28,
    fontWeight: "600",
  },

  personName: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
    marginTop: 6,
  },

  state: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },

  stateTurn: {
    backgroundColor: T.youTint,
  },

  stateDone: {
    backgroundColor: "rgba(52,199,89,0.14)",
  },

  stateWaiting: {
    backgroundColor: T.fill4,
  },

  stateText: {
    fontSize: 12,
    fontWeight: "600",
  },

  moodBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  moodEmoji: {
    fontSize: 16,
  },

  online: {
    position: "absolute",
    left: 5,
    bottom: 5,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: T.green,
    borderWidth: 3,
    borderColor: T.surface,
  },

  thread: {
    flex: 1,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  wire: {
    position: "absolute",
    left: -10,
    right: -10,
    top: "50%",
    height: 60,
    marginTop: -30,
  },

  heartWrap: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },

  heartRing: {
    position: "absolute",
  },

  heart: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: T.accent,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  heartSent: {
    backgroundColor: T.accent,
  },

  caption: {
    fontSize: 13,
    color: T.label2,
    marginTop: 12,
    textAlign: "center",
  },

  captionSent: {
    color: T.accentText,
    fontWeight: "600",
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.surface,
  },

  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: T.label,
  },
}));
