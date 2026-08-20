import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function EditProfileScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/profile`);

      const data = await response.json();

      console.log("EDIT PROFILE RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your profile.");
      }

      setFirstName(data?.profile?.first_name || "");
      setLastName(data?.profile?.last_name || "");
    } catch (err) {
      console.log("EDIT PROFILE LOAD ERROR:", err);
      setError(err?.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName) {
      Alert.alert("First name required", "Please enter your first name.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
        }),
      });

      const data = await response.json();

      console.log("UPDATE PROFILE RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to update your profile.");
      }

      Alert.alert(
        "Profile updated",
        "Your profile has been updated successfully.",
        [
          {
            text: "Done",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (err) {
      console.log("UPDATE PROFILE ERROR:", err);
      setError(err?.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6B4E45" />

          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.container}>
            {/* HEADER */}

            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backArrow}>‹</Text>
              </TouchableOpacity>

              <View style={styles.headerText}>
                <Text style={styles.brand}>BETWEEN US</Text>

                <Text style={styles.title}>Edit Profile</Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* INTRO */}

            <View style={styles.introCard}>
              <View style={styles.introIcon}>
                <Text style={styles.introHeart}>♡</Text>
              </View>

              <Text style={styles.introTitle}>A little about you.</Text>

              <Text style={styles.introText}>
                Keep your information up to date so Between Us can feel more
                personal to you.
              </Text>
            </View>

            {/* FORM */}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR INFORMATION</Text>

              <View style={styles.formCard}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FIRST NAME</Text>

                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter your first name"
                    placeholderTextColor="#A9A19B"
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>LAST NAME</Text>

                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter your last name"
                    placeholderTextColor="#A9A19B"
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>

            {/* SAVE */}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveText}>Save Changes</Text>
                  <Text style={styles.saveArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>

            {/* CANCEL */}

            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerHeart}>♡</Text>

              <Text style={styles.footerText}>BETWEEN US</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 35,
  },

  container: {
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  /*
   * HEADER
   */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  backArrow: {
    fontSize: 31,
    lineHeight: 34,
    color: "#6B4E45",
    marginTop: -3,
  },

  headerText: {
    marginLeft: 13,
  },

  brand: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
  },

  title: {
    marginTop: 4,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "700",
    color: "#302825",
  },

  /*
   * INTRO
   */

  introCard: {
    backgroundColor: "#6B4E45",
    borderRadius: 22,
    padding: 20,
  },

  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  introHeart: {
    fontSize: 26,
    color: "#6B4E45",
  },

  introTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  introText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#DCCBC4",
  },

  /*
   * SECTION
   */

  section: {
    marginTop: 28,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 9,
  },

  /*
   * FORM
   */

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  inputGroup: {
    paddingVertical: 14,
  },

  inputLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#9A918A",
    marginBottom: 7,
  },

  input: {
    height: 44,
    borderRadius: 11,
    backgroundColor: "#F8F5F0",
    borderWidth: 1,
    borderColor: "#EAE3DE",
    paddingHorizontal: 13,
    fontSize: 14,
    color: "#302825",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEE8E3",
  },

  /*
   * SAVE
   */

  saveButton: {
    height: 54,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  saveArrow: {
    fontSize: 21,
    color: "#FFFFFF",
  },

  /*
   * CANCEL
   */

  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    marginTop: 5,
  },

  cancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#817771",
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
   * FOOTER
   */

  footer: {
    marginTop: 20,
    alignItems: "center",
  },

  footerHeart: {
    fontSize: 24,
    color: "#6B4E45",
  },

  footerText: {
    marginTop: 7,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
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
    fontSize: 13,
    color: "#817771",
  },
});
