import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { GlassBackground, GlassPanel, Card, FadeIn } from "../components/Glass";
import { Skeleton } from "../components/Skeleton";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { apiFetch } from "../lib/api";
import ConnectFirst from "../components/ConnectFirst";
import { useIsConnected } from "../lib/connection";

/*
 * A weekly temperature check.
 *
 * One number each, once a week, is enough to spot a
 * dip early -- which is the point. It is much easier
 * to talk about a bad week while it is still one bad
 * week.
 */

const SCALE = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Off" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export default function CheckInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `checkin:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(cached?.your_checkin?.rating ?? null);
  const [note, setNote] = useState(cached?.your_checkin?.note ?? "");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await apiFetch(`/users/${userId}/checkin`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to load your check-in.");
      }

      setData(json);
      setRating(json?.your_checkin?.rating ?? null);
      setNote(json?.your_checkin?.note ?? "");

      if (cacheKey) setCachedData(cacheKey, json);
    } catch (err) {
      console.log("CHECKIN LOAD ERROR:", err);
      setError(err?.message || "Unable to load your check-in.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!rating || saving || !userId) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, note: note.trim() || null }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to save your check-in.");
      }

      setData(json);

      if (cacheKey) setCachedData(cacheKey, json);
    } catch (err) {
      console.log("CHECKIN SAVE ERROR:", err);
      Alert.alert("Something went wrong", err?.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const partnerName = data?.partner_name || "Your partner";
  const mineDone = Boolean(data?.your_checkin);

  /* Your own recent weeks, oldest first, for the trend. */
  const trend = (data?.history || [])
    .filter((h) => h.mine)
    .slice(0, 8)
    .reverse();

  if (connected === false) {
    return <ConnectFirst feature="Check-in" showBack={true} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton}
                  activeOpacity={0.8}
                  onPress={() => router.back()}
                >
                  <Ionicons name="chevron-back" size={20} color="#6B4E45" />
                </TouchableOpacity>

                <View style={styles.headerText}>
                  <Text style={styles.brand}>THIS WEEK</Text>

                  <Text style={styles.pageTitle}>Check-in</Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {loading ? (
                <View>
                  <Skeleton width="100%" height={150} radius={24} />
                  <Skeleton
                    width="100%"
                    height={110}
                    radius={20}
                    style={{ marginTop: 14 }}
                  />
                </View>
              ) : (
                <FadeIn>
                  <GlassPanel style={styles.panel}>
                    <Text style={styles.panelLabel}>HOW HAS IT BEEN?</Text>

                    <Text style={styles.panelTitle}>
                      How are we doing this week?
                    </Text>

                    <View style={styles.scaleRow}>
                      {SCALE.map((step) => {
                        const active = rating === step.value;

                        return (
                          <TouchableOpacity
                            key={step.value}
                            style={[
                              styles.scaleItem,
                              active && styles.scaleItemActive,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => setRating(step.value)}
                          >
                            <Text
                              style={[
                                styles.scaleValue,
                                active && styles.scaleValueActive,
                              ]}
                            >
                              {step.value}
                            </Text>

                            <Text
                              style={[
                                styles.scaleLabel,
                                active && styles.scaleLabelActive,
                              ]}
                            >
                              {step.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder="Anything worth saying about it? (optional)"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      style={styles.input}
                      multiline
                      textAlignVertical="top"
                    />

                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        (!rating || saving) && styles.saveButtonDisabled,
                      ]}
                      activeOpacity={0.85}
                      onPress={submit}
                      disabled={!rating || saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveButtonText}>
                          {mineDone ? "Update this week" : "Save this week"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </GlassPanel>

                  {/* PARTNER */}

                  <Card style={styles.card}>
                    <Text style={styles.cardLabel}>
                      {partnerName.toUpperCase()}
                    </Text>

                    {data?.partner_checkin ? (
                      <View>
                        <Text style={styles.partnerRating}>
                          {data.partner_checkin.rating}
                          <Text style={styles.partnerOutOf}> / 5</Text>
                        </Text>

                        {data.partner_checkin.note ? (
                          <Text style={styles.partnerNote}>
                            {data.partner_checkin.note}
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.waitingText}>
                        {partnerName} hasn't checked in this week yet.
                      </Text>
                    )}
                  </Card>

                  {/* TREND */}

                  {trend.length > 1 ? (
                    <Card style={styles.card}>
                      <Text style={styles.cardLabel}>YOUR LAST FEW WEEKS</Text>

                      <View style={styles.trendRow}>
                        {trend.map((week, index) => (
                          <View key={index} style={styles.trendColumn}>
                            <View
                              style={[
                                styles.trendBar,
                                { height: 14 + week.rating * 16 },
                              ]}
                            />

                            <Text style={styles.trendValue}>{week.rating}</Text>
                          </View>
                        ))}
                      </View>
                    </Card>
                  ) : null}
                </FadeIn>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  container: { paddingHorizontal: 22, paddingTop: 22 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  headerText: { flex: 1 },

  brand: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
  },

  pageTitle: {
    marginTop: 5,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "700",
    color: "#302825",
  },

  panel: { marginBottom: 14 },

  panelLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#DCCBC4",
  },

  panelTitle: {
    marginTop: 10,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  scaleRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 18,
  },

  scaleItem: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 13,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
  },

  scaleItemActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },

  scaleValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  scaleValueActive: { color: "#6B4E45" },

  scaleLabel: {
    marginTop: 3,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.7)",
  },

  scaleLabelActive: { color: "#8A6B60" },

  input: {
    marginTop: 16,
    minHeight: 70,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.34)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
  },

  saveButton: {
    marginTop: 14,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.42)",
  },

  saveButtonDisabled: { opacity: 0.45 },

  saveButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 13,
  },

  cardLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#9A918A",
  },

  partnerRating: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: "800",
    color: "#302825",
  },

  partnerOutOf: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9A918A",
  },

  partnerNote: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#5C534E",
  },

  waitingText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
  },

  trendRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
  },

  trendColumn: {
    flex: 1,
    alignItems: "center",
  },

  trendBar: {
    width: "100%",
    borderRadius: 7,
    backgroundColor: "#6B4E45",
    opacity: 0.75,
  },

  trendValue: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: "#817771",
  },

  errorBox: {
    backgroundColor: "rgba(243, 227, 223, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 15,
  },

  errorText: { fontSize: 12, lineHeight: 17, color: "#8A4A3D" },
});
