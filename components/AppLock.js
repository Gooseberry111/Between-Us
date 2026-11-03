import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";

import { lockEnabled, onLockSettingChanged, unlock } from "../lib/appLock";
import { T } from "../lib/theme";
import { Button, Glow, Mark } from "./ui";

/*
 * ==========================================
 * LOCKED
 * ==========================================
 *
 * When the lock is on, the app opens behind this and asks
 * for Face ID (or a fingerprint, or the passcode) at once.
 * It locks again after a minute away -- long enough that
 * choosing a photo or answering a text does not re-lock it.
 */

const AWAY_MS = 60 * 1000;

export default function AppLock() {
  const [locked, setLocked] = useState(false);
  const [asking, setAsking] = useState(false);

  const enabled = useRef(false);
  const leftAt = useRef(null);

  const ask = useCallback(async () => {
    setAsking(true);

    const ok = await unlock();

    setAsking(false);

    if (ok) setLocked(false);
  }, []);

  /* On opening: locked if the lock is on. */
  useEffect(() => {
    lockEnabled().then((on) => {
      enabled.current = on;

      if (on) {
        setLocked(true);
        ask();
      }
    });

    return onLockSettingChanged((on) => {
      enabled.current = on;
    });
  }, [ask]);

  /* After a minute away: locked again. */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        leftAt.current = Date.now();
        return;
      }

      if (state !== "active" || !enabled.current || !leftAt.current) return;

      const away = Date.now() - leftAt.current;

      leftAt.current = null;

      if (away >= AWAY_MS) {
        setLocked(true);
        ask();
      }
    });

    return () => subscription.remove();
  }, [ask]);

  if (!locked) return null;

  return (
    <View style={styles.root}>
      <Glow height={520} />

      <View style={styles.centre}>
        <Mark size={68} />

        <Text style={styles.title}>Between Us is locked</Text>

        <Text style={styles.text}>Just the two of you in here.</Text>
      </View>

      <View style={styles.footer}>
        <Button
          title={asking ? "Checking…" : "Unlock"}
          icon="lock"
          onPress={ask}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 350,
    backgroundColor: T.appBackground,
  },

  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: T.label,
    marginTop: 24,
  },

  text: {
    fontSize: 16,
    color: T.label2,
    marginTop: 6,
  },

  footer: {
    paddingBottom: 56,
  },
});
