/*
 * ==========================================
 * THEME
 * ==========================================
 *
 * The app used to be brown throughout, which read as
 * careful but tired. The lead colour is now a deep
 * rose -- warm, romantic, a little bold -- over a
 * blush-cream ground, with plum for the dark panels
 * and the pastels carrying the signposting.
 *
 * Brown survives only where it belongs: as the warm
 * neutral in text and borders, never as the accent.
 */

export const COLORS = {
  /* Lead */
  rose: "#D9456B",
  roseDeep: "#B8345A",
  roseSoft: "#F9E3EA",
  roseWash: "#FDF2F5",

  /* Dark panels */
  plum: "#5B2B43",
  plumDeep: "#3E1C2E",

  /* Ink */
  ink: "#2E2430",
  inkSoft: "#6B5F68",
  inkFaint: "#9C8F97",

  /* Ground */
  cream: "#FFF8F5",
  creamDeep: "#FDEDF1",

  /* Surfaces */
  surface: "rgba(255,255,255,0.86)",
  surfaceEdge: "rgba(255,255,255,0.95)",
  line: "rgba(217,69,107,0.14)",

  /* States */
  danger: "#C2405F",
  success: "#4F7A5B",
  onDark: "#FFFFFF",
  onDarkSoft: "rgba(255,255,255,0.78)",
};

/* Gradients, kept here so every screen wears the same ones. */
export const GRADIENTS = {
  ground: ["#FFF8F5", "#FDEDF1", "#F7E9F2"],
  panel: ["rgba(122,48,80,0.95)", "rgba(62,28,46,0.93)"],
  panelAlt: ["rgba(90,58,120,0.94)", "rgba(52,32,72,0.92)"],
};
