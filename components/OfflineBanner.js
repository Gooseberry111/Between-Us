import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { onReachabilityChange } from "../lib/api";

/*
 * ==========================================
 * OFFLINE BANNER
 * ==========================================
 *
 * Every screen here needs the network, and without
 * this each one blames itself: "Unable to load your
 * home", "Unable to search". One honest line at the
 * top says what is actually wrong.
 *
 * It listens to the requests the app already makes,
 * so it needs no native connectivity module and can
 * ship in an over-the-air update.
 */

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const slide = useRef(new Animated.Value(-160)).current;

  useEffect(() => onReachabilityChange((online) => setOffline(!online)), []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 0 : -160,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [offline, slide]);

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY: slide }] }]}
      pointerEvents="none"
    >
      <View style={styles.banner}>
        <Text style={styles.text}>
          You&apos;re offline. We&apos;ll reconnect on your next tap.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },

  banner: {
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: "#6E2743",
  },

  text: {
    fontFamily: "Nunito_600SemiBold",
    color: "#F6EBE5",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
