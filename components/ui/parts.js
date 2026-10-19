import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as NativeSwitch,
  Text,
  View,
} from "react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button as SwiftButton,
  Host,
  Toggle as SwiftToggle,
} from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as swiftDisabled,
  frame,
  labelsHidden,
  lineLimit,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

import { T } from "../../lib/theme";
import Icon, { sfSymbol } from "./Icon";
import { GlassButton, Press } from "./layout";
import { KeyboardScroll, keyboardBehavior } from "./keyboard";
import { confirmDiscard } from "../../lib/actions";

/*
 * ==========================================
 * PARTS
 * ==========================================
 *
 * Cards, lists, controls and the small pieces the
 * prototype repeats. Native controls where iOS has
 * one worth using: the segmented control and the
 * switch are the real thing, not drawn copies.
 */

/* .card — white, radius 20. */
export function Card({ children, style, padded = true, inset = true }) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.cardPadded,
        inset && styles.cardInset,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* .group — an inset grouped list. */
export function Group({ children, style, inset = 16 }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(
    Boolean,
  );

  return (
    <View style={[styles.group, style]}>
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? (
            <View style={[styles.separator, { marginLeft: inset }]} />
          ) : null}

          {row}
        </View>
      ))}
    </View>
  );
}

/*
 * .cell — 50pt minimum, 16pt sides, 12pt gap. A row
 * that presses highlights rather than scales, which
 * is what a list row does on iOS.
 */
export function Cell({
  leading,
  title,
  subtitle,
  value,
  trailing,
  onPress,
  chevron,
  destructive,
  centred,
}) {
  const [held, setHeld] = useState(false);

  const body = (
    <View
      style={[
        styles.cell,
        held && styles.cellHeld,
        centred && styles.cellCentred,
      ]}
    >
      {leading ? <View style={styles.cellLeading}>{leading}</View> : null}

      <View style={[styles.cellText, centred && styles.cellTextCentred]}>
        <Text
          style={[
            styles.cellTitle,
            destructive && styles.cellTitleDestructive,
            centred && styles.cellTitleCentred,
          ]}
        >
          {title}
        </Text>

        {subtitle ? <Text style={styles.cellSubtitle}>{subtitle}</Text> : null}
      </View>

      {value ? <Text style={styles.cellValue}>{value}</Text> : null}

      {trailing}

      {chevron ? <Icon name="chevron" size={18} color={T.label3} /> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
    >
      {body}
    </Pressable>
  );
}

/* .btn — 50pt tall, radius 14; .btn-sm is a 34pt capsule. */
/* Whether this phone draws Liquid Glass. Asked once. */
const GLASS = Platform.OS === "ios" && safeGlassCheck();

function safeGlassCheck() {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/*
 * On iOS the button is SwiftUI's own Button, so it has the
 * system's press, its accessibility, and on iOS 26 the
 * Liquid Glass styles -- glassProminent for the one main
 * action, glass for the rest. Earlier iOS gets the bordered
 * styles. Android draws the prototype's button.
 */
function NativeButton({
  title,
  onPress,
  kind,
  size,
  icon,
  disabled,
  busy,
  style,
  block,
}) {
  const style_ = {
    filled: GLASS ? "glassProminent" : "borderedProminent",
    tinted: GLASS ? "glass" : "bordered",
    gray: GLASS ? "glass" : "bordered",
    white: GLASS ? "glass" : "bordered",
    plain: "borderless",
    destructive: GLASS ? "glass" : "bordered",
  }[kind];

  /*
   * A full-width button stretches across its row. Anything
   * else is compact: a capsule sized to its own label, on
   * one line. Matching only the height let a compact button
   * take the width of a container that was itself waiting
   * to be sized, so it collapsed and its label stacked.
   */
  const fill = block && size === "large";

  const modifiers = [
    buttonStyle(style_),
    controlSize(size === "large" ? "large" : "regular"),
    tint(kind === "destructive" ? T.red : T.accent),
  ];

  if (fill) modifiers.push(frame({ maxWidth: 2000 }));
  else modifiers.push(buttonBorderShape("capsule"), lineLimit(1));

  if (disabled || busy) modifiers.push(swiftDisabled(true));

  return (
    <View style={[fill ? styles.buttonBlock : styles.buttonCompact, style]}>
      <Host
        matchContents={fill ? { vertical: true } : true}
        style={fill ? styles.buttonHost : undefined}
      >
        <SwiftButton
          label={busy ? "One moment…" : title}
          systemImage={icon ? sfSymbol(icon) : undefined}
          role={kind === "destructive" ? "destructive" : undefined}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );

            onPress?.();
          }}
          modifiers={modifiers}
        />
      </Host>
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = "filled",
  size = "large",
  icon,
  disabled,
  busy,
  style,
  block = true,
}) {
  if (Platform.OS === "ios") {
    return (
      <NativeButton
        title={title}
        onPress={onPress}
        kind={kind}
        size={size}
        icon={icon}
        disabled={disabled}
        busy={busy}
        style={style}
        block={block}
      />
    );
  }

  const palette = {
    filled: { bg: T.accent, fg: "#FFFFFF" },
    tinted: { bg: T.accentTint, fg: T.accentText },
    gray: { bg: T.fill3, fg: T.accentText },
    white: { bg: "#FFFFFF", fg: T.accentText },
    plain: { bg: "transparent", fg: T.accent },
    destructive: { bg: "rgba(255,59,48,0.12)", fg: T.red },
  }[kind];

  return (
    <Press
      onPress={() => {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }

        onPress?.();
      }}
      disabled={disabled || busy}
      outerStyle={block && size === "large" ? styles.buttonBlock : undefined}
      style={style}
    >
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
            {icon ? <Icon name={icon} size={20} color={palette.fg} /> : null}

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

/* .chip — a 34pt capsule; solid accent when selected. */
export function Chip({ label, selected, tinted, onPress, style }) {
  return (
    <Press onPress={onPress} style={style} scaleTo={0.94}>
      <View
        style={[
          styles.chip,
          tinted && styles.chipTinted,
          selected && styles.chipSelected,
        ]}
      >
        <Text
          style={[
            styles.chipText,
            tinted && styles.chipTextTinted,
            selected && styles.chipTextSelected,
          ]}
        >
          {label}
        </Text>
      </View>
    </Press>
  );
}

/*
 * .rem — the round check Reminders uses: an empty ring,
 * or the accent with a white gap around a filled dot.
 */
export function Check({ on, onPress, label }) {
  return (
    <Press
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});

        onPress?.();
      }}
      scaleTo={0.85}
      hitSlop={10}
      accessibilityLabel={label}
    >
      <View style={[styles.check, on && styles.checkOn]}>
        {on ? <View style={styles.checkDot} /> : null}
      </View>
    </Press>
  );
}

