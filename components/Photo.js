import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { API_URL, apiFetch, authHeaders } from "../lib/api";
import { T } from "../lib/theme";
import { Icon } from "./ui";

/*
 * ==========================================
 * PHOTOS
 * ==========================================
 *
 * Picking a photo, sending it to the media store, and
 * showing one back. Memories and dreams both use these.
 *
 * Photos are private to the couple, so reading one back
 * needs the session token; the Image carries it as a
 * header rather than the URL carrying anything.
 */

/* The picker is a native module. If a build was made
 * without it, photos are simply unavailable rather than
 * the screen failing to load. */
let ImagePicker = null;

try {
  ImagePicker = require("expo-image-picker");
} catch {
  ImagePicker = null;
}

export const photosAvailable = Boolean(ImagePicker);

/*
 * Opens the photo library. Resolves to { uri, base64 }
 * or null when the person backs out.
 */
export async function pickPhoto({ aspect = [16, 10] } = {}) {
  if (!ImagePicker) {
    throw new Error("Photos need the latest version of the app.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect,
    quality: 0.5,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]?.base64) return null;

  const asset = result.assets[0];

  return { uri: asset.uri, base64: asset.base64 };
}

/* Sends one photo to the media store. Resolves to its id. */
export async function uploadPhoto(userId, base64) {
  const response = await apiFetch(`/users/${userId}/media`, {
    method: "POST",
    body: JSON.stringify({
      clerk_id: userId,
      data: base64,
      content_type: "image/jpeg",
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.id) {
    throw new Error(data?.error || "That photo didn't upload.");
  }

  return data.id;
}

/*
 * A photo from the media store, or one just picked and
 * still on the phone (`localUri`), which shows at once
 * while the upload finishes.
 *
 * Reading one back needs the session token. If it is not
 * ready yet the photo waits for it, and a failed load is
 * retried with a fresh token before it gives up and offers
 * a tap to try again -- never a silent blank.
 */
const TOKEN_TRIES = 5;
const LOAD_TRIES = 2;

export function RemotePhoto({ id, localUri, style }) {
  const [headers, setHeaders] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let timer = null;

    if (!id || localUri) return undefined;

    setFailed(false);

    const fetchToken = (tries) => {
      authHeaders().then((value) => {
        if (!live) return;

        if (value.Authorization || tries >= TOKEN_TRIES) {
          setHeaders(value);
          return;
        }

        timer = setTimeout(() => fetchToken(tries + 1), 600);
      });
    };

    fetchToken(1);

    return () => {
      live = false;

      if (timer) clearTimeout(timer);
    };
  }, [id, localUri, attempt]);

  if (localUri) {
    return (
      <Image source={{ uri: localUri }} style={style} resizeMode="cover" />
    );
  }

  if (failed) {
    return (
      <Pressable
        onPress={() => {
          setHeaders(null);
          setAttempt((current) => current + 1);
        }}
        style={[styles.placeholder, styles.failed, style]}
        accessibilityRole="button"
        accessibilityLabel="Photo didn't load. Tap to try again."
      >
        <Icon name="photo" size={22} color={T.label2} />

        <Text style={styles.failedText}>Tap to load the photo</Text>
      </Pressable>
    );
  }

  if (!id || !headers) {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <Image
      /* The attempt is in the address so a retry is a fresh request. */
      source={{ uri: `${API_URL}/media/${id}?v=${attempt}`, headers }}
      style={style}
      resizeMode="cover"
      onError={() => {
        if (attempt < LOAD_TRIES) {
          setHeaders(null);
          setAttempt((current) => current + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: T.fill3,
  },

  failed: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  failedText: {
    fontSize: 13,
    color: T.label2,
  },
});
