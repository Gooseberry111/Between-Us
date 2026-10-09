/*
 * ==========================================
 * THEME — Bubblegum
 * ==========================================
 *
 * The tokens from the design system. Two colours do
 * the heavy lifting and must never be confused: the
 * accent belongs to the partner, `you` belongs to the
 * person holding the phone. Avatars, the bond thread
 * and every comparison lean on that distinction.
 *
 * Everything else is iOS system colour, so the app
 * reads as a native app rather than a branded one.
 */

export const T = {
  /* Theme */
  accent: "#F03FA9",
  accentText: "#C21F82",
  accentTint: "#FDE8F5",
  secondary: "#38BDF8",

  /* The Bubblegum gradient: your purple, through the
   * accent, into the sky. Used on the bond thread, hug
   * pulses and celebrations -- sparingly, as the system
   * says. */
  gradient: ["#9B6BFF", "#F03FA9", "#38BDF8"],

  you: "#9B6BFF",
  youText: "#5B35C9",
  youTint: "#F0E8FF",

  /* Ground and surfaces */
  appBackground: "#F2ECF4",
  surface: "#FFFFFF",

  /* iOS labels */
  label: "#111114",
  label2: "rgba(60,60,67,0.6)",
  label3: "rgba(60,60,67,0.3)",
  separator: "rgba(60,60,67,0.18)",

  /* iOS fills */
  fill2: "rgba(120,120,128,0.16)",
  fill3: "rgba(118,118,128,0.12)",
  fill4: "rgba(116,116,128,0.08)",
  pressed: "#E5E5EA",

  /* Status */
  green: "#34C759",
  red: "#FF3B30",
  orange: "#FF9500",
};

/* Text styles, named as iOS names them. */
export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.8 },
  title3: { fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  headline: { fontSize: 17, fontWeight: "600", letterSpacing: -0.35 },
  body: { fontSize: 17, fontWeight: "400", letterSpacing: -0.35 },
  callout: { fontSize: 16, fontWeight: "400", letterSpacing: -0.3 },
  footnote: { fontSize: 13, fontWeight: "400", letterSpacing: -0.08 },
  caption: { fontSize: 12, fontWeight: "400" },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
};

export const RADIUS = {
  group: 18,
  card: 18,
  button: 14,
  capsule: 999,
};

/* Only floating things cast a shadow. */
export const FLOAT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.16,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 10 },
  elevation: 12,
};

export default T;
