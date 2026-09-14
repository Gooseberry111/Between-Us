import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassBackground } from "../../components/Glass";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import DateInput from "../../components/DateInput";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { Skeleton, SkeletonList } from "../../components/Skeleton";

const API_URL = "https://between-us-api.between-us.workers.dev";

/*
 * ==========================================
 * TIMELINE
 * ==========================================
 *
 * A single chronological story of the
 * relationship, combining:
 *
 * - Memories you write yourself
 * - Dreams you've completed together
 * - Special dates you've saved
 *
 * Only memories are created/edited/deleted here.
 * Dreams and special dates are read-only entries
 * that link back to their own screens.
 */

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

export default function TimelineScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `timeline:${userId}` : null;
  const cachedEntries = cacheKey ? getCachedData(cacheKey) : undefined;

  const [entries, setEntries] = useState(cachedEntries || []);
  const [loading, setLoading] = useState(!cachedEntries);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memoryDate, setMemoryDate] = useState(todayIsoDate());
  const [saving, setSaving] = useState(false);

  const loadTimeline = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cached = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cached) {
      setEntries(cached);
      setLoading(false);
    }

    try {
      setError("");

      const [memoriesResponse, dreamsResponse, specialDatesResponse] =
        await Promise.all([
          fetch(`${API_URL}/users/${userId}/memories`),
          fetch(`${API_URL}/users/${userId}/dreams`),
          fetch(`${API_URL}/users/${userId}/special-dates`),
        ]);

      const [memoriesData, dreamsData, specialDatesData] = await Promise.all([
        memoriesResponse.json(),
        dreamsResponse.json(),
        specialDatesResponse.json(),
      ]);

      console.log("TIMELINE MEMORIES:", memoriesData);
      console.log("TIMELINE DREAMS:", dreamsData);
      console.log("TIMELINE SPECIAL DATES:", specialDatesData);

      if (!memoriesResponse.ok) {
        throw new Error(memoriesData?.error || "Unable to load your timeline.");
      }

      const memoryEntries = (
        Array.isArray(memoriesData) ? memoriesData : []
      ).map((memory) => ({
        id: `memory-${memory.id}`,
        kind: "memory",
        date: memory.memory_date,
        title: memory.title,
        description: memory.description,
        raw: memory,
      }));

      const dreamEntries = (
        Array.isArray(dreamsData?.dreams) ? dreamsData.dreams : []
      )
        .filter((dream) => dream.is_completed)
        .map((dream) => ({
          id: `dream-${dream.id}`,
          kind: "dream",
          date: dream.completed_at || dream.target_date,
          title: dream.title,
          description: dream.description,
          raw: dream,
        }));

      const specialDateEntries = (
        Array.isArray(specialDatesData?.special_dates)
          ? specialDatesData.special_dates
          : []
      ).map((specialDate) => ({
        id: `special-date-${specialDate.id}`,
        kind: "special_date",
        date: specialDate.event_date,
        title: specialDate.title,
        description: null,
        raw: specialDate,
      }));

      const merged = [...memoryEntries, ...dreamEntries, ...specialDateEntries]
        .filter((entry) => entry.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      setEntries(merged);

      if (cacheKey) setCachedData(cacheKey, merged);
    } catch (err) {
      console.log("TIMELINE LOAD ERROR:", err);

      if (!cached) {
        setError(err?.message || "Unable to load your timeline.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTimeline();
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMemoryDate(todayIsoDate());
    setEditingMemory(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingMemory(null);
    setTitle("");
    setDescription("");
    setMemoryDate(todayIsoDate());
    setShowForm(true);
  };

  const openEditForm = (memory) => {
    setEditingMemory(memory);
    setTitle(memory.title || "");
    setDescription(memory.description || "");
    setMemoryDate(
      memory.memory_date
        ? new Date(memory.memory_date).toISOString().split("T")[0]
        : todayIsoDate(),
    );
    setShowForm(true);
  };

  const saveMemory = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please give this memory a title.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Missing description", "Tell us a little about this memory.");
      return;
    }

    if (!memoryDate.trim()) {
      Alert.alert("Missing date", "When did this happen?");
      return;
    }

    if (!userId) return;

    try {
      setSaving(true);

      let response;

      if (editingMemory) {
        response = await fetch(
          `${API_URL}/users/${userId}/memories/${editingMemory.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              memory_date: memoryDate.trim(),
            }),
          },
        );
      } else {
        response = await fetch(`${API_URL}/users/${userId}/memories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            memory_date: memoryDate.trim(),
          }),
        });
      }

      const data = await response.json();

      console.log(
        editingMemory ? "UPDATE MEMORY RESPONSE:" : "CREATE MEMORY RESPONSE:",
        data,
      );

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save memory.");
      }

      resetForm();
      await loadTimeline();
    } catch (err) {
      console.log("SAVE MEMORY ERROR:", err);
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to save memory.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteMemory = (entry) => {
    Alert.alert(
      "Delete memory?",
      `"${entry.title}" will be permanently removed.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_URL}/users/${userId}/memories/${entry.raw.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              console.log("DELETE MEMORY RESPONSE:", data);

              if (!response.ok) {
                throw new Error(data?.error || "Unable to delete memory.");
              }

              setEntries((current) => {
                const next = current.filter((item) => item.id !== entry.id);
                if (cacheKey) setCachedData(cacheKey, next);
                return next;
              });
            } catch (err) {
              console.log("DELETE MEMORY ERROR:", err);

              Alert.alert(
                "Something went wrong",
                err?.message || "Unable to delete memory.",
              );
            }
          },
        },
      ],
    );
  };

  if (loading) {
    /*
     * Cold load only (nothing cached yet). Mirrors the
     * real layout so the page appears at once and fills
     * in, instead of blocking on a spinner.
     */
    return (
      <SafeAreaView style={styles.screen}>
        <GlassBackground>
          <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
            <Skeleton width={96} height={11} radius={6} />
            <Skeleton
              width="62%"
              height={26}
              radius={9}
              style={{ marginTop: 12 }}
            />
            <Skeleton width="80%" height={12} style={{ marginTop: 10 }} />

            <View style={{ marginTop: 26 }}>
              <SkeletonList count={3} />
            </View>
          </View>
        </GlassBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <GlassBackground>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#6B4E45"
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.container}>
              {/* HEADER */}

              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.brand}>BETWEEN US</Text>

                  <Text style={styles.pageTitle}>Timeline</Text>

                  <Text style={styles.pageSubtitle}>
                    Your story together, one moment at a time.
                  </Text>
                </View>

                <View style={styles.headerIcon}>
                  <Ionicons name="time-outline" size={22} color="#6B4E45" />
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* ADD BUTTON */}

              {!showForm ? (
                <TouchableOpacity
                  style={styles.addButton}
                  activeOpacity={0.85}
                  onPress={openCreateForm}
                >
                  <View style={styles.addIcon}>
                    <Text style={styles.addIconText}>+</Text>
                  </View>

                  <View style={styles.addContent}>
                    <Text style={styles.addTitle}>Add a memory</Text>

                    <Text style={styles.addSubtitle}>
                      Save a moment that matters to both of you.
                    </Text>
                  </View>

                  <Text style={styles.addArrow}>→</Text>
                </TouchableOpacity>
              ) : null}

              {/* FORM */}

              {showForm ? (
                <View style={styles.formCard}>
                  <View style={styles.formHeader}>
                    <View>
                      <Text style={styles.formLabel}>
                        {editingMemory ? "EDIT MEMORY" : "NEW MEMORY"}
                      </Text>

                      <Text style={styles.formTitle}>
                        {editingMemory
                          ? "Update this moment."
                          : "Capture this moment."}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={resetForm}
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>TITLE</Text>

                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Our first date"
                    placeholderTextColor="#A59A93"
                    style={styles.input}
                    returnKeyType="next"
                  />

                  <Text style={styles.inputLabel}>WHEN DID THIS HAPPEN?</Text>

                  <DateInput
                    value={memoryDate}
                    onChangeText={setMemoryDate}
                    style={styles.input}
                  />

                  <Text style={styles.inputLabel}>DESCRIPTION</Text>

                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What happened?"
                    placeholderTextColor="#A59A93"
                    style={[styles.input, styles.descriptionInput]}
                    multiline
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      saving && styles.saveButtonDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={saveMemory}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {editingMemory ? "Save changes" : "Save memory"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* TIMELINE */}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>YOUR STORY</Text>

                <Text style={styles.sectionTitle}>
                  {entries.length === 0
                    ? "Nothing here yet."
                    : `${entries.length} ${
                        entries.length === 1 ? "moment" : "moments"
                      } together.`}
                </Text>

                {entries.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="time-outline" size={24} color="#6B4E45" />
                    </View>

                    <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                    <Text style={styles.emptyText}>
                      Your timeline fills in on its own as you add memories,
                      complete dreams together, and save special dates. Start
                      with a memory below.
                    </Text>

                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={openCreateForm}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.emptyButtonText}>
                        Add your first memory
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  entries.map((entry) => (
                    <TimelineCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => openEditForm(entry.raw)}
                      onDelete={() => deleteMemory(entry)}
                      onPress={() => {
                        if (entry.kind === "dream") {
                          router.push("/(tabs)/dreams");
                        } else if (entry.kind === "special_date") {
                          router.push("/special-dates");
                        }
                      }}
                    />
                  ))
                )}
              </View>

              {/* FOOTER */}

              {entries.length > 0 ? (
                <View style={styles.footerCard}>
                  <Text style={styles.footerQuote}>
                    "Some moments deserve to be remembered forever."
                  </Text>

                  <Text style={styles.footerText}>
                    Keep building your story, one moment at a time.
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassBackground>
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * TIMELINE CARD
 * ==========================================
 */

const KIND_META = {
  memory: {
    label: "MEMORY",
    icon: "heart-outline",
  },
  dream: {
    label: "DREAM ACHIEVED",
    icon: "sparkles-outline",
  },
  special_date: {
    label: "SPECIAL DATE",
    icon: "calendar-outline",
  },
};

function TimelineCard({ entry, onEdit, onDelete, onPress }) {
  const meta = KIND_META[entry.kind] || KIND_META.memory;

  const date = entry.date
    ? new Date(entry.date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "No date";

  const isMemory = entry.kind === "memory";

  const CardWrapper = isMemory ? View : TouchableOpacity;

  return (
    <CardWrapper
      style={styles.entryCard}
      {...(!isMemory ? { activeOpacity: 0.85, onPress } : {})}
    >
      <View style={styles.entryTop}>
        <View style={styles.entryKindBadge}>
          <Ionicons name={meta.icon} size={13} color="#6B4E45" />

          <Text style={styles.entryKindText}>{meta.label}</Text>
        </View>

        <View style={styles.entryDateContainer}>
          <Text style={styles.entryDate}>{date}</Text>
        </View>
      </View>

      <Text style={styles.entryTitle}>{entry.title}</Text>

      {entry.description ? (
        <Text style={styles.entryDescription}>{entry.description}</Text>
      ) : null}

      {isMemory ? (
        <>
          <View style={styles.entryDivider} />

          <View style={styles.entryBottom}>
            <View style={styles.entryCreated}>
              <View style={styles.miniHeart}>
                <Text style={styles.miniHeartText}>♡</Text>
              </View>

              <Text style={styles.entryCreatedText}>A moment together</Text>
            </View>

            <View style={styles.entryActions}>
              <TouchableOpacity
                style={styles.editButton}
                activeOpacity={0.8}
                onPress={onEdit}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                activeOpacity={0.8}
                onPress={onDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.entryLinkRow}>
          <Text style={styles.entryLinkText}>
            {entry.kind === "dream"
              ? "View on Dream Board"
              : "View Special Dates"}
          </Text>

          <Text style={styles.entryLinkArrow}>→</Text>
        </View>
      )}
    </CardWrapper>
  );
}

/*
 * ==========================================
 * STYLES
 * ==========================================
 */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },

  /*
   * HEADER
   */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },

  headerText: {
    flex: 1,
  },

  brand: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#6B4E45",
  },

  pageTitle: {
    marginTop: 7,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "700",
    color: "#302825",
  },

  pageSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
    maxWidth: 280,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  /*
   * ADD MEMORY
   */

  addButton: {
    backgroundColor: "#6B4E45",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
  },

  addIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  addIconText: {
    fontSize: 25,
    lineHeight: 28,
    color: "#6B4E45",
    fontWeight: "400",
  },

  addContent: {
    flex: 1,
    marginLeft: 13,
  },

  addTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  addSubtitle: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#DCCBC4",
  },

  addArrow: {
    fontSize: 21,
    color: "#FFFFFF",
    marginLeft: 8,
  },

  /*
   * FORM
   */

  formCard: {
    marginTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },

  formHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  formLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#9A918A",
  },

  formTitle: {
    marginTop: 5,
    fontSize: 19,
    fontWeight: "700",
    color: "#302825",
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },

  closeButtonText: {
    fontSize: 22,
    lineHeight: 24,
    color: "#6B4E45",
  },

  inputLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#9A918A",
    marginBottom: 7,
  },

  input: {
    minHeight: 49,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#302825",
    marginBottom: 16,
  },

  descriptionInput: {
    height: 120,
    marginBottom: 5,
  },

  saveButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /*
   * SECTION
   */

  section: {
    marginTop: 30,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 7,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 13,
  },

  /*
   * TIMELINE ENTRY CARD
   */

  entryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    marginBottom: 13,
  },

  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  entryKindBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 5,
  },

  entryKindText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#6B4E45",
  },

  entryDateContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },

  entryDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#817771",
  },

  entryTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#302825",
  },

  entryDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
  },

  entryDivider: {
    height: 1,
    backgroundColor: "#EAE3DE",
    marginVertical: 16,
  },

  entryBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  entryCreated: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  miniHeart: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },

  miniHeartText: {
    fontSize: 16,
    color: "#6B4E45",
  },

  entryCreatedText: {
    marginLeft: 8,
    fontSize: 10,
    color: "#9A918A",
  },

  entryActions: {
    flexDirection: "row",
    gap: 7,
  },

  editButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },

  editButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B4E45",
  },

  deleteButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#F5E8E5",
  },

  deleteButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A4A3D",
  },

  entryLinkRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  entryLinkText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B4E45",
  },

  entryLinkArrow: {
    fontSize: 15,
    color: "#6B4E45",
  },

  /*
   * EMPTY STATE
   */

  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#302825",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 17,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B4E45",
  },

  /*
   * FOOTER
   */

  footerCard: {
    marginTop: 17,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#EFE7E2",
    alignItems: "center",
  },

  footerQuote: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: "#6B4E45",
  },

  footerText: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#8D837C",
  },

  /*
   * ERROR
   */

  errorBox: {
    backgroundColor: "#F3E3DF",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 15,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#8A4A3D",
  },

  /*
   * LOADING
   */

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: "#817771",
  },
});
