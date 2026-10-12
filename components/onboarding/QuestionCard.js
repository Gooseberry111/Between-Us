import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import OptionButton from "./OptionButton";
import DateInput from "../DateInput";

export default function QuestionCard({ question, value, onChange }) {
  /*
   * "Other" is only useful if you can say what the other
   * thing is. Choosing it opens a field, and whatever is
   * typed becomes the answer -- stored exactly like any
   * chosen option, so everything downstream (trivia,
   * insights, your partner's view) treats it the same.
   */
  const [writingOther, setWritingOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  if (!question) return null;

  const options = question.options || [];

  const isOtherOption = (option) => /^other/i.test(String(option).trim());

  const values = Array.isArray(value) ? value : value ? [value] : [];

  /* A value nobody offered must have been written in. */
  const customValue = values.find(
    (item) => item && !options.some((option) => option === item),
  );

  const isSelected = (option) => {
    if (isOtherOption(option)) {
      return writingOther || Boolean(customValue);
    }

    if (Array.isArray(value)) {
      return value.includes(option);
    }

    return value === option;
  };

  const openOther = () => {
    setOtherText(customValue || "");
    setWritingOther(true);
  };

  const saveOther = (text) => {
    setOtherText(text);

    const trimmed = text.trim();

    if (question.type === "multi") {
      const kept = values.filter((item) => options.includes(item));

      onChange(trimmed ? [...kept, trimmed] : kept);

      return;
    }

    onChange(trimmed);
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

      {question.subtitle ? (
        <Text style={styles.subtitle}>{question.subtitle}</Text>
      ) : null}

      {question.type === "text" && (
        <TextInput
          style={styles.input}
          placeholder={question.placeholder}
          placeholderTextColor="rgba(60,60,67,0.6)"
          value={value || ""}
          onChangeText={onChange}
        />
      )}

      {question.type === "date" && (
        <DateInput
          style={styles.input}
          placeholder={question.placeholder}
          placeholderTextColor="rgba(60,60,67,0.6)"
          value={value || ""}
          onChangeText={onChange}
        />
      )}

      {question.type === "single" &&
        options.map((option) =>
          isOtherOption(option) ? (
            <OtherOption
              key={option}
              label={option}
              selected={isSelected(option)}
              open={writingOther || Boolean(customValue)}
              text={writingOther ? otherText : customValue || ""}
              placeholder={question.otherPlaceholder || "Type your answer"}
              onOpen={openOther}
              onChangeText={saveOther}
            />
          ) : (
            <OptionButton
              key={option}
              label={option}
              selected={isSelected(option)}
              onPress={() => {
                setWritingOther(false);
                onChange(option);
              }}
            />
          ),
        )}

      {question.type === "multi" &&
        options.map((option) =>
          isOtherOption(option) ? (
            <OtherOption
              key={option}
              label={option}
              selected={isSelected(option)}
              open={writingOther || Boolean(customValue)}
              text={writingOther ? otherText : customValue || ""}
              placeholder={question.otherPlaceholder || "Type your answer"}
              onOpen={openOther}
              onChangeText={saveOther}
            />
          ) : (
            <OptionButton
              key={option}
              label={option}
              selected={isSelected(option)}
              onPress={() => handleMultiSelect(option)}
            />
          ),
        )}
    </View>
  );
}

/*
 * The "Other" row: a normal option until it is chosen,
 * then a field that looks like the answer it becomes.
 */
function OtherOption({
  label,
  selected,
  open,
  text,
  placeholder,
  onOpen,
  onChangeText,
}) {
  if (!open) {
    return <OptionButton label={label} selected={selected} onPress={onOpen} />;
  }

  return (
    <View style={styles.otherWrap}>
      <Text style={styles.otherLabel}>{label}</Text>

      <TextInput
        style={styles.otherInput}
        placeholder={placeholder}
        placeholderTextColor="rgba(60,60,67,0.6)"
        value={text}
        onChangeText={onChangeText}
        autoFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  otherWrap: {
    borderWidth: 1.5,
    borderColor: "#4A2D5C",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    marginBottom: 10,
  },

  otherLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#4A2D5C",
  },

  otherInput: {
    fontSize: 15,
    color: "#111114",
    paddingVertical: 8,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: "#8B807A",
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111114",
    marginBottom: 24,
    lineHeight: 38,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E6EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: "#111114",
  },
});
