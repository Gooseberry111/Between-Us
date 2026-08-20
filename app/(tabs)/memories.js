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
import { useAuth } from "@clerk/expo";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function MemoriesScreen() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMemories = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/memories`);
      const data = await response.json();

      console.log("MEMORIES RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load memories.");
      }

      setMemories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("MEMORIES LOAD ERROR:", err);
      setError(err?.message || "Unable to load memories.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMemories();
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEditingMemory(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingMemory(null);
    setTitle("");
    setDescription("");
    setShowForm(true);
  };

  const openEditForm = (memory) => {
    setEditingMemory(memory);
    setTitle(memory.title || "");
    setDescription(memory.description || "");
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
      await loadMemories();
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

  const deleteMemory = (memory) => {
    Alert.alert(
      "Delete memory?",
      `"${memory.title}" will be permanently removed.`,
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
                `${API_URL}/users/${userId}/memories/${memory.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              console.log("DELETE MEMORY RESPONSE:", data);

              if (!response.ok) {
                throw new Error(data?.error || "Unable to delete memory.");
              }

              setMemories((current) =>
                current.filter((item) => item.id !== memory.id),
              );
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
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6B4E45" />

          <Text style={styles.loadingText}>Loading your memories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
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

                <Text style={styles.pageTitle}>Memories</Text>

                <Text style={styles.pageSubtitle}>
                  The moments you never want to forget.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Text style={styles.headerHeart}>♡</Text>
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

            {/* MEMORIES */}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionLabel}>YOUR STORY</Text>

                  <Text style={styles.sectionTitle}>
                    {memories.length === 0
                      ? "Start collecting moments."
                      : `${memories.length} ${
                          memories.length === 1 ? "memory" : "memories"
                        } together.`}
                  </Text>
                </View>
              </View>

              {memories.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Text style={styles.emptyHeart}>♡</Text>
                  </View>

                  <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                  <Text style={styles.emptyText}>
                    Your favorite moments will live here. Start with something
                    small, like your first date, a funny moment, or a day you
                    never want to forget.
                  </Text>

                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={openCreateForm}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptyButtonText}>
                      Create your first memory
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                memories.map((memory, index) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    index={index}
                    onEdit={() => openEditForm(memory)}
                    onDelete={() => deleteMemory(memory)}
                  />
                ))
              )}
            </View>

            {/* FOOTER */}

            {memories.length > 0 ? (
              <View style={styles.footerCard}>
                <Text style={styles.footerQuote}>
                  "Some moments deserve to be remembered forever."
                </Text>

                <Text style={styles.footerText}>
                  Keep building your story, one memory at a time.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * MEMORY CARD
 * ==========================================
 */

function MemoryCard({ memory, index, onEdit, onDelete }) {
  const date = memory.memory_date
    ? new Date(memory.memory_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "No date";

  return (
    <View style={styles.memoryCard}>
      <View style={styles.memoryTop}>
        <View style={styles.memoryNumber}>
          <Text style={styles.memoryNumberText}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>

        <View style={styles.memoryDateContainer}>
          <Text style={styles.memoryDate}>{date}</Text>
        </View>
      </View>

      <Text style={styles.memoryTitle}>{memory.title}</Text>

      <Text style={styles.memoryDescription}>{memory.description}</Text>

      <View style={styles.memoryDivider} />

      <View style={styles.memoryBottom}>
        <View style={styles.memoryCreated}>
          <View style={styles.miniHeart}>
            <Text style={styles.miniHeartText}>♡</Text>
          </View>

          <Text style={styles.memoryCreatedText}>A moment together</Text>
        </View>

        <View style={styles.memoryActions}>
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
    </View>
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
    backgroundColor: "#F8F5F0",
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
  },

  headerHeart: {
    fontSize: 27,
    color: "#6B4E45",
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
    backgroundColor: "#E9DED8",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "#EAE3DE",
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
    backgroundColor: "#F1E9E5",
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
    backgroundColor: "#F8F5F0",
    borderWidth: 1,
    borderColor: "#EAE3DE",
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

  sectionHeader: {
    marginBottom: 13,
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
  },

  /*
   * MEMORY CARD
   */

  memoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE3DE",
    marginBottom: 13,
  },

  memoryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  memoryNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  memoryNumberText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B4E45",
    letterSpacing: 0.5,
  },

  memoryDateContainer: {
    backgroundColor: "#F8F5F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },

  memoryDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#817771",
  },

  memoryTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#302825",
  },

  memoryDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
  },

  memoryDivider: {
    height: 1,
    backgroundColor: "#EAE3DE",
    marginVertical: 16,
  },

  memoryBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  memoryCreated: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  miniHeart: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1E9E5",
    justifyContent: "center",
    alignItems: "center",
  },

  miniHeartText: {
    fontSize: 16,
    color: "#6B4E45",
  },

  memoryCreatedText: {
    marginLeft: 8,
    fontSize: 10,
    color: "#9A918A",
  },

  memoryActions: {
    flexDirection: "row",
    gap: 7,
  },

  editButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#F1E9E5",
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

  /*
   * EMPTY STATE
   */

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#EAE3DE",
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyHeart: {
    fontSize: 30,
    color: "#6B4E45",
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
    backgroundColor: "#F1E9E5",
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
