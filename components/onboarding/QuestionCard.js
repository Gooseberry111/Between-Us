import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";

import { T } from "../../lib/theme";
import { Cell, Check, Group, GroupFooter, Icon } from "../ui";
import DateInput from "../DateInput";

/*
 * ==========================================
 * QUESTION
 * ==========================================
 *
 * One question, asked the way iOS asks:
 *
 *   text / date   one large field in a group
 *   single        a list with a checkmark on the choice,
 *                 like picking a ringtone in Settings
 *   multi         a list of round checks, any number
 *
 * "Other" is only useful if you can say what the other
 * thing is. Choosing it opens a field in its row, and
 * whatever is typed becomes the answer -- stored exactly
 * like any chosen option, so everything downstream treats
 * it the same.
 */

const isOtherOption = (option) => /^other/i.test(String(option).trim());

export default function QuestionCard({ question, value, onChange }) {
  const [writingOther, setWritingOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  if (!question) return null;

  const options = question.options || [];
  const multi = question.type === "multi";

  const values = Array.isArray(value) ? value : value ? [value] : [];

  /* A value nobody offered must have been written in. */
  const customValue = values.find(
    (item) => item && !options.some((option) => option === item),
  );

  const otherOpen = writingOther || Boolean(customValue);

  const isSelected = (option) => {
    if (isOtherOption(option)) return otherOpen;

    return multi ? values.includes(option) : value === option;
  };

  const tap = () => Haptics.selectionAsync().catch(() => {});

  const choose = (option) => {
    tap();

    if (isOtherOption(option)) {
      setOtherText(customValue || "");
      setWritingOther(true);

      return;
    }

    if (multi) {
      onChange(
        values.includes(option)
          ? values.filter((item) => item !== option)
          : [...values, option],
      );

      return;
    }

    setWritingOther(false);
    onChange(option);
  };

  const saveOther = (text) => {
    setOtherText(text);

    const trimmed = text.trim();

    if (multi) {
      const kept = values.filter((item) => options.includes(item));

      onChange(trimmed ? [...kept, trimmed] : kept);

      return;
    }

    onChange(trimmed);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{question.title}</Text>

        {question.subtitle ? (
          <Text style={styles.subtitle}>{question.subtitle}</Text>
        ) : multi ? (
          <Text style={styles.subtitle}>Choose any that fit.</Text>
        ) : null}
      </View>

      {question.type === "text" ? (
        <Group>
          <TextInput
            style={styles.input}
            placeholder={question.placeholder}
            placeholderTextColor={T.label3}
            value={value || ""}
            onChangeText={onChange}
            autoFocus
            returnKeyType="done"
          />
        </Group>
      ) : null}

      {question.type === "date" ? (
        <>
          <Group>
            <DateInput
              style={styles.input}
              placeholder={question.placeholder}
              placeholderTextColor={T.label3}
              value={value || ""}
              onChangeText={onChange}
            />
          </Group>

          <GroupFooter>
            Year, month, day. The dashes fill themselves in.
          </GroupFooter>
        </>
      ) : null}

      {question.type === "single" || multi ? (
        <Group inset={multi ? 50 : 16}>
          {options.map((option) => {
            const selected = isSelected(option);

            if (isOtherOption(option) && otherOpen) {
              return (
                <View key={option} style={styles.otherRow}>
                  {multi ? <Check on onPress={() => {}} /> : null}

                  <TextInput
                    style={styles.otherInput}
                    placeholder={
                      question.otherPlaceholder || "Type your answer"
                    }
                    placeholderTextColor={T.label3}
                    value={writingOther ? otherText : customValue || ""}
                    onChangeText={saveOther}
                    autoFocus
                    returnKeyType="done"
                  />

                  {!multi ? (
                    <Icon name="check" size={18} color={T.accent} />
                  ) : null}
                </View>
              );
            }

            return (
              <Cell
                key={option}
                leading={
                  multi ? (
                    <Check on={selected} onPress={() => choose(option)} />
                  ) : null
                }
                title={option}
                trailing={
                  !multi && selected ? (
                    <Icon name="check" size={18} color={T.accent} />
                  ) : null
                }
                onPress={() => choose(option)}
              />
            );
          })}
        </Group>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },

  head: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },

  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: T.label,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    marginTop: 6,
  },

  input: {
    fontSize: 19,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 54,
  },

  otherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },

  otherInput: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 12,
  },
});
