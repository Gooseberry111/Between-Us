import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";

import { T } from "../lib/theme";
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
  partnerOnline,
  onHug,
}) {
  const [sent, setSent] = useState(false);
  const [animate, setAnimate] = useState(true);

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

  const startHold = () => {
    if (sent) return;

    Animated.timing(hold, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;

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
      {/* The glow behind them: their colour on the right,
          yours on the left. */}
      <View style={styles.glow} pointerEvents="none">
        <View style={[styles.glowBlob, styles.glowYou]} />

        <View style={[styles.glowBlob, styles.glowThem]} />
      </View>

      {days ? (
        <>
          <Text style={styles.dayLabel}>Day</Text>

          <Text style={styles.dayCount}>{days}</Text>
        </>
      ) : null}

      <Text
        style={[styles.names, !days && styles.namesAlone]}
        numberOfLines={1}
      >
        {days ? "of " : ""}
        {youName} &amp; {partnerName}
      </Text>

      <View style={styles.row}>
        {/* YOU */}
        <View style={styles.person}>
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

            <View style={styles.moodBadge}>
              {mood ? (
                <Text style={styles.moodEmoji}>{mood}</Text>
              ) : (
                <Ionicons name="add" size={15} color={T.youText} />
              )}
            </View>
          </View>

          <Text style={styles.personName}>You</Text>

          <Animated.View
            style={[
              styles.state,
              youAnswered ? styles.stateDone : styles.stateTurn,
              !youAnswered && animate ? { opacity: breathe } : null,
            ]}
          >
            {youAnswered ? (
              <Ionicons name="checkmark" size={12} color="#1E8E3E" />
            ) : null}

            <Text
              style={[
                styles.stateText,
                { color: youAnswered ? "#1E8E3E" : T.youText },
              ]}
            >
              {youAnswered ? "Answered" : "Your turn"}
            </Text>
          </Animated.View>
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
                stroke="rgba(240,63,169,0.12)"
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

        {/* THEM */}
        <View style={styles.person}>
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
          </Animated.View>

          <Text style={styles.personName} numberOfLines={1}>
            {partnerName}
          </Text>

          <View
            style={[
              styles.state,
              partnerAnswered ? styles.stateDone : styles.stateWaiting,
            ]}
          >
            {partnerAnswered ? (
              <Ionicons name="checkmark" size={12} color="#1E8E3E" />
            ) : null}

            <Text
              style={[
                styles.stateText,
                { color: partnerAnswered ? "#1E8E3E" : T.label2 },
              ]}
            >
              {partnerAnswered ? "Answered" : "Waiting"}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.caption, sent && styles.captionSent]}>
        {sent
          ? `Hug sent. ${partnerName} just felt it.`
          : `Hold the heart to send ${partnerName} a hug`}
      </Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
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

  glowBlob: {
    position: "absolute",
    top: 40,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.22,
  },

  glowYou: {
    left: "6%",
    backgroundColor: T.you,
  },

  glowThem: {
    right: "6%",
    backgroundColor: T.accent,
  },

  dayLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
  },

  dayCount: {
    fontSize: 76,
    lineHeight: 80,
    fontWeight: "700",
    letterSpacing: -3.8,
    color: T.accent,
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
    ...Platform.select({ ios: { fontFamily: "Georgia" }, default: {} }),
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
    borderColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    borderColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
  },

  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: T.label,
  },
});
