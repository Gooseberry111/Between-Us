import { StyleSheet, View } from "react-native";

import { T } from "../../lib/theme";

/* A thin bar, filled to the question you are on. */
export default function ProgressBar({ current, total }) {
  const percentage = ((current + 1) / total) * 100;

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${percentage}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.fill3,
    overflow: "hidden",
  },

  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.accent,
  },
});
