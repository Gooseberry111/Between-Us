import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { T } from "../../lib/theme";

/*
 * ==========================================
 * PASSWORD FIELD
 * ==========================================
 *
 * A filled field with an eye to reveal what you typed,
 * because typing a password blind on a phone keyboard
 * is how people end up locked out of their own
 * account.
 *
 * Shows the one rule that matters as you type rather
 * than after you submit.
 */

export const PASSWORD_MINIMUM = 8;

export function passwordProblem(value) {
  const password = String(value || "");

  if (password.length < PASSWORD_MINIMUM) {
    return `At least ${PASSWORD_MINIMUM} characters.`;
  }

  return null;
}

export default function PasswordField({
  value,
  onChangeText,
  placeholder = "Password",
  label,
  showRule,
  autoComplete = "current-password",
  textContentType = "password",
  onSubmitEditing,
}) {
  const [revealed, setRevealed] = useState(false);

  const problem = showRule ? passwordProblem(value) : null;

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.label3}
          secureTextEntry={!revealed}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          onSubmitEditing={onSubmitEditing}
          style={styles.input}
        />

        <Pressable
          onPress={() => setRevealed((current) => !current)}
          hitSlop={10}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={revealed ? "Hide password" : "Show password"}
        >
          <Ionicons
            name={revealed ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={T.label2}
          />
        </Pressable>
      </View>

      {showRule && value ? (
        <Text style={[styles.rule, !problem && styles.ruleOk]}>
          {problem || "Long enough."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
    marginBottom: 7,
  },

  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    backgroundColor: T.surface,
    paddingLeft: 16,
    paddingRight: 8,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: T.label,
  },

  eye: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  rule: {
    fontSize: 12.5,
    color: T.label2,
    marginTop: 6,
    marginLeft: 4,
  },

  ruleOk: {
    color: "#1E8E3E",
  },
});
