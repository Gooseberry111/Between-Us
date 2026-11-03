import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { useIsConnected } from "../lib/connection";
import { useMyName } from "../lib/useMyName";
import { T, useTheme } from "../lib/theme";
import { Icon, motionAllowed } from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { RemotePhoto } from "../components/Photo";

/*
 * ==========================================
 * YOUR MONTH, AS A FILM
 * ==========================================
 *
 * The month the two of you had, played back full screen:
 *
 *   the title       the month, your two rings meeting
 *   the numbers     counting up
 *   every memory    photos drifting slowly (Ken Burns),
 *                   the rest as a card
 *   dates, dreams   what you did, what came true
 *   a few nights    questions you both answered, side by side
 *   the score       Four in a Row, you against them
 *   the end         here's to next month, and play it again
 *
 * Tap the right to go on, the left to go back, hold to
 * pause. Reduce Motion keeps the slides still.
 */

const SLIDE_MS = 5200;
const PHOTO_MS = 6200;

/* Each slide gets its own sky, all from the Velvet palette. */
const SKIES = [
  ["#2B1A36", "#4A2D5C", "#7A3E62"],
  ["#3A1F2E", "#7A2E4C", "#D9577A"],
  ["#1E1B2E", "#3B2F5A", "#6B4E8A"],
  ["#2A2016", "#6B4A1F", "#C9973F"],
  ["#1A1423", "#4A2D5C", "#D9577A"],
];

function lastMonth() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shift(month, by) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + by, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(month, withYear) {
  const [year, number] = month.split("-").map(Number);

  return new Date(year, number - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function shortDate(iso) {
  if (!iso) return "";

  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });
}

const NUMBERS = [
  ["answers", "questions answered"],
  ["hugs", "hugs"],
  ["notes", "notes"],
  ["memories", "memories"],
  ["dates", "dates"],
  ["taps", "little somethings"],
  ["letters", "letters"],
  ["dreams", "dreams come true"],
];

/* The film, as a list of slides, from the month's data. */
function buildSlides(data) {
  if (!data) return [];

  const slides = [{ kind: "intro" }];
  const stats = data.stats || {};

  const numbers = NUMBERS.map(([key, label]) => ({
    n: stats[key] || 0,
    label,
  })).filter((item) => item.n > 0);

  if (numbers.length)
    slides.push({ kind: "numbers", numbers: numbers.slice(0, 6) });

  (data.memories || []).forEach((memory) => {
    slides.push(
      memory.photo_id
        ? { kind: "photo", ...memory }
        : { kind: "moment", ...memory },
    );
  });

  if ((data.dates || []).length)
    slides.push({ kind: "dates", dates: data.dates });

  (data.dreams || []).forEach((dream) =>
    slides.push({ kind: "dream", ...dream }),
  );

  (data.answers || []).forEach((answer) =>
    slides.push({ kind: "answer", ...answer }),
  );

  if ((stats.my_wins || 0) + (stats.their_wins || 0) > 0) {
    slides.push({
      kind: "games",
      mine: stats.my_wins || 0,
      theirs: stats.their_wins || 0,
    });
  }

  slides.push({ kind: slides.length === 1 ? "quiet" : "outro" });

  return slides;
}

/* A number that counts up from zero as its slide opens. */
function CountUp({ to, delay }) {
  useTheme();

  const value = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = value.addListener(({ value: v }) => setShown(Math.round(v)));

    value.setValue(0);

    Animated.timing(value, {
      toValue: to,
      duration: 1100,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => value.removeListener(id);
  }, [to, delay, value]);

  return <Text style={styles.bigNumber}>{shown}</Text>;
}

