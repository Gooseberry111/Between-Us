import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { birthdayError } from "../lib/validation";
import { T } from "../lib/theme";
import {
  Avatar,
  Button,
  FieldRow,
  GlassButton,
  Group,
  GroupFooter,
  NavBar,
  Notice,
  Screen,
} from "../components/ui";
import DateInput from "../components/DateInput";

/*
 * ==========================================
 * EDIT PROFILE
 * ==========================================
 *
 * Your name and birthday, as Settings edits a contact:
 * the avatar on top, then label-and-value rows.
 */

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

    const birthdayProblem = trimmedBirthday
      ? birthdayError(trimmedBirthday)
      : null;

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
      setError(err?.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        >
          <GlassButton
            icon="check"
            label="Save"
            prominent
            disabled={saving || loading || !firstName.trim()}
            onPress={handleSave}
          />
        </NavBar>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : (
          <>
            <View style={styles.head}>
              <Avatar name={firstName || "?"} who="you" size={88} />

              <Text style={styles.name}>{name || "Your name"}</Text>
            </View>

            <Notice>{error}</Notice>

            <Group>
              <FieldRow
                label="First"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Required"
                textContentType="givenName"
                autoComplete="given-name"
              />

              <FieldRow
                label="Last"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Optional"
                textContentType="familyName"
                autoComplete="family-name"
              />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Birthday</Text>

                <DateInput
                  value={birthday}
                  onChangeText={setBirthday}
                  placeholder="YYYY-MM-DD"
                  style={styles.rowInput}
                />
              </View>
            </Group>

            <GroupFooter>
              Your partner sees your first name. Your birthday sets up their
              reminder.
            </GroupFooter>

            <Button title="Save" onPress={handleSave} busy={saving} />
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  loading: {
    paddingTop: 80,
    alignItems: "center",
  },

  head: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
  },

  name: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: T.label,
    marginTop: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    gap: 12,
  },

  rowLabel: {
    width: 86,
    fontSize: 17,
    color: T.label,
  },

  rowInput: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 13,
  },
});
