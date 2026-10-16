/*
 * ==========================================
 * APP CONFIG
 * ==========================================
 *
 * app.json is the config. This only changes one thing,
 * and only when asked: publishing with EXPO_GO=1 stamps
 * the update with Expo Go's own runtime, so Expo Go can
 * open it straight from Expo's servers -- no laptop, no
 * dev server. Every other publish keeps the app's
 * version as its runtime, which is what the installed
 * Android build looks for.
 */
const EXPO_GO_RUNTIME = "exposdk:57.0.0";

module.exports = ({ config }) =>
  process.env.EXPO_GO === "1"
    ? { ...config, runtimeVersion: EXPO_GO_RUNTIME }
    : config;
