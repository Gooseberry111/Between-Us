import { ActionSheetIOS, Alert, Platform } from "react-native";

/*
 * ==========================================
 * ACTION SHEET
 * ==========================================
 *
 * The menu iOS slides up when you tap a row that can do
 * more than one thing. Android gets the same choices as
 * an alert.
 *
 *   chooseAction({
 *     title: "Dinner at Nok",
 *     options: [
 *       { label: "We Did This", onPress },
 *       { label: "Remove", destructive: true, onPress },
 *     ],
 *   })
 */
export function chooseAction({ title, message, options }) {
  if (Platform.OS === "ios") {
    const labels = [...options.map((option) => option.label), "Cancel"];
    const destructive = options.findIndex((option) => option.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: destructive === -1 ? undefined : destructive,
      },
      (index) => {
        if (index < options.length) options[index].onPress?.();
      },
    );

    return;
  }

  Alert.alert(title || "", message, [
    ...options.map((option) => ({
      text: option.label,
      style: option.destructive ? "destructive" : "default",
      onPress: option.onPress,
    })),
    { text: "Cancel", style: "cancel" },
  ]);
}

/*
 * Before throwing away something typed: "Discard what
 * you've written?" Keep Editing is the safe default.
 */
export function confirmDiscard(onDiscard) {
  Alert.alert(
    "Discard what you've written?",
    "It hasn't been saved, so it will be lost.",
    [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onDiscard },
    ],
  );
}
