import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { API_URL, apiFetch, authHeaders } from "../lib/api";
import { T } from "../lib/theme";

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
 */
export function RemotePhoto({ id, localUri, style }) {
  const [headers, setHeaders] = useState(null);

  useEffect(() => {
    let live = true;

    if (id && !localUri) {
      authHeaders().then((value) => {
        if (live) setHeaders(value);
      });
    }

    return () => {
      live = false;
    };
  }, [id, localUri]);

  if (localUri) {
    return (
      <Image source={{ uri: localUri }} style={style} resizeMode="cover" />
    );
  }

  if (!id || !headers) {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <Image
      source={{ uri: `${API_URL}/media/${id}`, headers }}
      style={style}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: T.fill3,
  },
});
