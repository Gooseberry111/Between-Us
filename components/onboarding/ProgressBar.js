import { View, StyleSheet } from "react-native";

export default function ProgressBar({ current, total }) {
  const percentage = ((current + 1) / total) * 100;

  return (
    <View style={styles.background}>
      <View
        style={[
          styles.fill,
          {
            width: `${percentage}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    height: 8,
    backgroundColor: "#E9E6EB",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 24,
  },

  fill: {
    height: "100%",
    backgroundColor: "#4A2D5C",
    borderRadius: 999,
  },
});
