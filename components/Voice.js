import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { API_URL } from "../lib/api";
import { T } from "../lib/theme";
import { Icon } from "./ui";
import { uploadMedia } from "./Photo";

/*
 * ==========================================
 * VOICE NOTES
 * ==========================================
 *
 * Record a short message in Notes and it arrives as a
 * bubble they can play. Up to two minutes; the recording
 * goes to the media store like a photo does, and comes
 * back to the other phone as a signed link.
 */

/* A native module: a build without it simply has no mic. */
let Audio = null;

try {
  Audio = require("expo-audio");
} catch {
  Audio = null;
}

export const voiceAvailable = Boolean(Audio);

const LIMIT_MS = 2 * 60 * 1000;

function clock(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/* The finished file, read as base64 without another module. */
async function readBase64(uri) {
  const blob = await (await fetch(uri)).blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/*
 * The mic button, and the bar that replaces the composer
 * while recording: a red dot, the time, Cancel and Send.
 * `onSent(audioId, seconds)` once it is uploaded.
 */
export function VoiceRecorder({ userId, onRecording, onSent }) {
  if (!Audio) return null;

  return <Recorder userId={userId} onRecording={onRecording} onSent={onSent} />;
}

function Recorder({ userId, onRecording, onSent }) {
  const recorder = Audio.useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);
  const state = Audio.useAudioRecorderState(recorder, 250);

  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    onRecording?.(recording);
  }, [recording, onRecording]);

  const start = async () => {
    try {
      const permission = await Audio.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "The microphone is off",
          "Allow Between Us to use the microphone in your phone's settings to send voice notes.",
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setRecording(true);
    } catch (err) {
      Alert.alert(
        "Couldn't start recording",
        err?.message || "Please try again.",
      );
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }

    await Audio.setAudioModeAsync({ allowsRecording: false }).catch(() => {});

    setRecording(false);
  };

  const cancel = async () => {
    await stop();
  };

  const send = async () => {
    const seconds = Math.round((state?.durationMillis || 0) / 1000);

    await stop();

    if (!recorder.uri || seconds < 1) return;

    try {
      setSending(true);

      const base64 = await readBase64(recorder.uri);
      const audioId = await uploadMedia(userId, base64, "audio/mp4");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      onSent?.(audioId, seconds);
    } catch (err) {
      Alert.alert(
        "That voice note didn't send",
        err?.message || "Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  /* Stop at the limit rather than run on. */
  const elapsed = state?.durationMillis || 0;
  const stopping = useRef(false);

  useEffect(() => {
    if (recording && elapsed >= LIMIT_MS && !stopping.current) {
      stopping.current = true;
      send().finally(() => {
        stopping.current = false;
      });
    }
  }, [recording, elapsed]);

  if (!recording) {
    return (
      <Pressable
        onPress={start}
        disabled={sending}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Record a voice note"
      >
        <View style={[styles.mic, sending && styles.micBusy]}>
          <Icon name="mic" size={18} color={T.accent} />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.dot} />

      <Text style={styles.time}>
        {clock(elapsed)} <Text style={styles.limit}>/ {clock(LIMIT_MS)}</Text>
      </Text>

      <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button">
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>

      <Pressable
        onPress={send}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Send voice note"
      >
        <View style={styles.send}>
          <Icon name="arrowUp" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

/*
 * A voice note in a bubble: play or pause, how long it
 * is, and a thin line filling as it plays.
 */
export function VoicePlayer({ url, seconds, light }) {
  if (!Audio || !url) {
    return (
      <Text style={[styles.unavailable, light && styles.lightText]}>
        🎙 Voice note
      </Text>
    );
  }

  return <Player url={url} seconds={seconds} light={light} />;
}

function Player({ url, seconds, light }) {
  const player = Audio.useAudioPlayer({ uri: `${API_URL}${url}` });
  const status = Audio.useAudioPlayerStatus(player);

  const duration = status?.duration || seconds || 0;
  const position = status?.currentTime || 0;
  const playing = Boolean(status?.playing);

  /* Back to the start once it has finished. */
  useEffect(() => {
    if (status?.didJustFinish) player.seekTo(0);
  }, [status?.didJustFinish, player]);

  const toggle = async () => {
    Haptics.selectionAsync().catch(() => {});

    if (playing) {
      player.pause();
      return;
    }

    await Audio.setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

    player.play();
  };

  const ink = light ? "#FFFFFF" : T.label;

  return (
    <Pressable
      onPress={toggle}
      style={styles.player}
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pause voice note" : "Play voice note"}
    >
      <Icon name={playing ? "pause" : "play"} size={18} color={ink} filled />

      <View style={[styles.track, light && styles.trackLight]}>
        <View
          style={[
            styles.fill,
            light && styles.fillLight,
            {
              width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%`,
            },
          ]}
        />
      </View>

      <Text style={[styles.duration, light && styles.lightText]}>
        {clock((playing ? position : duration) * 1000)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  micBusy: {
    opacity: 0.4,
  },

  bar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 32,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.red,
  },

  time: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: T.label,
    fontVariant: ["tabular-nums"],
  },

  limit: {
    fontWeight: "400",
    color: T.label3,
  },

  cancel: {
    fontSize: 16,
    color: T.label2,
  },

  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 180,
    paddingVertical: 2,
  },

  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.fill2,
    overflow: "hidden",
  },

  trackLight: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  fill: {
    height: 4,
    backgroundColor: T.accent,
  },

  fillLight: {
    backgroundColor: "#FFFFFF",
  },

  duration: {
    fontSize: 13,
    color: T.label2,
    fontVariant: ["tabular-nums"],
  },

  lightText: {
    color: "#FFFFFF",
  },

  unavailable: {
    fontSize: 16,
    color: T.label,
  },
});
