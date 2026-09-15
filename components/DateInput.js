import { useId } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/*
 * ==========================================
 * DATE INPUT
 * ==========================================
 *
 * A plain text field that auto-inserts the "-"
 * separators as the user types digits, so nobody
 * has to type YYYY-MM-DD by hand.
 *
 * Always reports back a plain "YYYY-MM-DD" (or
 * partial) string through onChangeText, same as a
 * normal TextInput would.
 */

export function formatDateDigits(rawText) {
  const digitsOnly = String(rawText || "")
    .replace(/\D/g, "")
    .slice(0, 8);

  if (digitsOnly.length <= 4) {
    return digitsOnly;
  }

  if (digitsOnly.length <= 6) {
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
  }

  return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6)}`;
}

export default function DateInput({
  value,
  onChangeText,
  style,
  placeholder,
  placeholderTextColor,
  ...rest
}) {
  /*
   * iOS's number pad has no Done or Return key, so once it
   * is open there is no way to close it -- and it covers
   * whatever button sits below the field. An accessory bar
   * above the keyboard gives it a Done button.
   */
  const accessoryId = `date-input-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <>
      <TextInput
        value={value}
        onChangeText={(text) => {
          const formatted = formatDateDigits(text);

          onChangeText(formatted);

          /* A complete date needs nothing more typed. */
          if (formatted.length === 10) {
            Keyboard.dismiss();
          }
        }}
        placeholder={placeholder || "YYYY-MM-DD"}
        placeholderTextColor={placeholderTextColor || "#A59A93"}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={10}
        inputAccessoryViewID={Platform.OS === "ios" ? accessoryId : undefined}
        style={style}
        {...rest}
      />

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={styles.bar}>
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.doneButton}
              activeOpacity={0.7}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F4EFEB",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D9CFC9",
  },

  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  doneText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B4E45",
  },
});
