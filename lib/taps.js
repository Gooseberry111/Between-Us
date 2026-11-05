/*
 * ==========================================
 * THE LITTLE SOMETHINGS
 * ==========================================
 *
 * Everything you can send from the wheel around their
 * circle on Home. The first four are the originals, so
 * they stay first on the wheel. The server keeps the same
 * list (between-us-api/src/index.js, POST /tap); a kind it
 * does not know is turned away.
 */

export const TAP_LIST = [
  { kind: "kiss", emoji: "😘", label: "Kiss", line: "sent you a kiss" },
  { kind: "miss", emoji: "🥺", label: "Miss you", line: "misses you" },
  { kind: "proud", emoji: "🌟", label: "Proud", line: "is proud of you" },
  {
    kind: "thinking",
    emoji: "💭",
    label: "Thinking of you",
    line: "is thinking of you",
  },
  { kind: "love", emoji: "❤️", label: "Love you", line: "loves you" },
  { kind: "cuddle", emoji: "🫂", label: "Cuddle", line: "wants a cuddle" },
  { kind: "rose", emoji: "🌹", label: "Rose", line: "sent you a rose" },
  { kind: "hot", emoji: "🔥", label: "Hot", line: "thinks you look hot" },
  { kind: "wink", emoji: "😉", label: "Wink", line: "winked at you" },
  {
    kind: "laugh",
    emoji: "😂",
    label: "Laughing",
    line: "is laughing with you",
  },
  {
    kind: "call",
    emoji: "📞",
    label: "Call me",
    line: "wants to hear your voice",
  },
  {
    kind: "food",
    emoji: "🍕",
    label: "Food?",
    line: "is hungry. Food together?",
  },
  {
    kind: "coffee",
    emoji: "☕",
    label: "Coffee",
    line: "fancies a coffee with you",
  },
  { kind: "morning", emoji: "☀️", label: "Morning", line: "says good morning" },
  { kind: "night", emoji: "🌙", label: "Goodnight", line: "says goodnight" },
  { kind: "sorry", emoji: "🥹", label: "Sorry", line: "is sorry" },
];

export const TAPS = Object.fromEntries(TAP_LIST.map((tap) => [tap.kind, tap]));
