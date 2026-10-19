import { forwardRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { T } from "../../lib/theme";
import Icon from "./Icon";
import { GlassButton } from "./layout";
import { KeyboardScroll, keyboardBehavior } from "./keyboard";

/*
 * ==========================================
 * BEFORE YOU ARE LINKED
 * ==========================================
 *
 * The welcome, sign in, sign up, onboarding and finding
 * your person. The prototype only draws the linked app,
 * so these carry its language over: the bond's glow,
 * rose for you and plum for them, the two circles of the
 * splash, and Settings-style grouped fields.
 */

/* The bond's glow: rose on the left, plum on the right. */
export function Glow({ height = 360 }) {
  return (
    <View style={[styles.glow, { height }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="authYou" cx="22%" cy="40%" rx="55%" ry="48%">
            <Stop offset="0" stopColor={T.you} stopOpacity="0.26" />
            <Stop offset="0.75" stopColor={T.you} stopOpacity="0" />
          </RadialGradient>

          <RadialGradient id="authThem" cx="80%" cy="34%" rx="55%" ry="50%">
            <Stop offset="0" stopColor={T.accent} stopOpacity="0.22" />
            <Stop offset="0.75" stopColor={T.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect width="100%" height="100%" fill="url(#authYou)" />
        <Rect width="100%" height="100%" fill="url(#authThem)" />
      </Svg>
    </View>
  );
}

/* The splash's mark on a light ground: you and them, overlapping. */
export function Mark({ size = 56 }) {
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: Math.max(2, size / 22),
  };

  return (
    <View style={styles.mark} accessibilityElementsHidden>
      <View
        style={[
          circle,
          {
            backgroundColor: "rgba(217,87,122,0.14)",
            borderColor: T.you,
            marginRight: -size * 0.34,
          },
        ]}
      />

      <View
        style={[
          circle,
          { backgroundColor: "rgba(74,45,92,0.12)", borderColor: T.accent },
        ]}
      />
    </View>
  );
}

/*
 * The shell: the glow behind, an optional back button,
 * content that scrolls clear of the keyboard, and an
 * optional footer pinned to the bottom.
 */
export function AuthScreen({ children, onBack, footer, centred }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Glow />

      <KeyboardAvoidingView style={styles.fill} behavior={keyboardBehavior}>
        {onBack ? (
          <View style={styles.nav}>
            <GlassButton icon="back" label="Back" onPress={onBack} />
          </View>
        ) : null}

        <KeyboardScroll
          contentContainerStyle={[styles.content, centred && styles.centred]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </KeyboardScroll>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* The mark, a title and a line under it, centred. */
export function AuthHeader({ title, subtitle, mark = true, kicker }) {
  return (
    <View style={styles.header}>
      {mark ? <Mark /> : null}

      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}

      <Text style={styles.title}>{title}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/*
 * A Settings-style row for a grouped form: the label on
 * the left, what you type on the right. Goes inside a
 * Group.
 */
export const FieldRow = forwardRef(function FieldRow(
  { label, trailing, ...input },
  ref,
) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>

      <TextInput
        ref={ref}
        placeholderTextColor={T.label3}
        style={styles.rowInput}
        {...input}
      />

      {trailing}
    </View>
  );
});

/* A password row with the eye that shows what you typed. */
export const PasswordRow = forwardRef(function PasswordRow(
  { label = "Password", ...input },
  ref,
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <FieldRow
      ref={ref}
      label={label}
      secureTextEntry={!revealed}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setRevealed((current) => !current)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={revealed ? "Hide password" : "Show password"}
        >
          <Icon
            name={revealed ? "eyeSlash" : "eye"}
            size={19}
            color={T.label2}
          />
        </Pressable>
      }
      {...input}
    />
  );
});

/* One big field for an emailed code, digits spaced out. */
export function CodeField({
  value,
  onChangeText,
  onSubmitEditing,
  length = 6,
}) {
  return (
    <View style={styles.codeCard}>
      <TextInput
        value={value}
        onChangeText={(text) =>
          onChangeText(text.replace(/\D/g, "").slice(0, length))
        }
        onSubmitEditing={onSubmitEditing}
        placeholder={"•".repeat(length)}
        placeholderTextColor={T.label3}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        style={styles.code}
        accessibilityLabel="Code from your email"
      />
    </View>
  );
}

/* A short line in the flow of the form: what went wrong, or what happened. */
export function Notice({ tone = "error", children }) {
  if (!children) return null;

  const error = tone === "error";

  return (
    <View
      style={[styles.notice, error ? styles.noticeError : styles.noticeInfo]}
    >
      <Icon
        name={error ? "alert" : "checkCircle"}
        size={17}
        color={error ? T.red : T.accent}
      />

      <Text style={[styles.noticeText, error && styles.noticeTextError]}>
        {children}
      </Text>
    </View>
  );
}

/* A plain text link, centred: "Forgot your password?" */
export function TextLink({ children, onPress, disabled }) {
  return (
    <Text
      style={[styles.link, disabled && styles.linkOff]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="link"
      suppressHighlighting={false}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  fill: {
    flex: 1,
  },

  glow: {
    position: "absolute",
    top: -60,
    left: -40,
    right: -40,
  },

  nav: {
    paddingHorizontal: 16,
    paddingTop: 4,
    minHeight: 44,
    flexDirection: "row",
  },

  content: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },

  centred: {
    justifyContent: "center",
  },

  footer: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },

  mark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 10,
  },

  kicker: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.youText,
    marginTop: 22,
  },

  title: {
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.9,
    color: T.label,
    textAlign: "center",
    marginTop: 14,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: T.label2,
    textAlign: "center",
    marginTop: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    gap: 12,
  },

  rowLabel: {
    width: 86,
    fontSize: 17,
    color: T.label,
  },

  rowInput: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 13,
  },

  codeCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: T.surface,
    paddingVertical: 14,
  },

  code: {
    fontFamily: "ui-rounded",
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: 12,
    textAlign: "center",
    color: T.label,
    paddingVertical: 6,
  },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },

  noticeError: {
    backgroundColor: "rgba(255,59,48,0.1)",
  },

  noticeInfo: {
    backgroundColor: T.accentTint,
  },

  noticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: T.accentText,
  },

  noticeTextError: {
    color: "#C4271D",
  },

  link: {
    alignSelf: "center",
    fontSize: 16,
    color: T.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  linkOff: {
    opacity: 0.4,
  },
});
