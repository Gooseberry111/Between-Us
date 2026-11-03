import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { Icon, Press } from "./ui";

/*
 * ==========================================
 * THE RECAP, ON THE TIMELINE
 * ==========================================
 *
 * Last month as a film poster at the top of your story:
 * the same night sky the film opens on, a strip of
 * sprocket holes along each edge, and a play button.
 * Your story is where looking back belongs.
 */

const SKY = ["#2B1A36", "#4A2D5C", "#7A3E62"];
const HOLES = Array.from({ length: 14 });

function lastMonth() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    name: date.toLocaleDateString(undefined, { month: "long" }),
  };
}

function Sprockets() {
  return (
    <View style={styles.strip} pointerEvents="none">
      {HOLES.map((_, index) => (
        <View key={index} style={styles.hole} />
      ))}
    </View>
  );
}

export default function RecapCard() {
  const router = useRouter();
  const month = lastMonth();

  return (
    <Press
      onPress={() => router.push(`/recap?month=${month.key}`)}
      accessibilityLabel={`Play your ${month.name} together`}
      outerStyle={styles.wrap}
    >
      <LinearGradient
        colors={SKY}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Sprockets />

        <View style={styles.body}>
          <View style={styles.text}>
            <Text style={styles.kicker}>Monthly recap</Text>

            <Text style={styles.title}>Your {month.name} together</Text>

            <Text style={styles.sub}>Played back like a film</Text>
          </View>

          <View style={styles.play}>
            <Icon name="play" size={20} color="#4A2D5C" />
          </View>
        </View>

        <Sprockets />
      </LinearGradient>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
  },

  card: {
    borderRadius: 22,
    overflow: "hidden",
    paddingVertical: 8,
  },

  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },

  hole: {
    width: 9,
    height: 6,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },

  text: {
    flex: 1,
  },

  kicker: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#E0B15A",
  },

  title: {
    fontFamily: "ui-serif",
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 4,
  },

  sub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    marginTop: 3,
  },

  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
});
