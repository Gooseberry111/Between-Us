import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useAuth } from "@clerk/expo";

import { apiFetch } from "../lib/api";
import { onHug } from "../lib/hugs";
import { T, themedStyles, useTheme } from "../lib/theme";
import { Button, Icon, motionAllowed } from "./ui";

/*
 * ==========================================
 * A HUG ARRIVING
 * ==========================================
 *
 * The screen softens, two rings drift in and hold each
 * other, a heart swells between them, and the phone gives
 * a slow heartbeat. Then the choice is theirs:
 *
 *   Accept     lets them know it landed -- their phone
 *              bursts into little hearts
 *   Reject     their phone shows a heart breaking in two
 *
 * Tapping anywhere else just closes it.
 *
 * Mounted once at the root, played through lib/hugs.
 */

const SIZE = 96;

/* After answering, how long the reply line shows. */
const REPLY_MS = 1300;

function heartbeat() {
  const tap = (style, at) =>
    setTimeout(() => Haptics.impactAsync(style).catch(() => {}), at);

  tap(Haptics.ImpactFeedbackStyle.Soft, 0);
  tap(Haptics.ImpactFeedbackStyle.Medium, 160);
  tap(Haptics.ImpactFeedbackStyle.Soft, 900);
  tap(Haptics.ImpactFeedbackStyle.Medium, 1060);

  setTimeout(
    () =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      ),
    1700,
  );
}

export default function HugOverlay() {
  useTheme();

  const { userId } = useAuth();

  const [hug, setHug] = useState(null);
  const [reply, setReply] = useState(null);

  const shown = useRef(new Animated.Value(0)).current;
  const meet = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;

  useEffect(
    () =>
      onHug(({ from }) => {
        setReply(null);
        setHug({ from: from || "Your person", at: Date.now() });
      }),
    [],
  );

  useEffect(() => {
    if (!hug) return undefined;

    shown.setValue(0);
    meet.setValue(0);
    heart.setValue(0);

    heartbeat();

    motionAllowed().then((allowed) => {
      if (!allowed) {
        shown.setValue(1);
        meet.setValue(1);
        heart.setValue(1);
        return;
      }

      Animated.parallel([
        Animated.timing(shown, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(meet, {
          toValue: 1,
          friction: 6,
          tension: 34,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(420),
          Animated.spring(heart, {
            toValue: 1,
            friction: 4,
            tension: 90,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    return undefined;
  }, [hug]);

  const close = () => {
    Animated.timing(shown, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setHug(null));
  };

  /* Answer, show a line saying so, then let go. */
  const answer = (kind) => {
    const path = kind === "accept" ? "hug/accept" : "hug/decline";

    Haptics.impactAsync(
      kind === "accept"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});

    if (userId) {
      apiFetch(`/users/${userId}/${path}`, {
        method: "POST",
        body: JSON.stringify({ clerk_id: userId }),
      }).catch(() => {});
    }

    setReply(
      kind === "accept"
        ? `${hug.from} will know you felt it`
        : `${hug.from} will see their hug was rejected`,
    );

    setTimeout(close, REPLY_MS);
  };

  if (!hug) return null;

  const drift = (direction) =>
    meet.interpolate({
      inputRange: [0, 1],
      outputRange: [direction * 70, 0],
    });

  return (
    <Animated.View style={[styles.root, { opacity: shown }]}>
      {/* Behind the content, so its buttons never fire it too. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />

      <View style={styles.centre} pointerEvents="box-none">
        <View style={styles.mark}>
          <Animated.View
            style={[
              styles.ring,
              styles.ringYou,
              { transform: [{ translateX: drift(-1) }] },
            ]}
          />

          <Animated.View
            style={[
              styles.ring,
              styles.ringThem,
              { transform: [{ translateX: drift(1) }] },
            ]}
          />

          <Animated.View
            style={[
              styles.heart,
              {
                opacity: heart,
                transform: [
                  {
                    scale: heart.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Icon name="heart" size={30} color={T.you} filled />
          </Animated.View>
        </View>

        <Text style={styles.title}>{hug.from} sent you a hug</Text>

        {reply ? (
          <Text style={styles.text}>{reply}</Text>
        ) : (
          <View style={styles.choices}>
            <Button
              title="Accept Hug"
              icon="heart"
              onPress={() => answer("accept")}
            />

            <Button
              title="Reject Hug"
              kind="plain"
              onPress={() => answer("decline")}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 300,
    backgroundColor: T.dark ? "rgba(14,12,17,0.94)" : "rgba(236,235,242,0.94)",
  },

  choices: {
    alignSelf: "stretch",
    marginTop: 26,
    gap: 4,
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  mark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 5,
  },

  ringYou: {
    backgroundColor: "rgba(217,87,122,0.14)",
    borderColor: T.you,
    marginRight: -SIZE * 0.34,
  },

  ringThem: {
    backgroundColor: "rgba(74,45,92,0.12)",
    borderColor: T.accent,
  },

  heart: {
    position: "absolute",
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: T.label,
    textAlign: "center",
    marginTop: 30,
  },

  text: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    textAlign: "center",
    marginTop: 6,
  },
}));
