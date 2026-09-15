import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
import { GlassBackground, Card } from "../components/Glass";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import DateInput from "../components/DateInput";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { Skeleton, SkeletonList } from "../components/Skeleton";
import { apiFetch } from "../lib/api";
import ConnectFirst from "../components/ConnectFirst";
import { useIsConnected } from "../lib/connection";

export default function SpecialDatesScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `special-dates:${userId}` : null;
  const cachedSpecialDates = cacheKey ? getCachedData(cacheKey) : undefined;

  const [specialDates, setSpecialDates] = useState(cachedSpecialDates || []);
  const [loading, setLoading] = useState(!cachedSpecialDates);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");

  const loadSpecialDates = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cached = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cached) {
      setSpecialDates(cached);
      setLoading(false);
    }

    try {
      setError("");

      const response = await apiFetch(`/users/${userId}/special-dates`);
      const data = await response.json();

      console.log("SPECIAL DATES RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load special dates.");
      }

      const nextSpecialDates = Array.isArray(data?.special_dates)
        ? data.special_dates
        : [];

      setSpecialDates(nextSpecialDates);

      if (cacheKey) setCachedData(cacheKey, nextSpecialDates);
    } catch (err) {
      console.log("SPECIAL DATES LOAD ERROR:", err);

      if (!cached) {
        setError(err?.message || "Unable to load your special dates.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadSpecialDates();
  }, [loadSpecialDates]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSpecialDates();
  };

  const resetForm = () => {
    setTitle("");
    setEventDate("");
    setShowForm(false);
  };

  const saveSpecialDate = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please give this date a title.");
      return;
    }

    if (!eventDate.trim()) {
      Alert.alert("Missing date", "Please choose a date.");
      return;
    }

    if (!userId) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/special-dates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          event_date: eventDate.trim(),
        }),
      });

      const data = await response.json();

      console.log("CREATE SPECIAL DATE RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save special date.");
      }

      resetForm();
      await loadSpecialDates();
    } catch (err) {
      console.log("SAVE SPECIAL DATE ERROR:", err);

      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to save special date.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSpecialDate = (specialDate) => {
    Alert.alert(
      "Delete this date?",
      `"${specialDate.title}" will be permanently removed.`,
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
              const response = await apiFetch(
                `/users/${userId}/special-dates/${specialDate.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              console.log("DELETE SPECIAL DATE RESPONSE:", data);

              if (!response.ok) {
                throw new Error(
                  data?.error || "Unable to delete special date.",
                );
              }

              setSpecialDates((current) => {
                const next = current.filter(
                  (item) => item.id !== specialDate.id,
                );
                if (cacheKey) setCachedData(cacheKey, next);
                return next;
              });
            } catch (err) {
              console.log("DELETE SPECIAL DATE ERROR:", err);

              Alert.alert(
                "Something went wrong",
                err?.message || "Unable to delete special date.",
              );
            }
          },
        },
      ],
    );
  };

  if (connected === false) {
    return <ConnectFirst feature="Special Dates" showBack={true} />;
  }

  if (loading) {
    /*
     * Cold load only (nothing cached yet). Mirrors the
     * real layout so the page appears at once and fills
     * in, instead of blocking on a spinner.
     */
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
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

                  <Text style={styles.pageTitle}>Special Dates</Text>

                  <Text style={styles.pageSubtitle}>
                    Birthdays, anniversaries, or anything else worth
                    remembering. Repeats every year.
                  </Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* ADD */}

              {!showForm ? (
                <Pressable onPress={() => setShowForm(true)}>
                  <Card style={styles.addButton}>
                    <View style={styles.addIcon}>
                      <Text style={styles.addIconText}>+</Text>
                    </View>

                    <View style={styles.addContent}>
                      <Text style={styles.addTitle}>Add a special date</Text>

                      <Text style={styles.addSubtitle}>
                        You'll both get reminded as it comes up.
                      </Text>
                    </View>

                    <Text style={styles.addArrow}>→</Text>
                  </Card>
                </Pressable>
              ) : null}

              {/* FORM */}

              {showForm ? (
                <Card style={styles.formCard}>
                  <View style={styles.formHeader}>
                    <View>
                      <Text style={styles.formLabel}>NEW SPECIAL DATE</Text>

                      <Text style={styles.formTitle}>
                        What date do you want to remember?
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
                    placeholder="e.g. First date anniversary"
                    placeholderTextColor="#A59A93"
                    style={styles.input}
                  />

                  <Text style={styles.inputLabel}>DATE</Text>

                  <DateInput
                    value={eventDate}
                    onChangeText={setEventDate}
                    style={styles.input}
                  />

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      saving && styles.saveButtonDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={saveSpecialDate}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Add date</Text>
                    )}
                  </TouchableOpacity>
                </Card>
              ) : null}

              {/* SPECIAL DATES */}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DATES THAT MATTER</Text>

                <Text style={styles.sectionTitle}>
                  {specialDates.length === 0
                    ? "Nothing saved yet."
                    : `${specialDates.length} ${
                        specialDates.length === 1 ? "date" : "dates"
                      } saved.`}
                </Text>

                {specialDates.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Ionicons
                        name="calendar-outline"
                        size={24}
                        color="#6B4E45"
                      />
                    </View>

                    <Text style={styles.emptyTitle}>Nothing here yet.</Text>

                    <Text style={styles.emptyText}>
                      Add birthdays, anniversaries, or any date you don't want
                      to forget. You'll both be reminded as it approaches.
                    </Text>

                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={() => setShowForm(true)}
                    >
                      <Text style={styles.emptyButtonText}>
                        Add your first date
                      </Text>
                    </TouchableOpacity>
                  </Card>
                ) : (
                  specialDates.map((specialDate) => (
                    <SpecialDateCard
                      key={specialDate.id}
                      specialDate={specialDate}
                      onDelete={() => deleteSpecialDate(specialDate)}
                    />
                  ))
                )}
              </View>

              {specialDates.length > 0 ? (
                <Card style={styles.footerCard}>
                  <Text style={styles.footerQuote}>
                    "The days you choose to remember are the days that mean the
                    most."
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

function SpecialDateCard({ specialDate, onDelete }) {
  const date = specialDate.event_date
    ? new Date(specialDate.event_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Card style={styles.dateCard}>
      <View style={styles.dateCardIcon}>
        <Ionicons name="calendar-outline" size={19} color="#6B4E45" />
      </View>

      <View style={styles.dateCardContent}>
        <Text style={styles.dateCardTitle}>{specialDate.title}</Text>

        {date ? <Text style={styles.dateCardDate}>{date}</Text> : null}
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
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
    alignItems: "center",
    marginBottom: 22,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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

  addButton: {
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
  },

  addIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
  },

  addIconText: {
    fontSize: 24,
    lineHeight: 27,
    color: "#FFFFFF",
  },

  addContent: {
    flex: 1,
    marginLeft: 13,
  },

  addTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#302825",
  },

  addSubtitle: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  addArrow: {
    fontSize: 20,
    color: "#6B4E45",
    marginLeft: 8,
  },

  formCard: {
    marginBottom: 16,
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

  dateCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  dateCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  dateCardContent: {
    flex: 1,
  },

  dateCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  dateCardDate: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#6B4E45",
  },

  deleteButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#F5E8E5",
    marginLeft: 10,
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
