import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import OptionButton from "./OptionButton";

export default function QuestionCard({ question, value, onChange }) {
  if (!question) return null;

  const isSelected = (option) => {
    if (Array.isArray(value)) {
      return value.includes(option);
    }

    return value === option;
  };

  const handleMultiSelect = (option) => {
    const current = Array.isArray(value) ? value : [];

    if (current.includes(option)) {
      onChange(current.filter((item) => item !== option));
    } else {
      onChange([...current, option]);
    }
  };

  return (
    <View>
      <Text style={styles.title}>{question.title}</Text>

      {question.type === "text" && (
        <TextInput
          style={styles.input}
          placeholder={question.placeholder}
          placeholderTextColor="#9A938C"
          value={value || ""}
          onChangeText={onChange}
        />
      )}

      {question.type === "single" &&
        question.options.map((option) => (
          <OptionButton
            key={option}
            label={option}
            selected={isSelected(option)}
            onPress={() => onChange(option)}
          />
        ))}

      {question.type === "multi" &&
        question.options.map((option) => (
          <OptionButton
            key={option}
            label={option}
            selected={isSelected(option)}
            onPress={() => handleMultiSelect(option)}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#2E2724",
    marginBottom: 24,
    lineHeight: 38,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4DDD6",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: "#2E2724",
  },
});
