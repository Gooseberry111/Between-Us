import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { T, themedStyles, useTheme } from "../lib/theme";

/*
 * ==========================================
 * THE CROPPER
 * ==========================================
 *
 * After a photo is picked: drag to move it, pinch to
 * scale it, and choose the shape -- then only the part
 * inside the frame is kept. Used wherever a photo goes in.
 *
 * It opens from whichever host was mounted last, so a
 * photo picked inside a sheet crops over that sheet
 * rather than behind it.
 */

let Manipulator = null;

try {
  Manipulator = require("expo-image-manipulator");

  if (!Manipulator?.ImageManipulator?.manipulate) Manipulator = null;
} catch {
  Manipulator = null;
}

export const croppingAvailable = Boolean(Manipulator);

const hosts = [];

/* Large photos are brought down first, and turned the way
 * up they were taken, so the frame matches the pixels. */
async function prepare({ uri, width }) {
  const context = Manipulator.ImageManipulator.manipulate(uri);

  if (width > 2400) context.resize({ width: 2400, height: null });

  const image = await context.renderAsync();

  return image.saveAsync({
    format: Manipulator.SaveFormat.JPEG,
    compress: 0.9,
  });
}

/*
 * Resolves to { uri, base64 } for the cropped photo, or
 * null when the person cancels.
 */
export async function cropPhoto(asset, aspect) {
  const host = hosts[hosts.length - 1];

  if (!Manipulator || !host) return null;

  const photo = await prepare(asset);

  /* Let the picker finish closing before anything opens. */
  if (Platform.OS === "ios") {
    await new Promise((resolve) => setTimeout(resolve, 450));
  }

  return new Promise((resolve) => host({ photo, aspect, resolve }));
}

