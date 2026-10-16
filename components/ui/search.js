import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { T } from "../../lib/theme";
import Icon from "./Icon";

/*
 * The iOS search field: a magnifying glass, a soft gray
 * capsule-ish box, a spinner while it looks, and the
 * clear button once something is typed.
 */
export function SearchField({
  value,
  onChangeText,
  busy,
  placeholder,
  ...input
}) {
  return (
    <View style={styles.field}>
      <Icon name="search" size={17} color={T.label2} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || "Search"}
        placeholderTextColor={T.label2}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        returnKeyType="search"
        {...input}
      />

      {busy ? (
        <ActivityIndicator size="small" color={T.label2} />
      ) : value ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear"
        >
          <View style={styles.clear}>
            <Icon name="close" size={10} color={T.surface} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 10,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: T.fill2,
  },

  input: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 9,
  },

  clear: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: T.label3,
    alignItems: "center",
    justifyContent: "center",
  },
});
