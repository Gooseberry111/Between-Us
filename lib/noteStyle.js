import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/*
 * ==========================================
 * HOW YOUR NOTES LOOK
 * ==========================================
 *
 * Each of you picks the colour of your own bubbles, the
 * colour of theirs, and a wallpaper behind the thread.
 * It is how the thread looks on your phone only, so it is
 * kept on the phone (a few bytes in SecureStore). A photo
 * wallpaper is uploaded like any other photo and only its
 * id is kept here.
 */

/* Bubble colours: a gradient and the text that reads on it. */
export const BUBBLES = [
  {
    key: "rose",
    label: "Rose",
    colors: ["#F28AA6", "#E0607E"],
    text: "#FFFFFF",
  },
  {
    key: "plum",
    label: "Plum",
    colors: ["#A274CC", "#6E3F96"],
    text: "#FFFFFF",
  },
  {
    key: "sunset",
    label: "Sunset",
    colors: ["#FFA166", "#F2557A"],
    text: "#FFFFFF",
  },
  {
    key: "cherry",
    label: "Cherry",
    colors: ["#F0565C", "#B3202B"],
    text: "#FFFFFF",
  },
  {
    key: "ocean",
    label: "Ocean",
    colors: ["#56ADEB", "#2A6FC9"],
    text: "#FFFFFF",
  },
  {
    key: "mint",
    label: "Mint",
    colors: ["#4FD1A6", "#21957A"],
    text: "#FFFFFF",
  },
  {
    key: "gold",
    label: "Gold",
    colors: ["#F0C25A", "#CC8A1C"],
    text: "#FFFFFF",
  },
  {
    key: "lilac",
    label: "Lilac",
    colors: ["#C2AEF5", "#8B6FE3"],
    text: "#FFFFFF",
  },
  {
    key: "midnight",
    label: "Midnight",
    colors: ["#46557A", "#1E2640"],
    text: "#FFFFFF",
  },
  {
    key: "blush",
    label: "Blush",
    colors: ["#FDE7EE", "#F7CCDA"],
    text: "#4A2D3C",
  },
];

/* Wallpapers: a gradient, and whether text over it should be light. */
export const WALLPAPERS = [
  { key: "plain", label: "Plain", colors: null, dark: null },
  {
    key: "blush",
    label: "Blush",
    colors: ["#FFEFF4", "#FBD3E0", "#F2B8CC"],
    dark: false,
  },
  {
    key: "peach",
    label: "Peach",
    colors: ["#FFF1E4", "#FFD5BE", "#F9B9A0"],
    dark: false,
  },
  {
    key: "lavender",
    label: "Lavender",
    colors: ["#F3EEFF", "#DCD0FA", "#C4B2F0"],
    dark: false,
  },
  {
    key: "hearts",
    label: "Hearts",
    colors: ["#FFF3F6", "#FDE0E8"],
    dark: false,
    hearts: true,
  },
  {
    key: "dusk",
    label: "Dusk",
    colors: ["#2A1736", "#5B2C5F", "#B1496F"],
    dark: true,
  },
  {
    key: "ocean",
    label: "Ocean",
    colors: ["#0C2740", "#1C5A84", "#3F9BC2"],
    dark: true,
  },
  {
    key: "forest",
    label: "Forest",
    colors: ["#10291F", "#22553F", "#3E8063"],
    dark: true,
  },
  {
    key: "stars",
    label: "Night sky",
    colors: ["#080C20", "#18204A", "#3A2B68"],
    dark: true,
    stars: true,
  },
];

export const DEFAULT_STYLE = {
  mine: "rose",
  theirs: "default",
  wallpaper: "plain",
  photoId: null,
};

const keyFor = (userId) => `between-us.notes-style.${userId}`;

export function bubbleFor(key) {
  return BUBBLES.find((item) => item.key === key) || null;
}

export function wallpaperFor(key) {
  return WALLPAPERS.find((item) => item.key === key) || WALLPAPERS[0];
}

/* The saved look, and a setter that keeps it. */
export function useNoteStyle(userId) {
  const [style, setStyle] = useState(DEFAULT_STYLE);

  useEffect(() => {
    if (!userId) return;

    let live = true;

    SecureStore.getItemAsync(keyFor(userId))
      .then((raw) => {
        if (!live || !raw) return;
        setStyle({ ...DEFAULT_STYLE, ...JSON.parse(raw) });
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [userId]);

  const save = useCallback(
    (next) => {
      setStyle((current) => {
        const merged = { ...current, ...next };

        if (userId) {
          SecureStore.setItemAsync(
            keyFor(userId),
            JSON.stringify(merged),
          ).catch(() => {});
        }

        return merged;
      });
    },
    [userId],
  );

  return [style, save];
}
