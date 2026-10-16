/*
 * ==========================================
 * PUBLISH
 * ==========================================
 *
 *   node scripts/publish.js "What changed"
 *
 * Sends one over-the-air update to both places the app
 * runs from:
 *
 *   preview   the installed Android build (runtime = app version)
 *   expo-go   Expo Go on a phone, straight from Expo's servers,
 *             with no laptop or dev server (runtime = exposdk)
 *
 * Expo Go opens it from:
 *   exp://u.expo.dev/70fa9f0d-4ccd-4613-9f00-cad1cd0d244a?channel-name=expo-go&runtime-version=exposdk:57.0.0
 */
const { execSync } = require("node:child_process");
const path = require("node:path");

const message = process.argv.slice(2).join(" ").trim();

if (!message) {
  console.error('Say what changed: node scripts/publish.js "Dreams fixes"');
  process.exit(1);
}

const root = path.join(__dirname, "..");

const run = (args, env = {}) =>
  execSync(`npx -y eas-cli@latest update ${args}`, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

const quoted = JSON.stringify(message);

run(
  `--branch preview --environment preview --message ${quoted} --non-interactive`,
);

/* Expo Go on iOS is the only phone that opens this branch. */
run(
  `--branch expo-go --environment preview --platform ios --message ${quoted} --non-interactive`,
  { EXPO_GO: "1" },
);
