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
import { Card } from "../components/Glass";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import DateInput from "../components/DateInput";
import { apiFetch } from "../lib/api";
import { birthdayError } from "../lib/validation";

export default function EditProfileScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
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

      const response = await apiFetch(`/users/${userId}/profile`);

      const data = await response.json();

      console.log("EDIT PROFILE RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load your profile.");
      }

      setFirstName(data?.profile?.first_name || "");
      setLastName(data?.profile?.last_name || "");
      setBirthday(
        data?.profile?.birthday
          ? new Date(data.profile.birthday).toISOString().split("T")[0]
          : "",
      );
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
    const trimmedBirthday = birthday.trim();

    if (!trimmedFirstName) {
      Alert.alert("First name required", "Please enter your first name.");
      return;
    }

    const birthdayProblem = trimmedBirthday ? birthdayError(trimmedBirthday) : null;

    if (birthdayProblem) {
      Alert.alert("Check your birthday", birthdayProblem);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await apiFetch(`/users/${userId}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          birthday: trimmedBirthday || null,
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
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F03FA9" />

          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
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

            <Card dark style={styles.introCard}>
              <View style={styles.introIcon}>
                <Text style={styles.introHeart}>♡</Text>
              </View>

              <Text style={styles.introTitle}>A little about you.</Text>

              <Text style={styles.introText}>
                Keep your information up to date so Between Us can feel more
                personal to you.
              </Text>
            </Card>

            {/* FORM */}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR INFORMATION</Text>

              <Card style={styles.formCard}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FIRST NAME</Text>

                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter your first name"
                    placeholderTextColor="rgba(60,60,67,0.3)"
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
                    placeholderTextColor="rgba(60,60,67,0.3)"
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>BIRTHDAY</Text>

                  <DateInput
                    value={birthday}
                    onChangeText={setBirthday}
                    placeholderTextColor="rgba(60,60,67,0.3)"
                    style={styles.input}
                  />

                  <Text style={styles.inputHint}>
                    Used to remind your partner when your birthday is coming up.
                  </Text>
                </View>
              </Card>
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
    backgroundColor: "#F2ECF4",
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
    backgroundColor: "#FDE8F5",
    alignItems: "center",
    justifyContent: "center",
  },

  backArrow: {
    fontSize: 31,
    lineHeight: 34,
    color: "#F03FA9",
    marginTop: -3,
  },

  headerText: {
    marginLeft: 13,
  },

  brand: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#F03FA9",
  },

  title: {
    marginTop: 4,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "700",
    color: "#111114",
  },

  /*
   * INTRO
   */

  introCard: {
    backgroundColor: "#F03FA9",
    borderRadius: 22,
    padding: 20,
  },

  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FDE8F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  introHeart: {
    fontSize: 26,
    color: "#FFFFFF",
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
    color: "#FDE8F5",
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
    color: "rgba(60,60,67,0.6)",
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
    borderColor: "#FDE8F5",
  },

  inputGroup: {
    paddingVertical: 14,
  },

  inputLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "rgba(60,60,67,0.6)",
    marginBottom: 7,
  },

  input: {
    height: 44,
    borderRadius: 11,
    backgroundColor: "#F2ECF4",
    borderWidth: 1,
    borderColor: "#FDE8F5",
    paddingHorizontal: 13,
    fontSize: 14,
    color: "#111114",
  },

  inputHint: {
    marginTop: 7,
    fontSize: 10,
    lineHeight: 15,
    color: "rgba(60,60,67,0.6)",
  },

  divider: {
    height: 1,
    backgroundColor: "#FDE8F5",
  },

  /*
   * SAVE
   */

  saveButton: {
    height: 54,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#F03FA9",
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
    color: "rgba(60,60,67,0.6)",
  },

  /*
   * ERROR
   */

  errorBox: {
    backgroundColor: "#FDE8F5",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 15,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#FF3B30",
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
    color: "#F03FA9",
  },

  footerText: {
    marginTop: 7,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#F03FA9",
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
    color: "rgba(60,60,67,0.6)",
  },
});
