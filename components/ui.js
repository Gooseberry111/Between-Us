import { useRef } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { T, TYPE, RADIUS } from "../lib/theme";

/*
 * ==========================================
 * UI
 * ==========================================
 *
 * The pieces every screen is built from, so the app
 * looks like one app: inset grouped lists, filled and
 * tinted buttons, chips, segmented controls, avatars
 * and empty states that always offer a first step.
 *
 * iOS conventions throughout -- a press dims and
 * shrinks rather than rippling, groups are white on a
 * tinted ground with no borders, and only floating
 * things cast a shadow.
 */

/* ---------- press ---------- */

export function Press({
  children,
  onPress,
  style,
  outerStyle,
  disabled,
  scaleTo = 0.97,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;

  const to = (s, o, duration) =>
    Animated.parallel([
      Animated.timing(scale, { toValue: s, duration, useNativeDriver: true }),
      Animated.timing(dim, { toValue: o, duration, useNativeDriver: true }),
    ]).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={outerStyle}
      onPressIn={() => to(scaleTo, 0.72, 80)}
      onPressOut={() => to(1, 1, 320)}
    >
      <Animated.View style={[{ transform: [{ scale }], opacity: dim }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- screen shell ---------- */

export function Screen({ children, scroll = true, refreshControl }) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/* A nav row: something on the left, glass circle buttons right. */
export function NavBar({ left, children }) {
  return (
    <View style={styles.nav}>
      <View style={styles.navLeft}>{left}</View>

      <View style={styles.navRight}>{children}</View>
    </View>
  );
}

export function GlassButton({ icon, onPress, badge, label }) {
  return (
    <Press onPress={onPress} style={styles.glassButton}>
      <Ionicons name={icon} size={19} color={T.label} />

      {badge ? <View style={styles.glassBadge} /> : null}

      {label ? <Text style={styles.sr}>{label}</Text> : null}
    </Press>
  );
}

export function LargeTitle({ children, style }) {
  return <Text style={[styles.largeTitle, style]}>{children}</Text>;
}

export function SectionHeader({ children, action, onAction }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeader}>{children}</Text>

      {action ? (
        <Text style={styles.sectionAction} onPress={onAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- surfaces ---------- */

export function Card({ children, style, padded = true }) {
  return (
    <View style={[styles.card, padded && styles.cardPadded, style]}>
      {children}
    </View>
  );
}

/* An inset grouped list. Separators start where the text does. */
export function Group({ children, style }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];

  return (
    <View style={[styles.group, style]}>
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.separator} /> : null}

          {row}
        </View>
      ))}
    </View>
  );
}

export function Cell({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  destructive,
}) {
  const body = (
    <View style={styles.cell}>
      {leading ? <View style={styles.cellLeading}>{leading}</View> : null}

      <View style={styles.cellText}>
        <Text
          style={[styles.cellTitle, destructive && { color: T.red }]}
          numberOfLines={2}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text style={styles.cellSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}

      {chevron ? (
        <Ionicons name="chevron-forward" size={17} color={T.label3} />
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Press onPress={onPress} scaleTo={0.985}>
      {body}
    </Press>
  );
}

/* ---------- buttons ---------- */

export function Button({
  title,
  onPress,
  kind = "filled",
  size = "large",
  icon,
  disabled,
  busy,
  style,
}) {
  const palette = {
    filled: { bg: T.accent, fg: "#FFFFFF" },
    tinted: { bg: T.accentTint, fg: T.accentText },
    gray: { bg: T.fill4, fg: T.label },
    plain: { bg: "transparent", fg: T.accentText },
    destructive: { bg: "rgba(255,59,48,0.12)", fg: T.red },
  }[kind];

  return (
    <Press onPress={onPress} disabled={disabled || busy} style={style}>
      <View
        style={[
          size === "large" ? styles.buttonLarge : styles.buttonSmall,
          { backgroundColor: palette.bg },
          (disabled || busy) && styles.buttonOff,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          <>
            {icon ? (
              <Ionicons name={icon} size={17} color={palette.fg} />
            ) : null}

            <Text
              style={[
                size === "large" ? styles.buttonText : styles.buttonTextSmall,
                { color: palette.fg },
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </View>
    </Press>
  );
}

export function Chip({ label, selected, onPress, style }) {
  return (
    <Press onPress={onPress} style={style} scaleTo={0.94}>
      <View style={[styles.chip, selected && styles.chipSelected]}>
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
          {label}
        </Text>
      </View>
    </Press>
  );
}

/* A gray track with a white thumb that slides. */
export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option === value;

        return (
          <Pressable
            key={option}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- people ---------- */

export function Avatar({ name, who = "them", size = 56, ring, style }) {
  const colour = who === "you" ? T.you : T.accent;
  const tint = who === "you" ? T.youTint : T.accentTint;
  const text = who === "you" ? T.youText : T.accentText;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        },
        ring && {
          borderWidth: 2,
          borderColor: colour,
          borderStyle: who === "you" ? "dashed" : "solid",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.4,
          fontWeight: "600",
          color: text,
        }}
      >
        {(name || "?").trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/* ---------- empty states ---------- */

export function Empty({ icon, title, text, chips, action }) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={T.accent} />
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyText}>{text}</Text>

      {chips?.length ? (
        <View style={styles.emptyChips}>
          {chips.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              onPress={chip.onPress}
              style={styles.emptyChip}
            />
          ))}
        </View>
      ) : null}

      {action ? (
        <Button
          title={action.title}
          icon={action.icon}
          onPress={action.onPress}
          size="small"
          style={styles.emptyAction}
        />
      ) : null}
    </Card>
  );
}

/* Respect the system setting before anything loops or celebrates. */
export async function motionAllowed() {
  try {
    const reduced = await AccessibilityInfo.isReduceMotionEnabled();

    return !reduced;
  } catch {
    return true;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  scrollContent: {
    paddingBottom: 130,
  },

  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    minHeight: 44,
  },

  navLeft: {
    flex: 1,
  },

  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  glassButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },

  glassBadge: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.accent,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  sr: {
    width: 0,
    height: 0,
    opacity: 0,
  },

  largeTitle: {
    ...TYPE.largeTitle,
    color: T.label,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 8,
  },

  sectionHeader: {
    ...TYPE.sectionHeader,
    color: T.label2,
  },

  sectionAction: {
    ...TYPE.footnote,
    color: T.accentText,
    fontWeight: "600",
  },

  card: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.card,
    marginHorizontal: 16,
  },

  cardPadded: {
    padding: 16,
  },

  group: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.group,
    marginHorizontal: 16,
    overflow: "hidden",
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.separator,
    marginLeft: 16,
  },

  cell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },

  cellLeading: {
    justifyContent: "center",
  },

  cellText: {
    flex: 1,
  },

  cellTitle: {
    ...TYPE.body,
    fontSize: 16,
    color: T.label,
  },

  cellSubtitle: {
    ...TYPE.footnote,
    color: T.label2,
    marginTop: 2,
  },

  buttonLarge: {
    height: 50,
    borderRadius: RADIUS.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },

  buttonSmall: {
    height: 34,
    borderRadius: RADIUS.capsule,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
  },

  buttonOff: {
    opacity: 0.45,
  },

  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },

  buttonTextSmall: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.capsule,
    backgroundColor: T.fill4,
  },

  chipSelected: {
    backgroundColor: T.accent,
  },

  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: T.label,
  },

  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  segment: {
    flexDirection: "row",
    backgroundColor: T.fill3,
    borderRadius: 9,
    padding: 2,
    marginHorizontal: 16,
  },

  segmentItem: {
    flex: 1,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },

  segmentItemActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: T.label2,
  },

  segmentTextActive: {
    color: T.label,
    fontWeight: "600",
  },

  empty: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 22,
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    ...TYPE.headline,
    color: T.label,
    textAlign: "center",
  },

  emptyText: {
    ...TYPE.footnote,
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    textAlign: "center",
    marginTop: 6,
  },

  emptyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },

  emptyChip: {
    marginBottom: 2,
  },

  emptyAction: {
    marginTop: 16,
  },
});