export function CropHost() {
  useTheme();

  const [job, setJob] = useState(null);

  useEffect(() => {
    hosts.push(setJob);

    return () => {
      const index = hosts.lastIndexOf(setJob);

      if (index >= 0) hosts.splice(index, 1);
    };
  }, []);

  if (!job) return null;

  const finish = (result) => {
    setJob(null);
    job.resolve(result);
  };

  return <CropView job={job} onFinish={finish} />;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ratioLabel([w, h]) {
  return `${w}:${h}`;
}

function CropView({ job, onFinish }) {
  useTheme();

  const insets = useSafeAreaInsets();
  const { photo } = job;

  const shapes = useMemo(() => {
    const list = [
      { label: ratioLabel(job.aspect), value: job.aspect[0] / job.aspect[1] },
      { label: "Square", value: 1 },
      { label: "Tall", value: 4 / 5 },
      { label: "Original", value: photo.width / photo.height },
    ];

    return list.filter(
      (shape, index) =>
        list.findIndex(
          (other) => Math.abs(other.value - shape.value) < 0.01,
        ) === index,
    );
  }, [job.aspect, photo.width, photo.height]);

  const [shape, setShape] = useState(shapes[0].value);
  const [stage, setStage] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);

  /* The frame: as large as the stage allows, in the shape. */
  const frame = useMemo(() => {
    if (!stage) return null;

    const maxW = stage.width - 40;
    const maxH = stage.height - 40;
    const width = Math.min(maxW, maxH * shape);
    const height = width / shape;

    return {
      width,
      height,
      left: (stage.width - width) / 2,
      top: (stage.height - height) / 2,
    };
  }, [stage, shape]);

  /* At zoom 1 the photo just covers the frame. */
  const base = frame
    ? Math.max(frame.width / photo.width, frame.height / photo.height)
    : 1;

  const fit = (next) => {
    if (!frame) return next;

    const zoom = clamp(next.zoom, 1, 5);
    const shownW = photo.width * base * zoom;
    const shownH = photo.height * base * zoom;
    const roomX = (shownW - frame.width) / 2;
    const roomY = (shownH - frame.height) / 2;

    return {
      zoom,
      x: clamp(next.x, -roomX, roomX),
      y: clamp(next.y, -roomY, roomY),
    };
  };

  /* A new shape starts centred again. */
  useEffect(() => {
    setView({ x: 0, y: 0, zoom: 1 });
  }, [shape]);

  const live = useRef({ view, fit });
  live.current = { view, fit };

  const touch = useRef({ count: 0, x: 0, y: 0, distance: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          touch.current.count = 0;
        },
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;

          if (!touches.length) return;

          const x =
            touches.reduce((sum, t) => sum + t.pageX, 0) / touches.length;
          const y =
            touches.reduce((sum, t) => sum + t.pageY, 0) / touches.length;
          const distance =
            touches.length > 1
              ? Math.hypot(
                  touches[0].pageX - touches[1].pageX,
                  touches[0].pageY - touches[1].pageY,
                )
              : 0;

          const last = touch.current;

          /* A finger added or lifted: start measuring afresh. */
          if (touches.length !== last.count) {
            touch.current = { count: touches.length, x, y, distance };
            return;
          }

          const { view: current, fit: fitView } = live.current;
          let zoom = current.zoom;
          let factor = 1;

          if (touches.length > 1 && last.distance > 0) {
            zoom = clamp((current.zoom * distance) / last.distance, 1, 5);
            factor = zoom / current.zoom;
          }

          setView(
            fitView({
              zoom,
              x: current.x * factor + (x - last.x),
              y: current.y * factor + (y - last.y),
            }),
          );

          touch.current = { count: touches.length, x, y, distance };
        },
        onPanResponderRelease: () => {
          touch.current.count = 0;
        },
      }),
    [],
  );

  const done = async () => {
    if (!frame || busy) return;

    try {
      setBusy(true);

      const scale = base * view.zoom;
      const shownW = photo.width * scale;
      const shownH = photo.height * scale;

      const width = Math.round(Math.min(photo.width, frame.width / scale));
      const height = Math.round(Math.min(photo.height, frame.height / scale));
      const originX = Math.round(
        clamp(
          ((shownW - frame.width) / 2 - view.x) / scale,
          0,
          photo.width - width,
        ),
      );
      const originY = Math.round(
        clamp(
          ((shownH - frame.height) / 2 - view.y) / scale,
          0,
          photo.height - height,
        ),
      );

      const context = Manipulator.ImageManipulator.manipulate(photo.uri);

      context.crop({ originX, originY, width, height });

      if (width > 1600) context.resize({ width: 1600, height: null });

      const image = await context.renderAsync();
      const result = await image.saveAsync({
        format: Manipulator.SaveFormat.JPEG,
        compress: 0.6,
        base64: true,
      });

      Haptics.selectionAsync().catch(() => {});
      onFinish({ uri: result.uri, base64: result.base64 });
    } catch {
      /* If cropping fails, the photo still goes in whole. */
      try {
        const image = await Manipulator.ImageManipulator.manipulate(
          photo.uri,
        ).renderAsync();
        const result = await image.saveAsync({
          format: Manipulator.SaveFormat.JPEG,
          compress: 0.6,
          base64: true,
        });

        onFinish({ uri: result.uri, base64: result.base64 });
      } catch {
        onFinish(null);
      }
    }
  };

  const shownW = photo.width * base * view.zoom;
  const shownH = photo.height * base * view.zoom;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => onFinish(null)}
    >
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.bar}>
          <Pressable
            onPress={() => onFinish(null)}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>

          <Text style={styles.title}>Move and scale</Text>

          <Pressable
            onPress={done}
            hitSlop={12}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={T.gold} />
            ) : (
              <Text style={styles.done}>Done</Text>
            )}
          </Pressable>
        </View>

        <View
          style={styles.stage}
          onLayout={(event) => setStage(event.nativeEvent.layout)}
          {...responder.panHandlers}
        >
          {frame ? (
            <>
              <Image
                source={{ uri: photo.uri }}
                style={{
                  position: "absolute",
                  width: shownW,
                  height: shownH,
                  left: frame.left + (frame.width - shownW) / 2 + view.x,
                  top: frame.top + (frame.height - shownH) / 2 + view.y,
                }}
              />

              {/* Everything outside the frame, dimmed. */}
              <View
                pointerEvents="none"
                style={[
                  styles.dim,
                  { left: 0, right: 0, top: 0, height: frame.top },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.dim,
                  {
                    left: 0,
                    right: 0,
                    top: frame.top + frame.height,
                    bottom: 0,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.dim,
                  {
                    left: 0,
                    width: frame.left,
                    top: frame.top,
                    height: frame.height,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.dim,
                  {
                    left: frame.left + frame.width,
                    right: 0,
                    top: frame.top,
                    height: frame.height,
                  },
                ]}
              />

              <View pointerEvents="none" style={[styles.frame, frame]}>
                <View style={[styles.gridV, { left: "33.33%" }]} />
                <View style={[styles.gridV, { left: "66.66%" }]} />
                <View style={[styles.gridH, { top: "33.33%" }]} />
                <View style={[styles.gridH, { top: "66.66%" }]} />
              </View>
            </>
          ) : null}
        </View>

        <View style={[styles.foot, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hint}>Drag to move · pinch to zoom</Text>

          <View style={styles.shapes}>
            {shapes.map((item) => {
              const on = Math.abs(item.value - shape) < 0.01;

              return (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setShape(item.value);
                  }}
                  style={[styles.shape, on && styles.shapeOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.shapeText, on && styles.shapeTextOn]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    minHeight: 44,
  },

  cancel: {
    fontSize: 17,
    color: "#FFFFFF",
  },

  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  done: {
    fontSize: 17,
    fontWeight: "600",
    color: T.gold,
  },

  stage: {
    flex: 1,
    overflow: "hidden",
  },

  dim: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.62)",
  },

  frame: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.95)",
  },

  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  foot: {
    alignItems: "center",
    gap: 14,
    paddingTop: 14,
  },

  hint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },

  shapes: {
    flexDirection: "row",
    gap: 8,
  },

  shape: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  shapeOn: {
    backgroundColor: "#FFFFFF",
  },

  shapeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  shapeTextOn: {
    color: "#000000",
  },
}));
