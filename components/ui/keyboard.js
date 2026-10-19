import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

/*
 * ==========================================
 * KEYBOARD
 * ==========================================
 *
 * Android draws edge to edge, so the screen no longer
 * shrinks when the keyboard opens and anything near the
 * bottom ends up underneath it. Two fixes, used together:
 *
 *   keyboardBehavior   KeyboardAvoidingView pads by the
 *                      keyboard's height on both systems
 *   KeyboardScroll     a ScrollView that, when the keyboard
 *                      opens, scrolls the field you are in
 *                      into view
 */

export const keyboardBehavior = "padding";

/* Room left above the field once it has been scrolled to. */
const ABOVE_FIELD = 96;

export const KeyboardScroll = forwardRef(function KeyboardScroll(
  { children, contentContainerStyle, ...props },
  ref,
) {
  const scroller = useRef(null);
  const content = useRef(null);

  useImperativeHandle(ref, () => scroller.current);

  useEffect(() => {
    const event =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const subscription = Keyboard.addListener(event, () => {
      /* Give the padding a frame to apply before measuring. */
      setTimeout(() => {
        const input = TextInput.State.currentlyFocusedInput?.();

        if (!input || !content.current) return;

        try {
          input.measureLayout(
            content.current,
            (x, y) => {
              scroller.current?.scrollTo({
                y: Math.max(0, y - ABOVE_FIELD),
                animated: true,
              });
            },
            () => {},
          );
        } catch {
          /* The focused field is not inside this list. */
        }
      }, 60);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ScrollView
      ref={scroller}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentContainerStyle={styles.grow}
      {...props}
    >
      <View
        ref={content}
        collapsable={false}
        style={[styles.grow, contentContainerStyle]}
      >
        {children}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
});
