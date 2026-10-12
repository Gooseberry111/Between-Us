/*
 * ==========================================
 * THEME — Velvet
 * ==========================================
 *
 * Plum for the partner and the accent, rose for you,
 * gold as the highlight. Taken from the playground's
 * :root.
 *
 * Two colours must never be confused: the accent
 * belongs to the partner, `you` to the person holding
 * the phone. Avatars, the bond thread, reveal cards
 * and every comparison lean on that.
 *
 * Everything else is iOS system colour, so the app
 * reads as native rather than branded.
 */

export const T = {
  /* Theme: --kiss, --kiss-d, --tint */
  accent: "#4A2D5C",
  accentText: "#321D40",
  accentTint: "#E9E6EB",

  /* --sunset: the gold highlight */
  secondary: "#C9973F",

  /* The thread: you, through the accent, into gold. */
  gradient: ["#D9577A", "#4A2D5C", "#C9973F"],

  /* --you, --you-d, --you-tint */
  you: "#D9577A",
  youText: "#A83355",
  youTint: "#FBE6EC",

  /* --a-bg: grouped background with 3.5% of the accent */
  appBackground: "#ECEBF2",
  surface: "#FFFFFF",

  /* Dark-mode accent, from the playground */
  accentDark: "#CDB3DD",

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
  card: 20,
  button: 14,
  capsule: 999,
};

export const FLOAT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.16,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 10 },
  elevation: 12,
};

export default T;