/* .seg — the real iOS control on iOS. */
export function Segmented({ options, value, onChange, style }) {
  if (Platform.OS === "ios") {
    return (
      <View style={[styles.segmentWrap, style]}>
        <SegmentedControl
          values={options}
          selectedIndex={Math.max(0, options.indexOf(value))}
          onChange={(event) =>
            onChange(options[event.nativeEvent.selectedSegmentIndex])
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.segment, style]}>
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

/* .sw — the system switch, with the accent track. */
export function Toggle({ value, onChange }) {
  if (Platform.OS === "ios") {
    return (
      <Host matchContents>
        <SwiftToggle
          isOn={value}
          onIsOnChange={onChange}
          modifiers={[labelsHidden(), tint(T.accent)]}
        />
      </Host>
    );
  }

  return (
    <NativeSwitch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: "#E9E9EB", true: T.accent }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E9E9EB"
    />
  );
}

/* .av — yours is purple, theirs is pink, always. */
export function Avatar({ name, who = "them", size = 40, ring, style }) {
  const tint = who === "you" ? T.youTint : T.accentTint;
  const ink = who === "you" ? T.youText : T.accentText;
  const edge = who === "you" ? T.you : T.accent;

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
        ring && { borderWidth: 2, borderColor: edge },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: "600", color: ink }}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/* .cal — the little date block on a list row. */
export function DateBlock({ date, tone = "them" }) {
  if (!date) return null;

  const value = new Date(`${String(date).slice(0, 10)}T00:00:00`);

  return (
    <View style={styles.cal}>
      <Text
        style={[styles.calMonth, { color: tone === "you" ? T.youText : T.red }]}
      >
        {value.toLocaleDateString(undefined, { month: "short" })}
      </Text>

      <Text style={styles.calDay}>{value.getDate()}</Text>
    </View>
  );
}

/* .love — the iMessage-style heart reaction. */
export function LoveButton({ value, onChange }) {
  const pop = useRef(new Animated.Value(1)).current;

  const press = () => {
    onChange?.(!value);

    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.22,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 12,
      }),
    ]).start();
  };

  return (
    <Pressable onPress={press} hitSlop={8} style={styles.love}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon
          name={value ? "heart" : "heartOutline"}
          size={24}
          color={value ? T.accent : T.label3}
          filled={value}
        />
      </Animated.View>
    </Pressable>
  );
}

