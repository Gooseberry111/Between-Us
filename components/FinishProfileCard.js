import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FadeIn, GlassPanel } from "./Glass";
import { TOTAL_QUESTIONS } from "../lib/profileProgress";

/*
 * ==========================================
 * FINISH YOUR PROFILE
 * ==========================================
 *
 * Sits at the top of Home until every onboarding
 * question is answered. Trivia, insights and the
 * partner view all draw on those answers, so this
 * outranks everything else on the screen.
 */

export default function FinishProfileCard({ answered, onPress }) {
  const remaining = Math.max(0, TOTAL_QUESTIONS - answered);
  const percentage = Math.round((answered / TOTAL_QUESTIONS) * 100);

  return (
    <FadeIn delay={20}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Finish your profile. ${remaining} questions left.`}
      >
        <GlassPanel tone="plum" style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.pill}>
              <Ionicons name="sparkles" size={11} color="#7A4A5C" />
              <Text style={styles.pillText}>PRIORITY</Text>
            </View>

            <Text style={styles.percent}>{percentage}%</Text>
          </View>

          <Text style={styles.title}>Finish your profile</Text>

          <Text style={styles.body}>
            {remaining === 1
              ? "Just 1 question left."
              : `${remaining} quick questions left.`}{" "}
            Your trivia, insights and what your partner sees all get better
            with them.
          </Text>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percentage}%` }]} />
          </View>

          <View style={styles.button}>
            <Text style={styles.buttonText}>Pick up where you left off</Text>
            <Ionicons name="arrow-forward" size={16} color="#5A3444" />
          </View>
        </GlassPanel>
      </Pressable>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F6E7EC",
  },

  pillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#7A4A5C",
  },

  percent: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F3DDE5",
  },

  title: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  body: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#F0DCE3",
  },

  track: {
    marginTop: 16,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  button: {
    marginTop: 16,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5A3444",
  },
});
