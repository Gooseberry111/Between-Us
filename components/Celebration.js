import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";

/*
 * ==========================================
 * CELEBRATION
 * ==========================================
 *
 * A short burst shown when a dream or goal is
 * completed. Finishing something together is the
 * best moment the app has, and it used to pass
 * with the row silently vanishing from a list.
 *
 * Built on the built-in Animated API, so there is
 * no extra dependency and it runs in Expo Go.
 */

const PIECES = [
  { x: -120, y: -190, delay: 0, color: "#C4796A", size: 11 },
  { x: -60, y: -240, delay: 60, color: "#E0B58F", size: 8 },
  { x: 0, y: -270, delay: 20, color: "#7FA383", size: 13 },
  { x: 70, y: -230, delay: 90, color: "#B98BA6", size: 9 },
  { x: 130, y: -180, delay: 40, color: "#6B4E45", size: 10 },
  { x: -160, y: -110, delay: 110, color: "#E0B58F", size: 7 },
  { x: 160, y: -100, delay: 75, color: "#C4796A", size: 12 },
  { x: -100, y: -50, delay: 140, color: "#7FA383", size: 8 },
  { x: 110, y: -40, delay: 125, color: "#B98BA6", size: 10 },
];

function Piece({ x, y, delay, color, size, running }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!running) {
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [running, progress, delay]);

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: progress.interpolate({
            inputRange: [0, 0.15, 0.75, 1],
            outputRange: [0, 1, 1, 0],
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, x],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, y],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.3, 1.1, 0.7],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export default function Celebration({ visible, title, message, onDone }) {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      pop.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.delay(1250),
      Animated.timing(pop, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && onDone) onDone();
    });
  }, [visible, pop, onDone]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.burstOrigin}>
          {PIECES.map((piece, index) => (
            <Piece key={index} {...piece} running={visible} />
          ))}
        </View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [
                {
                  scale: pop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.tick}>✓</Text>

          <Text style={styles.title}>{title}</Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(48, 40, 37, 0.35)",
  },

  burstOrigin: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  piece: {
    position: "absolute",
  },

  card: {
    minWidth: 250,
    paddingHorizontal: 26,
    paddingVertical: 28,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    shadowColor: "#3A2A25",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },

  tick: {
    fontSize: 30,
    fontWeight: "800",
    color: "#7FA383",
  },

  title: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: "800",
    color: "#302825",
    textAlign: "center",
  },

  message: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
    textAlign: "center",
    maxWidth: 230,
  },
});