/* .empty — a symbol, a title, a sentence, a first step. */
export function Empty({ icon, title, text, chips, action }) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={T.accent} />
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyText}>{text}</Text>

      {chips?.length ? (
        <View style={styles.emptyChips}>
          {chips.map((chip) => (
            <Chip
              key={chip.label}
              label={chip.label}
              tinted
              onPress={chip.onPress}
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
          block={false}
          style={styles.emptyAction}
        />
      ) : null}
    </Card>
  );
}

/*
 * .sheet-nav — the top of every sheet and every screen
 * presented as one.
 *
 * The grabber, then a 52pt bar: close on the left, the
 * title truly centred, the confirming action on the
 * right. On iOS the two actions are the system's circle
 * buttons -- an xmark in glass and a checkmark filled
 * with the accent -- which is how iOS 26 tops a sheet.
 * Android keeps the prototype's Cancel and Save.
 *
 * `centre` replaces the title with anything else (the
 * daily question's progress bars). `subtitle` is a line
 * of context under the bar, with room to breathe.
 */
export function SheetHeader({
  title,
  subtitle,
  centre,
  onClose,
  closeIcon = "close",
  onDone,
  doneLabel = "Save",
  doneDisabled,
}) {
  const ios = Platform.OS === "ios";

  const close = onClose ? (
    ios ? (
      <GlassButton icon={closeIcon} label="Cancel" onPress={onClose} />
    ) : (
      <Text style={styles.sheetCancel} onPress={onClose}>
        Cancel
      </Text>
    )
  ) : null;

  const done = onDone ? (
    ios ? (
      <GlassButton
        icon="check"
        label={doneLabel}
        prominent
        disabled={doneDisabled}
        onPress={onDone}
      />
    ) : (
      <Text
        style={[styles.sheetSave, doneDisabled && styles.sheetSaveOff]}
        onPress={doneDisabled ? undefined : onDone}
      >
        {doneLabel}
      </Text>
    )
  ) : null;

  return (
    <View style={styles.sheetHead}>
      {/* The grabber iOS puts on a page sheet. */}
      {ios ? <View style={styles.sheetGrabber} /> : null}

      <View style={styles.sheetNav}>
        <View style={styles.sheetSide}>{close}</View>

        <View style={styles.sheetCentre}>
          {centre ||
            (title ? (
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {title}
              </Text>
            ) : null)}
        </View>

        <View style={[styles.sheetSide, styles.sheetSideEnd]}>{done}</View>
      </View>

      {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/*
 * .sheet — a page sheet with the header above and the
 * body scrolling beneath it, lifted clear of the
 * keyboard. Cards and groups inside carry their own
 * 16pt sides, as they do on every other screen.
 */
export function Sheet({
  visible,
  title,
  subtitle,
  onCancel,
  onSave,
  saveLabel = "Save",
  saveDisabled,
  dirty,
  children,
}) {
  const insets = useSafeAreaInsets();
  const android = Platform.OS === "android";

  /* Something typed is never thrown away without asking. */
  const requestClose = () => {
    if (dirty) confirmDiscard(onCancel);
    else onCancel?.();
  };

  const body = (
    <KeyboardAvoidingView
      style={android ? styles.panelFill : styles.sheet}
      behavior={keyboardBehavior}
    >
      <SheetHeader
        title={title}
        subtitle={subtitle}
        onClose={requestClose}
        onDone={onSave}
        doneLabel={saveLabel}
        doneDisabled={saveDisabled}
      />

      <KeyboardScroll
        contentContainerStyle={[
          styles.sheetBody,
          android && { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </KeyboardScroll>
    </KeyboardAvoidingView>
  );

  /*
   * iOS: the system page sheet. Android has none, so it gets
   * a panel that rises from the bottom over a dimmed screen,
   * clear of the status bar, with rounded top corners.
   */
  if (android) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={requestClose}
      >
        <View style={styles.panelRoot}>
          <Pressable
            style={styles.panelScrim}
            onPress={requestClose}
            accessibilityLabel="Close"
          />

          <View style={[styles.panel, { marginTop: insets.top + 36 }]}>
            <View style={styles.panelGrabber} />

            {body}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={requestClose}
    >
      {body}
    </Modal>
  );
}

/* .ring — the Fitness-style progress ring. */
export function Ring({ value, size = 54, label }) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={T.accentTint}
          strokeWidth="6"
          fill="none"
        />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={T.accent}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, value))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.ringLabel}>
        <Text style={styles.ringText}>
          {label ?? `${Math.round(value * 100)}%`}
        </Text>
      </View>
    </View>
  );
}

/* Respect Reduce Motion before looping or celebrating. */
export async function motionAllowed() {
  try {
    return !(await AccessibilityInfo.isReduceMotionEnabled());
  } catch {
    return true;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 20,
  },

  cardInset: {
    marginHorizontal: 16,
  },

  cardPadded: {
    padding: 16,
  },

  group: {
    backgroundColor: T.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    overflow: "hidden",
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.separator,
  },

  cell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 50,
    backgroundColor: T.surface,
  },

  cellHeld: {
    backgroundColor: T.pressed,
  },

  cellCentred: {
    justifyContent: "center",
  },

  cellLeading: {
    justifyContent: "center",
  },

  cellText: {
    flex: 1,
  },

  cellTextCentred: {
    flex: 0,
  },

  cellTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: T.label,
  },

  cellTitleDestructive: {
    color: T.red,
  },

  cellTitleCentred: {
    textAlign: "center",
  },

  cellSubtitle: {
    fontSize: 13,
    lineHeight: 17,
    color: T.label2,
    marginTop: 1,
  },

  cellValue: {
    fontSize: 16,
    color: T.label2,
  },

  buttonBlock: {
    marginHorizontal: 16,
  },

  buttonHost: {
    alignSelf: "stretch",
  },

  buttonCompact: {
    alignSelf: "flex-start",
  },

  buttonLarge: {
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 20,
  },

  buttonSmall: {
    height: 34,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },

  buttonOff: {
    opacity: 0.45,
  },

  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.34,
  },

  buttonTextSmall: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
  },

  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.fill3,
    alignItems: "center",
    justifyContent: "center",
  },

  chipTinted: {
    backgroundColor: T.accentTint,
  },

  chipSelected: {
    backgroundColor: T.accent,
  },

  chipText: {
    fontSize: 15,
    fontWeight: "500",
    color: T.label,
  },

  chipTextTinted: {
    color: T.accentText,
  },

  chipTextSelected: {
    color: "#FFFFFF",
  },

  segmentWrap: {
    paddingHorizontal: 16,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: T.fill3,
    borderRadius: 10,
    padding: 2,
    marginHorizontal: 16,
  },

  segmentItem: {
    flex: 1,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  segmentItemActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  segmentText: {
    fontSize: 14,
    fontWeight: "500",
    color: T.label2,
  },

  segmentTextActive: {
    color: T.label,
    fontWeight: "600",
  },

  cal: {
    width: 40,
    alignItems: "center",
  },

  calMonth: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  calDay: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "300",
    letterSpacing: -0.7,
    color: T.label,
  },

  love: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 17,
    fontWeight: "600",
    color: T.label,
    textAlign: "center",
  },

  emptyText: {
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

  emptyAction: {
    alignSelf: "center",
    marginTop: 16,
  },

  sheet: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: T.label3,
    alignItems: "center",
    justifyContent: "center",
  },

  checkOn: {
    borderColor: T.accent,
  },

  checkDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: T.accent,
  },

  panelRoot: {
    flex: 1,
  },

  panelScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.32)",
  },

  panel: {
    flex: 1,
    backgroundColor: T.appBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },

  panelFill: {
    flex: 1,
  },

  panelGrabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.label3,
    marginTop: 8,
  },

  sheetHead: {
    paddingBottom: 10,
  },

  sheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.label3,
    marginTop: 6,
  },

  sheetNav: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 16,
    gap: 12,
  },

  /* Both sides the same width, so the title sits on the
   * true centre whatever the buttons are. */
  sheetSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  sheetSideEnd: {
    justifyContent: "flex-end",
  },

  sheetCentre: {
    flexShrink: 1,
    alignItems: "center",
  },

  sheetCancel: {
    fontSize: 17,
    color: T.accent,
    paddingVertical: 6,
    paddingRight: 8,
  },

  sheetTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: T.label,
  },

  sheetSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    textAlign: "center",
    paddingHorizontal: 32,
    marginTop: 10,
  },

  sheetSave: {
    fontSize: 17,
    fontWeight: "600",
    color: T.accent,
    paddingVertical: 6,
    paddingLeft: 8,
  },

  sheetSaveOff: {
    color: T.label3,
  },

  sheetBody: {
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },

  ringLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  ringText: {
    fontSize: 12,
    fontWeight: "700",
    color: T.accentText,
  },
});
