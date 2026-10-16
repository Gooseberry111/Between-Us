import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";

import { T } from "../../lib/theme";

/*
 * ==========================================
 * ICON
 * ==========================================
 *
 * SF Symbols on iOS, which is what the design system
 * asks for and what makes the app feel native there.
 * Ionicons stand in on Android, where SF Symbols do
 * not exist.
 *
 * One name per icon, mapped once here, so no screen
 * has to know which platform it is on.
 */

const MAP = {
  /* navigation */
  home: ["house", "home-outline", "home"],
  timeline: ["clock", "time-outline", "time"],
  dreams: ["sparkles", "sparkles-outline", "sparkles"],
  insights: ["circle.grid.cross", "git-compare-outline", "git-compare"],
  profile: ["person", "person-outline", "person"],

  /* actions */
  add: ["plus", "add", "add"],
  check: ["checkmark", "checkmark", "checkmark"],
  checkCircle: ["checkmark.circle.fill", "checkmark-circle", "checkmark-circle"],
  chevron: ["chevron.right", "chevron-forward", "chevron-forward"],
  chevronDown: ["chevron.down", "chevron-down", "chevron-down"],
  back: ["chevron.left", "chevron-back", "chevron-back"],
  close: ["xmark", "close", "close"],
  edit: ["square.and.pencil", "create-outline", "create"],
  search: ["magnifyingglass", "search", "search"],
  send: ["paperplane.fill", "send", "send"],
  more: ["ellipsis", "ellipsis-horizontal", "ellipsis-horizontal"],

  /* the app's own things */
  heart: ["heart.fill", "heart", "heart"],
  heartOutline: ["heart", "heart-outline", "heart"],
  bell: ["bell", "notifications-outline", "notifications"],
  calendar: ["calendar", "calendar-outline", "calendar"],
  camera: ["camera", "camera-outline", "camera"],
  mail: ["envelope", "mail-outline", "mail"],
  flag: ["flag", "flag-outline", "flag"],
  flame: ["flame.fill", "flame", "flame"],
  lock: ["lock.fill", "lock-closed", "lock-closed"],
  bulb: ["lightbulb.fill", "bulb", "bulb"],
  trophy: ["trophy.fill", "trophy", "trophy"],
  photos: ["photo.on.rectangle", "images-outline", "images"],
  pin: ["mappin.and.ellipse", "location-outline", "location"],
  person: ["person", "person-outline", "person"],
  personAdd: ["person.badge.plus", "person-add", "person-add"],
  mood: ["face.smiling", "happy-outline", "happy"],
  clock: ["clock", "time-outline", "time"],
  pulse: ["waveform.path.ecg", "pulse-outline", "pulse"],
  sparkle: ["sparkles", "sparkles-outline", "sparkles"],
  snow: ["snowflake", "snow-outline", "snow"],
  trash: ["trash", "trash-outline", "trash"],
  photo: ["photo", "image-outline", "image"],
  target: ["scope", "locate-outline", "locate"],
  undo: ["arrow.uturn.backward", "arrow-undo-outline", "arrow-undo"],
  eye: ["eye", "eye-outline", "eye"],
  eyeSlash: ["eye.slash", "eye-off-outline", "eye-off"],
  alert: ["exclamationmark.circle.fill", "alert-circle", "alert-circle"],
  chat: ["bubble.left.and.bubble.right", "chatbubbles-outline", "chatbubbles"],
  link: ["link", "link-outline", "link"],
  share: ["square.and.arrow.up", "share-outline", "share"],
  copy: ["doc.on.doc", "copy-outline", "copy"],
  envelopeOpen: ["envelope.open", "mail-open-outline", "mail-open"],

  /* dream covers */
  beach: ["beach.umbrella", "umbrella-outline", "umbrella"],
  food: ["fork.knife", "restaurant-outline", "restaurant"],
  music: ["music.note", "musical-notes-outline", "musical-notes"],
  house: ["house", "home-outline", "home"],
  car: ["car", "car-outline", "car"],
  moon: ["moon.stars", "moon-outline", "moon"],
  run: ["figure.run", "walk-outline", "walk"],
  book: ["book", "book-outline", "book"],
  savings: ["banknote", "cash-outline", "cash"],
  hands: ["hands.sparkles", "hand-left-outline", "hand-left"],
  plane: ["airplane", "airplane-outline", "airplane"],
  leaf: ["leaf", "leaf-outline", "leaf"],
};

/* The SF Symbol behind one of our names, for native
 * SwiftUI controls that take a system image directly. */
export function sfSymbol(name, filled) {
  const entry = MAP[name];

  if (!entry) return undefined;

  return filled && !entry[0].endsWith(".fill") && name !== "sparkle"
    ? `${entry[0]}.fill`
    : entry[0];
}

export default function Icon({ name, size = 20, color = T.label, filled }) {
  const entry = MAP[name];

  if (!entry) {
    return <Ionicons name={name} size={size} color={color} />;
  }

  const [symbol, outline, solid] = entry;

  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={symbol}
        size={size}
        tintColor={color}
        type="hierarchical"
        weight={filled ? "semibold" : "regular"}
        fallback={
          <Ionicons name={filled ? solid : outline} size={size} color={color} />
        }
      />
    );
  }

  return <Ionicons name={filled ? solid : outline} size={size} color={color} />;
}
