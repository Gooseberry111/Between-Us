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
    borderColor: "#F2DDE5",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  selected: {
    backgroundColor: "#F1EAE5",
    borderColor: "#D9456B",
  },

  text: {
    fontFamily: "Nunito_400Regular",
    color: "#4A3B45",
    fontSize: 15,
  },

  selectedText: {
    fontFamily: "Nunito_600SemiBold",
    color: "#D9456B",
    fontWeight: "600",
  },
});
