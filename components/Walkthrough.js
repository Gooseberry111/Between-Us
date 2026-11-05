import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@clerk/expo";

import { onTour } from "../lib/tour";
import { T, themedStyles, useTheme } from "../lib/theme";
import { Button } from "./ui";

/*
 * ==========================================
 * THE TOUR
 * ==========================================
 *
 * The first time a couple is linked, a short walk through
 * everything the app does, a card at a time. Swipe or tap
 * Next; Skip whenever you like. Settings can play it again.
 */

const PAGES = [
  {
    emoji: "💞",
    sky: ["#2B1A36", "#4A2D5C", "#7A3E62"],
    title: "You're linked",
    text: "Between Us is a private space for just the two of you. Here's a quick look round. It takes a minute, and you can skip it.",
  },
  {
    emoji: "🫶",
    sky: ["#3A1F2E", "#7A2E4C", "#D9577A"],
    title: "Your two circles",
    text: 'Home starts with the two of you. Hold the heart between your circles to send a hug, and they can accept it or not. Tap their circle for a kiss, a "miss you" and more.',
  },
  {
    emoji: "🌙",
    sky: ["#1E1B2E", "#3B2F5A", "#6B4E8A"],
    title: "Tonight's questions",
    text: "Three new questions every evening. Answer yours to unlock theirs, and keep your streak going.",
  },
  {
    emoji: "😊",
    sky: ["#2A2016", "#6B4A1F", "#C9973F"],
    title: "How you're feeling",
    text: "Tap the little badge on your circle to share your mood. They see it on their phone, so they know when to go gently.",
  },
  {
    emoji: "📸",
    sky: ["#1A1423", "#4A2D5C", "#D9577A"],
    title: "Your story",
    text: "Timeline keeps your memories, date nights and special days with photos. Once a month, your recap plays back like a film.",
  },
  {
    emoji: "📍",
    sky: ["#13253A", "#1F4E6B", "#3E8E9C"],
    title: "Dates, near you",
    text: "Dates finds places around you on a map. Pick one, choose a time and send it. It's saved as soon as they say yes.",
  },
  {
    emoji: "💌",
    sky: ["#3A1F2E", "#6E2E52", "#B5507A"],
    title: "Notes and letters",
    text: "Leave notes and voice notes, and reply to any one of them. Letters stay sealed until the day you choose.",
  },
  {
    emoji: "🎮",
    sky: ["#1D2B1A", "#3E5E33", "#7A9A3E"],
    title: "Play together",
    text: "Paintball Standoff, Tank Duel, Four in a Row, trivia, This or That and more. You'll hear when it's your turn.",
  },
  {
    emoji: "✨",
    sky: ["#2B1A36", "#4A2D5C", "#C9973F"],
    title: "Everything else",
    text: "The ☰ menu on Home has Dreams, Goals, Notes and the rest. Add extras like gift ideas or Far apart in Features.",
  },
];

const seenKey = (userId) => `between-us.tour.${userId}`;

/* Called from Home: plays the tour once per person, ever. */
export function tourSeen(userId) {
  try {
    return Boolean(SecureStore.getItem(seenKey(userId)));
  } catch {
    return true;
  }
}

export default function Walkthrough() {
  useTheme();

  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pager = useRef(null);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(
    () =>
      onTour(() => {
        setPage(0);
        setOpen(true);
      }),
    [],
  );

  useEffect(() => {
    pop.setValue(0.6);
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [page, pop]);

  const finish = () => {
    try {
      if (userId) SecureStore.setItem(seenKey(userId), "1");
    } catch {
      /* it may show once more; no harm */
    }

    setOpen(false);
  };

  const go = (next) => {
    if (next >= PAGES.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      finish();
      return;
    }

    Haptics.selectionAsync().catch(() => {});
    pager.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  if (!open) return null;

  const last = page === PAGES.length - 1;

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={finish}
      statusBarTranslucent
    >
      <LinearGradient colors={PAGES[page].sky} style={styles.root}>
        <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
          <View style={styles.dots}>
            {PAGES.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === page && styles.dotOn]}
              />
            ))}
          </View>

          {!last ? (
            <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setPage(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        >
          {PAGES.map((item, index) => (
            <View key={item.title} style={[styles.page, { width }]}>
              <Animated.View
                style={[
                  styles.badge,
                  { transform: [{ scale: index === page ? pop : 1 }] },
                ]}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
              </Animated.View>

              <Text style={styles.title}>{item.title}</Text>

              <Text style={styles.text}>{item.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
          <Button
            title={last ? "Let's go" : page === 0 ? "Show me" : "Next"}
            onPress={() => go(page + 1)}
          />
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
  },

  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    minHeight: 44,
  },

  dots: {
    flexDirection: "row",
    gap: 6,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  dotOn: {
    width: 20,
    backgroundColor: "#FFFFFF",
  },

  skip: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },

  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 18,
  },

  badge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emoji: {
    fontSize: 72,
  },

  title: {
    fontFamily: "ui-serif",
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },

  text: {
    fontSize: 17,
    lineHeight: 25,
    color: "rgba(255,255,255,0.86)",
    textAlign: "center",
  },

  bottom: {
    paddingHorizontal: 24,
  },
}));
