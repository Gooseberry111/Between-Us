import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Polygon } from "react-native-svg";

import { COVERS } from "../lib/dreams";
import { Icon } from "./ui";
import { RemotePhoto } from "./Photo";

/*
 * ==========================================
 * DREAM COVER
 * ==========================================
 *
 * The picture at the top of a dream: a photo the two of
 * them chose, or one of the drawn covers. The sunset is
 * the prototype's -- a peach-to-lilac sky, two purple
 * ranges and a low sun. The rest are a gradient with the
 * dream's symbol, like the starter cards.
 *
 * Children sit on top (the "In progress" chip).
 */
export default function DreamCover({
  cover = "sunset",
  icon,
  photoId,
  localUri,
  height = 120,
  iconSize = 30,
  radius = 0,
  style,
  children,
}) {
  const preset = COVERS[cover] || COVERS.sunset;
  const symbol = icon || preset.icon;

  return (
    <View style={[styles.cover, { height, borderRadius: radius }, style]}>
      {photoId || localUri ? (
        <RemotePhoto
          id={photoId}
          localUri={localUri}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={preset.colours}
          start={{ x: 0, y: 0 }}
          end={preset.art ? { x: 0, y: 1 } : { x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          {preset.art === "mountains" ? (
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 120 120"
              preserveAspectRatio="none"
            >
              <Circle cx="86" cy="34" r="17" fill="#FFE08A" opacity="0.35" />
              <Circle cx="86" cy="34" r="10" fill="#FFF2C2" />
              <Polygon
                points="0,120 0,78 22,52 38,70 60,40 80,66 96,52 120,72 120,120"
                fill="#7B5BD6"
              />
              <Polygon
                points="0,120 0,96 28,78 52,100 74,76 102,98 120,88 120,120"
                fill="#5A3FB0"
              />
            </Svg>
          ) : symbol ? (
            <View style={styles.symbol}>
              <Icon name={symbol} size={iconSize} color="#FFFFFF" />
            </View>
          ) : null}
        </LinearGradient>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    overflow: "hidden",
    backgroundColor: "#E9E6EB",
  },

  symbol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
