import { Component } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/*
 * ==========================================
 * ERROR CATCHER
 * ==========================================
 *
 * A release build has no red error screen: anything
 * thrown while the app starts just closes it, with
 * nothing to go on. This catches those errors and
 * puts them on screen so they can be read and sent.
 */

export default class ErrorCatcher extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    /* Errors thrown outside rendering, e.g. in a timer or
     * a promise, never reach getDerivedStateFromError. */
    const errorUtils = global.ErrorUtils;

    if (!errorUtils?.setGlobalHandler) return;

    this.previousHandler = errorUtils.getGlobalHandler?.();

    errorUtils.setGlobalHandler((error, isFatal) => {
      if (isFatal) this.setState({ error });

      this.previousHandler?.(error, isFatal);
    });
  }

  componentDidCatch(error, info) {
    console.log("APP CRASHED:", error?.message, info?.componentStack);
  }

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Between Us hit an error</Text>

        <Text style={styles.subtitle}>
          Please screenshot this and send it over.
        </Text>

        <ScrollView style={styles.box} contentContainerStyle={styles.boxInner}>
          <Text style={styles.message} selectable>
            {String(error?.message || error)}
          </Text>

          <Text style={styles.stack} selectable>
            {String(error?.stack || "").split("\n").slice(0, 12).join("\n")}
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2ECF4",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111114",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(60,60,67,0.6)",
  },

  box: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#FDE8F5",
  },

  boxInner: {
    padding: 14,
  },

  message: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#FF3B30",
  },

  stack: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: "#F03FA9",
  },
});
