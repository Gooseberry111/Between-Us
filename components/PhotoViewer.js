import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { RemotePhoto } from "./Photo";
import Icon from "./ui/Icon";

/*
 * ==========================================
 * A PHOTO, IN FULL
 * ==========================================
 *
 * The whole picture on black, nothing cropped. Pinch to zoom
 * on iPhone; tap anywhere (or ✕) to close. Rendered inside
 * whatever sheet opened it, so it rises over that sheet.
 */

export default function PhotoViewer({ photo, onClose }) {
  const { width, height } = useWindowDimensions();
  const sheetInsets = useSafeAreaInsets();
  const top = Math.max(sheetInsets.top, initialWindowMetrics?.insets?.top ?? 0);

  if (!photo) return null;

  const image = (
    <RemotePhoto
      id={photo.id}
      url={photo.url}
      localUri={photo.localUri}
      fit="contain"
      style={{ width, height }}
    />
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {Platform.OS === "ios" ? (
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.fill}
          >
            <Pressable onPress={onClose}>{image}</Pressable>
          </ScrollView>
        ) : (
          <Pressable onPress={onClose} style={styles.fill}>
            {image}
          </Pressable>
        )}

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.close, { top: top + 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <Icon name="close" size={18} color="#FFFFFF" />
        </Pressable>

        {photo.caption ? (
          <View style={styles.captionWrap} pointerEvents="none">
            <Text style={styles.caption} numberOfLines={2}>
              {photo.caption}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },

  fill: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  close: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  captionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },

  caption: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