export default function RecapScreen() {
  useTheme();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { month: monthParam } = useLocalSearchParams();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();
  const myName = useMyName();

  const [month, setMonth] = useState(
    /^\d{4}-\d{2}$/.test(monthParam || "") ? monthParam : lastMonth(),
  );
  const [data, setData] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [motion, setMotion] = useState(true);

  const progress = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const paused = useRef(false);

  const slides = useMemo(() => buildSlides(data), [data]);
  const slide = slides[index];

  useEffect(() => {
    motionAllowed().then(setMotion);
  }, []);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;

    try {
      setLoading(true);

      const [recap, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/recap?month=${month}`).then((r) => r.json()),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      setData(recap);
      setPartnerName(
        partnerData?.partner?.nickname?.trim() ||
          partnerData?.partner?.first_name?.trim() ||
          "",
      );
      setIndex(0);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const duration =
    slide?.kind === "photo" || slide?.kind === "dream" ? PHOTO_MS : SLIDE_MS;
  const last = index >= slides.length - 1;

  const go = useCallback(
    (by) => {
      setIndex((current) =>
        Math.max(0, Math.min(slides.length - 1, current + by)),
      );
    },
    [slides.length],
  );

  /* Each slide: fade in, drift, and run its bar. The last one stays. */
  const run = useCallback(
    (from = 0) => {
      if (!slide) return;

      Animated.timing(progress, {
        toValue: 1,
        duration: duration * (1 - from),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && !last) go(1);
      });
    },
    [slide, duration, last, progress, go],
  );

  useEffect(() => {
    if (!slide) return;

    progress.setValue(0);
    enter.setValue(motion ? 0 : 1);
    drift.setValue(0);

    if (motion) {
      Animated.timing(enter, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      Animated.timing(drift, {
        toValue: 1,
        duration: duration + 600,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }

    paused.current = false;

    if (!last) run(0);
    else progress.setValue(1);

    return () => {
      progress.stopAnimation();
      drift.stopAnimation();
    };
  }, [index, slides]);

  const pause = () => {
    if (last) return;

    paused.current = true;
    progress.stopAnimation();
    drift.stopAnimation();
  };

  const resume = () => {
    if (!paused.current || last) return;

    paused.current = false;
    progress.stopAnimation((value) => run(value));
  };

  const tap = (event) => {
    Haptics.selectionAsync().catch(() => {});

    const x = event.nativeEvent.locationX;

    if (x < width * 0.3) go(-1);
    else if (!last) go(1);
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  if (connected === false) {
    return <ConnectFirst feature="Monthly recap" />;
  }

  const them = partnerName || "Them";
  const me = myName || "You";
  const sky = SKIES[index % SKIES.length];

  const rise = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  const kenBurns = {
    transform: [
      {
        scale: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [1.04, 1.18],
        }),
      },
      {
        translateX: drift.interpolate({
          inputRange: [0, 1],
          outputRange: index % 2 ? [-12, 12] : [12, -12],
        }),
      },
    ],
  };

  /* ---------- the slides ---------- */

  const body = () => {
    if (!slide) return null;

    switch (slide.kind) {
      case "intro":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <View style={styles.rings}>
              <Animated.View
                style={[
                  styles.ring,
                  styles.ringYou,
                  {
                    transform: [
                      {
                        translateX: enter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-40, 0],
                        }),
                      },
                    ],
                  },
                ]}
              />

              <Animated.View
                style={[
                  styles.ring,
                  styles.ringThem,
                  {
                    transform: [
                      {
                        translateX: enter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [40, 0],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>

            <Text style={styles.kicker}>Your month together</Text>

            <Text style={styles.monthTitle}>{monthName(month)}</Text>

            <Text style={styles.names}>
              {me} & {them}
            </Text>
          </Animated.View>
        );

      case "numbers":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <Text style={styles.kicker}>This month you shared</Text>

            <View style={styles.numberGrid}>
              {slide.numbers.map((item, position) => (
                <View key={item.label} style={styles.numberCell}>
                  <CountUp to={item.n} delay={200 + position * 160} />

                  <Text style={styles.numberLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        );

      case "photo":
      case "dream":
        return (
          <>
            {slide.photo_id ? (
              <Animated.View style={[StyleSheet.absoluteFill, kenBurns]}>
                <RemotePhoto
                  id={slide.photo_id}
                  url={slide.photo_url}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}

            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.75)"]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <Animated.View
              style={[
                styles.caption,
                rise,
                { paddingBottom: insets.bottom + 56 },
              ]}
            >
              <Text style={styles.kicker}>
                {slide.kind === "dream"
                  ? "A dream come true"
                  : shortDate(slide.date)}
              </Text>

              <Text style={styles.captionTitle}>{slide.title}</Text>

              {slide.description ? (
                <Text style={styles.captionText} numberOfLines={4}>
                  {slide.description}
                </Text>
              ) : null}
            </Animated.View>
          </>
        );

      case "moment":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <Text style={styles.kicker}>{shortDate(slide.date)}</Text>

            <Text style={styles.momentTitle}>{slide.title}</Text>

            {slide.description ? (
              <Text style={styles.momentText}>{slide.description}</Text>
            ) : null}
          </Animated.View>
        );

      case "dates":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <Text style={styles.kicker}>
              {slide.dates.length === 1 ? "A date you had" : "Dates you had"}
            </Text>

            {slide.dates.slice(0, 5).map((date, position) => (
              <Animated.View
                key={`${date.title}-${position}`}
                style={[
                  styles.dateRow,
                  {
                    opacity: enter,
                    transform: [
                      {
                        translateX: enter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [position % 2 ? 30 : -30, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.dateTitle}>{date.title}</Text>

                {date.place ? (
                  <Text style={styles.datePlace}>{date.place}</Text>
                ) : null}
              </Animated.View>
            ))}
          </Animated.View>
        );

      case "answer":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <Text style={styles.kicker}>One night you both answered</Text>

            <Text style={styles.question}>{slide.question}</Text>

            <View style={styles.bubbles}>
              <View style={[styles.bubble, styles.bubbleYou]}>
                <Text style={styles.bubbleWho}>{me}</Text>

                <Text style={styles.bubbleText} numberOfLines={5}>
                  {slide.mine}
                </Text>
              </View>

              <View style={[styles.bubble, styles.bubbleThem]}>
                <Text style={styles.bubbleWho}>{them}</Text>

                <Text style={styles.bubbleText} numberOfLines={5}>
                  {slide.theirs}
                </Text>
              </View>
            </View>
          </Animated.View>
        );

      case "games":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <Text style={styles.kicker}>Four in a Row</Text>

            <View style={styles.scoreRow}>
              <View style={styles.scoreSide}>
                <CountUp to={slide.mine} delay={250} />
                <Text style={styles.numberLabel}>{me}</Text>
              </View>

              <Text style={styles.scoreDash}>–</Text>

              <View style={styles.scoreSide}>
                <CountUp to={slide.theirs} delay={450} />
                <Text style={styles.numberLabel}>{them}</Text>
              </View>
            </View>

            <Text style={styles.momentText}>
              {slide.mine === slide.theirs
                ? "Perfectly matched."
                : slide.mine > slide.theirs
                  ? `${me} took the month.`
                  : `${them} took the month.`}
            </Text>
          </Animated.View>
        );

      case "quiet":
      case "outro":
        return (
          <Animated.View style={[styles.centre, rise]}>
            <Text style={styles.kicker}>
              {slide.kind === "quiet" ? "A quiet month" : "That was your month"}
            </Text>

            <Text style={styles.monthTitle}>
              Here's to {monthName(shift(month, 1))}
            </Text>

            <Text style={styles.momentText}>
              {slide.kind === "quiet"
                ? "Nothing saved this time. Plenty of room to make the next one count."
                : "Keep saving the little things. They make the best films."}
            </Text>

            <View style={styles.endButtons}>
              {slide.kind === "outro" ? (
                <Pressable
                  onPress={() => setIndex(0)}
                  style={styles.endButton}
                  accessibilityRole="button"
                >
                  <Icon name="undo" size={16} color="#FFFFFF" />
                  <Text style={styles.endText}>Play Again</Text>
                </Pressable>
              ) : null}

              <View style={styles.monthNav}>
                <Pressable
                  onPress={() => setMonth((current) => shift(current, -1))}
                  style={styles.endButton}
                  accessibilityRole="button"
                >
                  <Icon name="back" size={16} color="#FFFFFF" />
                  <Text style={styles.endText}>
                    {monthName(shift(month, -1))}
                  </Text>
                </Pressable>

                {shift(month, 1) <= lastMonth() ? (
                  <Pressable
                    onPress={() => setMonth((current) => shift(current, 1))}
                    style={styles.endButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.endText}>
                      {monthName(shift(month, 1))}
                    </Text>
                    <Icon name="chevron" size={16} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.screen, { width, height }]}>
      <LinearGradient
        colors={sky}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={tap}
          onLongPress={pause}
          onPressOut={resume}
          delayLongPress={220}
        >
          {body()}
        </Pressable>
      )}

      {/* The bars across the top, one per slide. */}
      <View
        style={[styles.top, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.bars} pointerEvents="none">
          {slides.map((_, position) => (
            <View key={position} style={styles.bar}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      position < index
                        ? "100%"
                        : position > index
                          ? "0%"
                          : progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", "100%"],
                            }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <Pressable
          onPress={close}
          hitSlop={12}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="close" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1A1423",
    overflow: "hidden",
  },

  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
  },

  bars: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },

  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },

  barFill: {
    height: 3,
    backgroundColor: "#FFFFFF",
  },

  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  rings: {
    flexDirection: "row",
    marginBottom: 28,
  },

  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
  },

  ringYou: {
    borderColor: "#F2A3B8",
    backgroundColor: "rgba(217,87,122,0.25)",
    marginRight: -28,
  },

  ringThem: {
    borderColor: "#CDB3DD",
    backgroundColor: "rgba(164,124,192,0.25)",
  },

  kicker: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },

  monthTitle: {
    fontFamily: "ui-serif",
    fontSize: 46,
    lineHeight: 54,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 10,
  },

  names: {
    fontSize: 18,
    color: "rgba(255,255,255,0.85)",
    marginTop: 10,
  },

  numberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 24,
    rowGap: 26,
  },

  numberCell: {
    width: "50%",
    alignItems: "center",
  },

  bigNumber: {
    fontFamily: "ui-rounded",
    fontSize: 56,
    lineHeight: 62,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  numberLabel: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },

  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    gap: 6,
  },

  captionTitle: {
    fontFamily: "ui-serif",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  captionText: {
    fontSize: 16,
    lineHeight: 23,
    color: "rgba(255,255,255,0.9)",
  },

  momentTitle: {
    fontFamily: "ui-serif",
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 12,
  },

  momentText: {
    fontSize: 17,
    lineHeight: 25,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    marginTop: 14,
  },

  dateRow: {
    alignSelf: "stretch",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 12,
  },

  dateTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  datePlace: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  question: {
    fontFamily: "ui-serif",
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 12,
  },

  bubbles: {
    alignSelf: "stretch",
    gap: 12,
    marginTop: 24,
  },

  bubble: {
    padding: 16,
    borderRadius: 20,
    maxWidth: "88%",
  },

  bubbleYou: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(217,87,122,0.85)",
    borderBottomRightRadius: 6,
  },

  bubbleThem: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderBottomLeftRadius: 6,
  },

  bubbleWho: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
  },

  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
  },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginTop: 18,
  },

  scoreSide: {
    alignItems: "center",
  },

  scoreDash: {
    fontSize: 40,
    color: "rgba(255,255,255,0.5)",
  },

  endButtons: {
    alignItems: "center",
    gap: 12,
    marginTop: 32,
  },

  monthNav: {
    flexDirection: "row",
    gap: 10,
  },

  endButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  endText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
