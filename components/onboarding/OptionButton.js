import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function OptionButton({ selected, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.button, selected && styles.selected]}
      onPress={onPress}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E6EB",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  selected: {
    backgroundColor: "#F1EAE5",
    borderColor: "#4A2D5C",
  },

  text: {
    color: "#111114",
    fontSize: 15,
  },

  selectedText: {
    color: "#4A2D5C",
    fontWeight: "600",
  },
});
