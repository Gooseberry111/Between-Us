import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T, TYPE } from "../lib/theme";
import { Avatar, motionAllowed } from "./ui";

/*
 * ==========================================
 * BOND HERO
 * ==========================================
 *
 * The two of them, joined by a thread, above the day
 * count. Every other thing on Home is a feature; this
 * is the relationship, so it leads.
 *
 * Holding the heart for 1.2s sends a hug: the ring
 * fills as you hold, then a pulse travels along the
 * thread towards them.
 *
 * Needs backend: hug delivery, the partner's live
 * presence dot, and the mood the partner has chosen.
 */

const HOLD_MS = 1200;

export default function BondHero({
  youName,
  partnerName,
  days,
  youAnswered,
  partnerAnswered,
  streak,
  mood,
  partnerOnline,
  onHug,
}) {
  const [sent, setSent] = useState(false);
  const [animate, setAnimate] = useState(true);

  const hold = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    motionAllowed().then((allowed) => {
      if (!cancelled) setAnimate(allowed);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* A slow heartbeat, unless the phone asks for less motion. */
  useEffect(() => {
    if (!animate) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1.12,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [animate, beat]);

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
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
      ]).start(() => {
        setSent(false);
        hold.setValue(0);
        pulse.setValue(0);
      });
    });
  };

  const cancelHold = () => {
    if (sent) return;

    Animated.timing(hold, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.dayLabel}>Day</Text>

      <Text style={styles.dayCount}>{days ?? "—"}</Text>

      <Text style={styles.names}>
        of {youName} &amp; {partnerName}
      </Text>

      <View style={styles.row}>
        {/* You */}
        <View style={styles.person}>
          <View>
            <Avatar name={youName} who="you" size={72} ring />

            {mood ? (
              <View style={styles.moodBadge}>
                <Text style={styles.moodEmoji}>{mood}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.personName}>You</Text>

          <Text style={[styles.state, youAnswered && styles.stateDone]}>
            {youAnswered ? "Answered" : "Your turn"}
          </Text>
        </View>

        {/* The thread */}
        <View style={styles.thread}>
          <View style={styles.wire}>
            <View style={styles.wireLine} />

            <Animated.View
              style={[
                styles.wirePulse,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 0.1, 0.85, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-46, 46],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          <Pressable
            onPressIn={startHold}
            onPressOut={cancelHold}
            accessibilityRole="button"
            accessibilityLabel={`Hold to send ${partnerName} a hug`}
          >
            <Animated.View
              style={[
                styles.heart,
                sent && styles.heartSent,
                { transform: [{ scale: animate && !sent ? beat : 1 }] },
              ]}
            >
              {/* The hold filling up. */}
              <Animated.View
                style={[
                  styles.heartFill,
                  {
                    opacity: hold.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                    transform: [
                      {
                        scale: hold.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />

              <Ionicons
                name="heart"
                size={25}
                color={sent ? "#FFFFFF" : T.accent}
              />
            </Animated.View>
          </Pressable>
        </View>

        {/* Them */}
        <View style={styles.person}>
          <View>
            <Avatar name={partnerName} who="them" size={72} ring />

            {partnerOnline ? <View style={styles.online} /> : null}
          </View>

          <Text style={styles.personName} numberOfLines={1}>
            {partnerName}
          </Text>

          <Text style={[styles.state, partnerAnswered && styles.stateDone]}>
            {partnerAnswered ? "Answered" : "Waiting"}
          </Text>
        </View>
      </View>

      <Text style={styles.caption}>
        {sent
          ? `Hug sent. ${partnerName} just felt it.`
          : `Hold the heart to send ${partnerName} a hug`}
      </Text>

      {streak > 0 ? (
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Ionicons name="flame" size={13} color={T.orange} />

            <Text style={styles.chipText}>{streak}-night streak</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },

  dayLabel: {
    ...TYPE.footnote,
    fontWeight: "600",
    color: T.label2,
  },

  dayCount: {
    fontSize: 64,
    lineHeight: 70,
    fontWeight: "700",
    color: T.accent,
    letterSpacing: -2,
  },

  names: {
    fontSize: 21,
    lineHeight: 26,
    fontStyle: "italic",
    color: T.label2,
    marginTop: 2,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginTop: 18,
    width: "100%",
  },

  person: {
    width: 104,
    alignItems: "center",
  },

  personName: {
    ...TYPE.headline,
    fontSize: 15,
    color: T.label,
    marginTop: 8,
  },

  state: {
    ...TYPE.caption,
    color: T.label2,
    marginTop: 2,
  },

  stateDone: {
    color: T.green,
    fontWeight: "600",
  },

  moodBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  moodEmoji: {
    fontSize: 16,
  },

  online: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: T.green,
    borderWidth: 2.5,
    borderColor: T.appBackground,
  },

  thread: {
    flex: 1,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },

  wire: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  wireLine: {
    height: 2,
    width: "100%",
    borderRadius: 2,
    backgroundColor: T.accentTint,
  },

  wirePulse: {
    position: "absolute",
    width: 26,
    height: 4,
    borderRadius: 3,
    backgroundColor: T.accent,
  },

  heart: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  heartSent: {
    backgroundColor: T.accent,
  },

  heartFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.accentTint,
    borderRadius: 28,
  },

  caption: {
    ...TYPE.footnote,
    color: T.label2,
    marginTop: 14,
    textAlign: "center",
  },

  chips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.8)",
  },

  chipText: {
    ...TYPE.caption,
    fontWeight: "600",
    color: T.label,
  },
});
