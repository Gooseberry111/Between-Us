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
import { GlassBackground } from "../components/Glass";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import DateInput from "../components/DateInput";
import {
  getCachedData,
  setCachedData,
  clearCachedData,
} from "../lib/dataCache";
import { Skeleton, SkeletonList } from "../components/Skeleton";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function GoalsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `goals:${userId}` : null;
  const cachedGoals = cacheKey ? getCachedData(cacheKey) : undefined;

  const [goals, setGoals] = useState(cachedGoals || []);
  const [loading, setLoading] = useState(!cachedGoals);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const loadGoals = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    // Show what we fetched last time immediately, then
    // quietly refresh in the background.
    const cached = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cached) {
      setGoals(cached);
      setLoading(false);
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/users/${userId}/relationship-goals`,
      );
      const data = await response.json();

      console.log("GOALS RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load goals.");
      }

      const allGoals = Array.isArray(data?.goals) ? data.goals : [];

      // Only show active goals here.
      const activeGoals = allGoals.filter(
        (goal) => goal.status !== "completed",
      );

      setGoals(activeGoals);

      if (cacheKey) setCachedData(cacheKey, activeGoals);
    } catch (err) {
      console.log("GOALS LOAD ERROR:", err);

      // Only surface the error if we have nothing cached to show.
      if (!cached) {
        setError(err?.message || "Unable to load your goals.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGoals();
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTargetDate("");
    setEditingGoal(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingGoal(null);
    setTitle("");
    setDescription("");
    setTargetDate("");
    setShowForm(true);
  };

  const openEditForm = (goal) => {
    setEditingGoal(goal);

    setTitle(goal.title || "");
    setDescription(goal.description || "");

    if (goal.target_date) {
      setTargetDate(new Date(goal.target_date).toISOString().split("T")[0]);
    } else {
      setTargetDate("");
    }

    setShowForm(true);
  };

  const saveGoal = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please give this goal a title.");
      return;
    }

    if (!userId) return;

    try {
      setSaving(true);

      let response;

      if (editingGoal) {
        response = await fetch(
          `${API_URL}/users/${userId}/relationship-goals/${editingGoal.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              target_date: targetDate.trim() || null,
            }),
          },
        );
      } else {
        response = await fetch(
          `${API_URL}/users/${userId}/relationship-goals`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              target_date: targetDate.trim() || null,
            }),
          },
        );
      }

      const data = await response.json();

      console.log(
        editingGoal ? "UPDATE GOAL RESPONSE:" : "CREATE GOAL RESPONSE:",
        data,
      );

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save goal.");
      }

      resetForm();
      await loadGoals();
    } catch (err) {
      console.log("SAVE GOAL ERROR:", err);

      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to save goal.",
      );
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (goal) => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${userId}/relationship-goals/${goal.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "completed",
          }),
        },
      );

      const data = await response.json();

      console.log("COMPLETE GOAL RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to complete goal.");
      }

      setGoals((current) => {
        const next = current.filter((item) => item.id !== goal.id);
        if (cacheKey) setCachedData(cacheKey, next);
        return next;
      });

      // The Completed Goals screen may have a stale cached
      // list that doesn't include this goal yet.
      if (userId) clearCachedData(`completed-goals:${userId}`);
    } catch (err) {
      console.log("COMPLETE GOAL ERROR:", err);

      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to complete goal.",
      );
    }
  };

  const deleteGoal = (goal) => {
    Alert.alert(
      "Delete goal?",
      `"${goal.title}" will be permanently removed.`,
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
                `${API_URL}/users/${userId}/relationship-goals/${goal.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              console.log("DELETE GOAL RESPONSE:", data);

              if (!response.ok) {
                throw new Error(data?.error || "Unable to delete goal.");
              }

              setGoals((current) => {
                const next = current.filter((item) => item.id !== goal.id);
                if (cacheKey) setCachedData(cacheKey, next);
                return next;
              });
            } catch (err) {
              console.log("DELETE GOAL ERROR:", err);

              Alert.alert(
                "Something went wrong",
                err?.message || "Unable to delete goal.",
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
                <TouchableOpacity
                  style={styles.backButton}
                  activeOpacity={0.8}
                  onPress={() => router.back()}
                >
                  <Ionicons name="chevron-back" size={20} color="#6B4E45" />
                </TouchableOpacity>

                <View style={styles.headerText}>
                  <Text style={styles.brand}>BETWEEN US</Text>

                  <Text style={styles.pageTitle}>Relationship Goals</Text>

                  <Text style={styles.pageSubtitle}>
                    What are you both working towards right now?
                  </Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* COMPLETED GOALS LINK */}

              <TouchableOpacity
                style={styles.completedLink}
                activeOpacity={0.8}
                onPress={() => router.push("/completed-goals")}
              >
                <View style={styles.completedLinkIcon}>
                  <Text style={styles.completedLinkIconText}>✓</Text>
                </View>

                <View style={styles.completedLinkContent}>
                  <Text style={styles.completedLinkTitle}>Completed goals</Text>

                  <Text style={styles.completedLinkSubtitle}>
                    Look back at what you've already achieved together.
                  </Text>
                </View>

                <Text style={styles.completedLinkArrow}>→</Text>
              </TouchableOpacity>

              {/* ADD */}

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
                    <Text style={styles.addTitle}>Add a goal</Text>

                    <Text style={styles.addSubtitle}>
                      Something you both want to work on.
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
                        {editingGoal ? "EDIT GOAL" : "NEW GOAL"}
                      </Text>

                      <Text style={styles.formTitle}>
                        {editingGoal
                          ? "Update your goal."
                          : "What do you want to work on together?"}
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
                    placeholder="e.g. Communicate better during arguments"
                    placeholderTextColor="#A59A93"
                    style={styles.input}
                  />

                  <Text style={styles.inputLabel}>DESCRIPTION</Text>

                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Tell us more about this goal..."
                    placeholderTextColor="#A59A93"
                    style={[styles.input, styles.descriptionInput]}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.inputLabel}>TARGET DATE (OPTIONAL)</Text>

                  <DateInput
                    value={targetDate}
                    onChangeText={setTargetDate}
                    style={styles.input}
                  />

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      saving && styles.saveButtonDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={saveGoal}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {editingGoal ? "Save changes" : "Add goal"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* GOALS */}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>WORKING ON TOGETHER</Text>

                <Text style={styles.sectionTitle}>
                  {goals.length === 0
                    ? "No active goals yet."
                    : `${goals.length} ${
                        goals.length === 1 ? "goal" : "goals"
                      } in progress.`}
                </Text>

                {goals.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Text style={styles.emptyIconText}>◆</Text>
                    </View>

                    <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                    <Text style={styles.emptyText}>
                      Add a goal you're working on as a couple, with an optional
                      due date so you both get reminded.
                    </Text>

                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={openCreateForm}
                    >
                      <Text style={styles.emptyButtonText}>
                        Add your first goal
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  goals.map((goal, index) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      index={index}
                      onEdit={() => openEditForm(goal)}
                      onDelete={() => deleteGoal(goal)}
                      onComplete={() => markComplete(goal)}
                    />
                  ))
                )}
              </View>

              {goals.length > 0 ? (
                <View style={styles.footerCard}>
                  <Text style={styles.footerQuote}>
                    "Progress, not perfection."
                  </Text>

                  <Text style={styles.footerText}>
                    Small, steady steps build a stronger relationship.
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

function GoalCard({ goal, index, onEdit, onDelete, onComplete }) {
  const date = goal.target_date
    ? new Date(goal.target_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalTop}>
        <View style={styles.goalNumber}>
          <Text style={styles.goalNumberText}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>
      </View>

      <Text style={styles.goalTitle}>{goal.title}</Text>

      {goal.description ? (
        <Text style={styles.goalDescription}>{goal.description}</Text>
      ) : null}

      {date ? (
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>TARGET DATE</Text>
          <Text style={styles.dateText}>{date}</Text>
        </View>
      ) : null}

      <View style={styles.goalDivider} />

      <View style={styles.goalBottom}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={onComplete}
          activeOpacity={0.8}
        >
          <View style={styles.checkCircle} />

          <Text style={styles.completeText}>Mark complete</Text>
        </TouchableOpacity>

        <View style={styles.goalActions}>
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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

  headerText: {
    flex: 1,
  },

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

  pageSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
    color: "#817771",
  },

  completedLink: {
    marginBottom: 12,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
  },

  completedLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  completedLinkIconText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#6B4E45",
  },

  completedLinkContent: {
    flex: 1,
    marginLeft: 12,
  },

  completedLinkTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  completedLinkSubtitle: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  completedLinkArrow: {
    fontSize: 20,
    color: "#6B4E45",
    marginLeft: 8,
  },

  addButton: {
    backgroundColor: "#6B4E45",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  addIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  addIconText: {
    fontSize: 25,
    color: "#6B4E45",
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

  formCard: {
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
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
    maxWidth: 260,
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    justifyContent: "center",
    alignItems: "center",
  },

  closeButtonText: {
    fontSize: 22,
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
    backgroundColor: "rgba(255, 255, 255, 0.32)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#302825",
    marginBottom: 16,
  },

  descriptionInput: {
    height: 110,
  },

  saveButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  section: {
    marginTop: 4,
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

  goalCard: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    marginBottom: 13,
  },

  goalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  goalNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  goalNumberText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B4E45",
  },

  goalTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#302825",
  },

  goalDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
  },

  dateContainer: {
    marginTop: 14,
    backgroundColor: "rgba(255, 255, 255, 0.32)",
    borderRadius: 11,
    padding: 11,
  },

  dateLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#9A918A",
  },

  dateText: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B4E45",
  },

  goalDivider: {
    height: 1,
    backgroundColor: "#EAE3DE",
    marginVertical: 16,
  },

  goalBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#C9BDB6",
  },

  completeText: {
    marginLeft: 8,
    fontSize: 10,
    color: "#817771",
  },

  goalActions: {
    flexDirection: "row",
    gap: 7,
  },

  editButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
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

  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyIconText: {
    fontSize: 25,
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
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },

  emptyButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B4E45",
  },

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
