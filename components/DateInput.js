import { TextInput } from "react-native";

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
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeText(formatDateDigits(text))}
      placeholder={placeholder || "YYYY-MM-DD"}
      placeholderTextColor={placeholderTextColor || "#A59A93"}
      keyboardType="number-pad"
      maxLength={10}
      style={style}
      {...rest}
    />
  );
}
