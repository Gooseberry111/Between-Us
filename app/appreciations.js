import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
import { Skeleton, SkeletonList } from "../components/Skeleton";
import { getCachedData, setCachedData } from "../lib/dataCache";

const API_URL = "https://between-us-api.between-us.workers.dev";

/*
 * Saying thank you out loud is the single cheapest
 * thing that makes a relationship feel better, and
 * it is the thing people most often forget. Keeping
 * a running list means it also becomes something to
 * look back on.
 */

export default function AppreciationsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `appreciations:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [notes, setNotes] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/appreciations`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to load appreciations.");
      }

      const list = Array.isArray(json?.appreciations) ? json.appreciations : [];

      setNotes(list);

      if (cacheKey) setCachedData(cacheKey, list);
    } catch (err) {
      console.log("APPRECIATIONS LOAD ERROR:", err);
      setError(err?.message || "Unable to load appreciations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const message = draft.trim();

    if (!message || sending || !userId) return;

    try {
      setSending(true);

      const response = await fetch(`${API_URL}/users/${userId}/appreciations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Unable to send that.");
      }

      setDraft("");

      const list = Array.isArray(json?.appreciations) ? json.appreciations : [];

      setNotes(list);

      if (cacheKey) setCachedData(cacheKey, list);
    } catch (err) {
      console.log("APPRECIATION SEND ERROR:", err);
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to send that.",
      );
    } finally {
      setSending(false);
    }
  };

  const remove = (note) => {
    Alert.alert("Delete this note?", "It will be removed for both of you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await fetch(
              `${API_URL}/users/${userId}/appreciations/${note.id}`,
              { method: "DELETE" },
            );

            const json = await response.json();

            if (!response.ok) {
              throw new Error(json?.error || "Unable to delete that.");
            }

            setNotes((current) => {
              const next = current.filter((item) => item.id !== note.id);
              if (cacheKey) setCachedData(cacheKey, next);
              return next;
            });
          } catch (err) {
            console.log("APPRECIATION DELETE ERROR:", err);
            Alert.alert(
              "Something went wrong",
              err?.message || "Unable to delete that.",
            );
          }
        },
      },
    ]);
  };

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor="#6B4E45"
              />
            }
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
                  <Text style={styles.brand}>BETWEEN US</Text>

                  <Text style={styles.pageTitle}>Appreciation</Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <FadeIn>
                <GlassPanel style={styles.composer}>
                  <Text style={styles.composerLabel}>SAY THANK YOU</Text>

                  <Text style={styles.composerTitle}>
                    What did they do that you noticed?
                  </Text>

                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Thank you for..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    style={styles.input}
                    multiline
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!draft.trim() || sending) && styles.sendButtonDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={send}
                    disabled={!draft.trim() || sending}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sendButtonText}>Send it</Text>
                    )}
                  </TouchableOpacity>
                </GlassPanel>
              </FadeIn>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>WHAT YOU'VE NOTICED</Text>

                {loading ? (
                  <SkeletonList count={3} />
                ) : notes.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                    <Text style={styles.emptyText}>
                      The small things are the ones worth saying out loud. Start
                      with one.
                    </Text>
                  </Card>
                ) : (
                  notes.map((note, index) => (
                    <FadeIn key={note.id} delay={index * 45}>
                      <Card style={styles.noteCard}>
                        <View style={styles.noteTop}>
                          <View
                            style={[
                              styles.noteBadge,
                              note.mine && styles.noteBadgeMine,
                            ]}
                          >
                            <Text style={styles.noteBadgeText}>
                              {note.mine
                                ? "YOU SAID"
                                : `${(note.from_first_name || "THEY").toUpperCase()} SAID`}
                            </Text>
                          </View>

                          <Text style={styles.noteDate}>
                            {note.created_at
                              ? new Date(note.created_at).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" },
                                )
                              : ""}
                          </Text>
                        </View>

                        <Text style={styles.noteText}>{note.message}</Text>

                        {note.mine ? (
                          <TouchableOpacity
                            style={styles.deleteButton}
                            activeOpacity={0.8}
                            onPress={() => remove(note)}
                          >
                            <Text style={styles.deleteButtonText}>Delete</Text>
                          </TouchableOpacity>
                        ) : null}
                      </Card>
                    </FadeIn>
                  ))
                )}
              </View>
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

  composer: { marginBottom: 8 },

  composerLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#DCCBC4",
  },

  composerTitle: {
    marginTop: 10,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  input: {
    marginTop: 14,
    minHeight: 84,
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

  sendButton: {
    marginTop: 13,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.42)",
  },

  sendButtonDisabled: { opacity: 0.45 },

  sendButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  section: { marginTop: 28 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 12,
  },

  noteCard: {
    borderRadius: 20,
    padding: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 11,
  },

  noteTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  noteBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(107, 78, 69, 0.1)",
  },

  noteBadgeMine: {
    backgroundColor: "rgba(127, 163, 131, 0.18)",
  },

  noteBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#6B4E45",
  },

  noteDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9A918A",
  },

  noteText: {
    marginTop: 12,
    fontSize: 14.5,
    lineHeight: 21,
    color: "#302825",
  },

  deleteButton: {
    alignSelf: "flex-start",
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "rgba(196, 121, 106, 0.14)",
  },

  deleteButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A4A3D",
  },

  emptyCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#302825",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
    textAlign: "center",
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
