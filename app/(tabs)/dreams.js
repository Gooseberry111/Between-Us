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
import { GlassBackground, Card } from "../../components/Glass";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import DateInput from "../../components/DateInput";
import { clearCachedData } from "../../lib/dataCache";
import { Skeleton, SkeletonList } from "../../components/Skeleton";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function DreamsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [dreams, setDreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingDream, setEditingDream] = useState(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Travel");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const categories = [
    "Travel",
    "Home",
    "Finance",
    "Career",
    "Family",
    "Lifestyle",
    "Adventure",
    "Other",
  ];

  const loadDreams = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/dreams`);
      const data = await response.json();

      console.log("DREAMS RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load dreams.");
      }

      const allDreams = Array.isArray(data?.dreams) ? data.dreams : [];

      // Only show active dreams on the main Dream Board.
      setDreams(allDreams.filter((dream) => !dream.is_completed));
    } catch (err) {
      console.log("DREAMS LOAD ERROR:", err);
      setError(err?.message || "Unable to load your dreams.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadDreams();
  }, [loadDreams]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDreams();
  };

  const resetForm = () => {
    setTitle("");
    setCategory("Travel");
    setDescription("");
    setTargetDate("");
    setEditingDream(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingDream(null);
    setTitle("");
    setCategory("Travel");
    setDescription("");
    setTargetDate("");
    setShowForm(true);
  };

  const openEditForm = (dream) => {
    setEditingDream(dream);

    setTitle(dream.title || "");
    setCategory(dream.category || "Other");
    setDescription(dream.description || "");

    if (dream.target_date) {
      setTargetDate(new Date(dream.target_date).toISOString().split("T")[0]);
    } else {
      setTargetDate("");
    }

    setShowForm(true);
  };

  const saveDream = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please give this dream a title.");
      return;
    }

    if (!userId) return;

    try {
      setSaving(true);

      let response;

      if (editingDream) {
        response = await fetch(
          `${API_URL}/users/${userId}/dreams/${editingDream.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
              category: category.trim(),
              description: description.trim(),
              target_date: targetDate.trim() || null,
            }),
          },
        );
      } else {
        response = await fetch(`${API_URL}/users/${userId}/dreams`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            category: category.trim(),
            description: description.trim(),
            target_date: targetDate.trim() || null,
          }),
        });
      }

      const data = await response.json();

      console.log(
        editingDream ? "UPDATE DREAM RESPONSE:" : "CREATE DREAM RESPONSE:",
        data,
      );

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save dream.");
      }

      resetForm();
      await loadDreams();
    } catch (err) {
      console.log("SAVE DREAM ERROR:", err);

      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to save dream.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (dream) => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${userId}/dreams/${dream.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_completed: true,
          }),
        },
      );

      const data = await response.json();

      console.log("TOGGLE DREAM RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to complete dream.");
      }

      // Remove it from the active Dream Board.
      setDreams((current) => current.filter((item) => item.id !== dream.id));

      // The Completed Dreams screen may have a stale cached
      // list that doesn't include this dream yet.
      if (userId) clearCachedData(`completed-dreams:${userId}`);
    } catch (err) {
      console.log("TOGGLE DREAM ERROR:", err);

      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to complete dream.",
      );
    }
  };

  const deleteDream = (dream) => {
    Alert.alert(
      "Delete dream?",
      `"${dream.title}" will be permanently removed.`,
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
                `${API_URL}/users/${userId}/dreams/${dream.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              console.log("DELETE DREAM RESPONSE:", data);

              if (!response.ok) {
                throw new Error(data?.error || "Unable to delete dream.");
              }

              setDreams((current) =>
                current.filter((item) => item.id !== dream.id),
              );
            } catch (err) {
              console.log("DELETE DREAM ERROR:", err);

              Alert.alert(
                "Something went wrong",
                err?.message || "Unable to delete dream.",
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

                  <Text style={styles.pageTitle}>Dream Board</Text>

                  <Text style={styles.pageSubtitle}>
                    The things you both want to experience, build, and achieve
                    together.
                  </Text>
                </View>

                <View style={styles.headerIcon}>
                  <Text style={styles.headerIconText}>✦</Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* SUMMARY */}

              <Card style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{dreams.length}</Text>
                  <Text style={styles.summaryLabel}>In progress</Text>
                </View>

                <View style={styles.summaryDivider} />

                <TouchableOpacity
                  style={styles.summaryItem}
                  activeOpacity={0.75}
                  onPress={() => router.push("/completed-dreams")}
                >
                  <Text style={styles.summaryNumber}>›</Text>
                  <Text style={styles.summaryLabel}>Completed dreams</Text>
                </TouchableOpacity>
              </Card>

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
                    <Text style={styles.addTitle}>Add a dream</Text>

                    <Text style={styles.addSubtitle}>
                      Add something you both want to make happen.
                    </Text>
                  </View>

                  <Text style={styles.addArrow}>→</Text>
                </TouchableOpacity>
              ) : null}

              {/* COMPLETED DREAMS LINK */}

              <TouchableOpacity
                style={styles.completedLink}
                activeOpacity={0.8}
                onPress={() => router.push("/completed-dreams")}
              >
                <View style={styles.completedLinkIcon}>
                  <Text style={styles.completedLinkIconText}>✓</Text>
                </View>

                <View style={styles.completedLinkContent}>
                  <Text style={styles.completedLinkTitle}>
                    Completed dreams
                  </Text>

                  <Text style={styles.completedLinkSubtitle}>
                    Look back at everything you've achieved together.
                  </Text>
                </View>

                <Text style={styles.completedLinkArrow}>→</Text>
              </TouchableOpacity>

              {/* FORM */}

              {showForm ? (
                <Card style={styles.formCard}>
                  <View style={styles.formHeader}>
                    <View>
                      <Text style={styles.formLabel}>
                        {editingDream ? "EDIT DREAM" : "NEW DREAM"}
                      </Text>

                      <Text style={styles.formTitle}>
                        {editingDream
                          ? "Update your dream."
                          : "What do you want to do together?"}
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
                    placeholder="e.g. Visit Paris together"
                    placeholderTextColor="#A59A93"
                    style={styles.input}
                  />

                  <Text style={styles.inputLabel}>CATEGORY</Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryScroll}
                  >
                    {categories.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.categoryButton,
                          category === item && styles.categoryButtonActive,
                        ]}
                        onPress={() => setCategory(item)}
                      >
                        <Text
                          style={[
                            styles.categoryButtonText,
                            category === item &&
                              styles.categoryButtonTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>DESCRIPTION</Text>

                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Tell us about this dream..."
                    placeholderTextColor="#A59A93"
                    style={[styles.input, styles.descriptionInput]}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.inputLabel}>TARGET DATE</Text>

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
                    onPress={saveDream}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {editingDream ? "Save changes" : "Add dream"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </Card>
              ) : null}

              {/* ACTIVE DREAMS */}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>YOUR FUTURE TOGETHER</Text>

                <Text style={styles.sectionTitle}>
                  {dreams.length === 0
                    ? "Start dreaming together."
                    : `${dreams.length} ${
                        dreams.length === 1 ? "dream" : "dreams"
                      } on your board.`}
                </Text>

                {dreams.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Text style={styles.emptyIconText}>✦</Text>
                    </View>

                    <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                    <Text style={styles.emptyText}>
                      Add your first shared dream — a trip, a home, an
                      experience, or anything you want to accomplish together.
                    </Text>

                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={openCreateForm}
                    >
                      <Text style={styles.emptyButtonText}>
                        Add your first dream
                      </Text>
                    </TouchableOpacity>
                  </Card>
                ) : (
                  dreams.map((dream, index) => (
                    <DreamCard
                      key={dream.id}
                      dream={dream}
                      index={index}
                      onEdit={() => openEditForm(dream)}
                      onDelete={() => deleteDream(dream)}
                      onToggle={() => toggleComplete(dream)}
                    />
                  ))
                )}
              </View>

              {dreams.length > 0 ? (
                <Card style={styles.footerCard}>
                  <Text style={styles.footerQuote}>
                    "Dreams are better when you build them together."
                  </Text>

                  <Text style={styles.footerText}>
                    Keep adding things you want your future to hold.
                  </Text>
                </Card>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassBackground>
    </SafeAreaView>
  );
}

function DreamCard({ dream, index, onEdit, onDelete, onToggle }) {
  const date = dream.target_date
    ? new Date(dream.target_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card style={styles.dreamCard}>
      <View style={styles.dreamTop}>
        <View style={styles.dreamNumber}>
          <Text style={styles.dreamNumberText}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>
            {dream.category || "Other"}
          </Text>
        </View>
      </View>

      <Text style={styles.dreamTitle}>{dream.title}</Text>

      {dream.description ? (
        <Text style={styles.dreamDescription}>{dream.description}</Text>
      ) : null}

      {date ? (
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>TARGET DATE</Text>
          <Text style={styles.dateText}>{date}</Text>
        </View>
      ) : null}

      <View style={styles.dreamDivider} />

      <View style={styles.dreamBottom}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View style={styles.checkCircle} />

          <Text style={styles.completeText}>Mark complete</Text>
        </TouchableOpacity>

        <View style={styles.dreamActions}>
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
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
    paddingBottom: 120,
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
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
    maxWidth: 290,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  headerIconText: {
    fontSize: 22,
    color: "#6B4E45",
  },

  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 18,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
  },

  summaryItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },

  summaryNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6B4E45",
  },

  summaryLabel: {
    marginTop: 3,
    fontSize: 9,
    color: "#9A918A",
    fontWeight: "600",
    textAlign: "center",
  },

  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#EAE3DE",
  },

  completedLink: {
    marginTop: 12,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 15,
  },

  completedLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
  },

  addIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
    marginTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
    backgroundColor: "rgba(107, 78, 69, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#302825",
    marginBottom: 16,
  },

  descriptionInput: {
    height: 110,
  },

  categoryScroll: {
    marginBottom: 17,
  },

  categoryButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(107, 78, 69, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginRight: 7,
  },

  categoryButtonActive: {
    backgroundColor: "#6B4E45",
    borderColor: "#6B4E45",
  },

  categoryButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#817771",
  },

  categoryButtonTextActive: {
    color: "#FFFFFF",
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

  dreamCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 13,
  },

  dreamTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dreamNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  dreamNumberText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6B4E45",
  },

  categoryBadge: {
    backgroundColor: "rgba(107, 78, 69, 0.07)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },

  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#817771",
  },

  dreamTitle: {
    marginTop: 16,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: "#302825",
  },

  dreamDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
  },

  dateContainer: {
    marginTop: 14,
    backgroundColor: "rgba(107, 78, 69, 0.07)",
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

  dreamDivider: {
    height: 1,
    backgroundColor: "#EAE3DE",
    marginVertical: 16,
  },

  dreamBottom: {
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

  dreamActions: {
    flexDirection: "row",
    gap: 7,
  },

  editButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
