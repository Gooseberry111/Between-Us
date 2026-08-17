import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export default function HomeScreen() {
  const [status, setStatus] = useState("Testing API...");

  useEffect(() => {
    apiFetch("/health")
      .then((data) => {
        setStatus(`API: ${data.status}\nDatabase: ${data.database}`);
      })
      .catch((error) => {
        setStatus(`Error: ${error.message}`);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Between Us API</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    textAlign: "center",
  },
});
