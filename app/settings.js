import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { apiFetch } from "../lib/api";
import { clearCachedData } from "../lib/dataCache";
import { RETURNING_USER_KEY } from "../lib/auth";
import { lockAvailable, lockEnabled, setLockEnabled } from "../lib/appLock";
import { savedAppearance, setAppearance } from "../lib/appearance";
import { T, useTheme } from "../lib/theme";
import {
  Cell,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  LargeTitle,
  NavBar,
  Screen,
  Segmented,
  Toggle,
} from "../components/ui";

/*
 * ==========================================
 * SETTINGS
 * ==========================================
 *
 * How the app looks and behaves on this phone, the
 * reminders it sends, and the account itself -- kept here
 * so Profile can be about the two of you.
 */

const REMINDERS = [
  {
    type: "daily_question",
    icon: "notifications",
    title: "Tonight's questions",
    subtitle: "Every evening",
  },
  {
    type: "daily_question_answered",
    icon: "heart",
    title: "When they answer",
  },
  {
    type: "anniversary",
    icon: "calendar",
    title: "Anniversary countdown",
  },
  {
    type: "inactivity",
    icon: "pulse",
    title: "A nudge when it's been quiet",
  },
];

const LOOKS = { system: "System", light: "Light", dark: "Dark" };

export default function SettingsScreen() {
  useTheme();

  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { userId } = useAuth();

  const [prefs, setPrefs] = useState({});
  const [lockOn, setLockOn] = useState(false);
  const [lockCan, setLockCan] = useState(false);
  const [look, setLook] = useState(savedAppearance());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    lockEnabled().then(setLockOn);
    lockAvailable().then(setLockCan);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      apiFetch(`/users/${userId}/notification-preferences`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setPrefs(data?.preferences || {}))
        .catch(() => {});
    }, [userId]),
  );

  /* The whole app repaints the moment it is chosen. */
  const changeLook = (label) => {
    const value = Object.keys(LOOKS).find((key) => LOOKS[key] === label);

    if (!value || value === look) return;

    setLook(value);
    setAppearance(value);
  };

  const changeLock = async (value) => {
    try {
      const done = await setLockEnabled(value);

      if (done) setLockOn(value);
    } catch (err) {
      Alert.alert("Can't lock yet", err?.message || "Please try again.");
    }
  };

  const setReminder = async (type, value) => {
    setPrefs((current) => ({ ...current, [type]: value }));

    try {
      const response = await apiFetch(
        `/users/${userId}/notification-preferences`,
        {
          method: "PUT",
          body: JSON.stringify({ preferences: { [type]: value } }),
        },
      );

      if (!response.ok) throw new Error();
    } catch {
      setPrefs((current) => ({ ...current, [type]: !value }));
    }
  };

  const signOutPrompt = () =>
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);

  const deleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This removes your profile, your answers and everything you have saved. It cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert("Last chance", "Nothing can be recovered.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete forever",
                style: "destructive",
                onPress: async () => {
                  try {
                    setBusy(true);

                    await apiFetch(`/users/${userId}`, { method: "DELETE" });

                    clearCachedData(`profile-tab:${userId}`);

                    try {
                      await SecureStore.deleteItemAsync(RETURNING_USER_KEY);
                    } catch {
                      /* nothing to clear */
                    }

                    try {
                      await user?.delete();
                    } catch {
                      await signOut();
                    }

                    router.replace("/");
                  } catch (err) {
                    Alert.alert(
                      "We couldn't delete your account",
                      err?.message || "Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                },
              },
            ]),
        },
      ],
    );
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const icon = (name) => <Ionicons name={name} size={21} color={T.accent} />;

  return (
    <Screen>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Settings</LargeTitle>

      {/* APPEARANCE */}

      <View style={styles.section}>
        <GroupHeader>Appearance</GroupHeader>

        <Segmented
          options={Object.values(LOOKS)}
          value={LOOKS[look]}
          onChange={changeLook}
        />

        <GroupFooter>
          System follows your phone, switching as it does.
        </GroupFooter>
      </View>

      {/* PRIVACY */}

      {lockCan ? (
        <View style={styles.section}>
          <GroupHeader>Privacy</GroupHeader>

          <Group inset={52}>
            <Cell
              leading={icon("finger-print")}
              title="Lock the app"
              subtitle="Face ID, fingerprint or passcode to open it"
              trailing={<Toggle value={lockOn} onChange={changeLock} />}
            />
          </Group>

          <GroupFooter>
            It asks when the app opens, and after a minute away.
          </GroupFooter>
        </View>
      ) : null}

      {/* REMINDERS */}

      <View style={styles.section}>
        <GroupHeader>Reminders</GroupHeader>

        <Group inset={52}>
          {REMINDERS.map((reminder) => (
            <Cell
              key={reminder.type}
              leading={icon(reminder.icon)}
              title={reminder.title}
              subtitle={reminder.subtitle}
              trailing={
                <Toggle
                  value={prefs?.[reminder.type] !== false}
                  onChange={(value) => setReminder(reminder.type, value)}
                />
              }
            />
          ))}

          <Cell
            leading={icon("notifications-outline")}
            title="All notifications"
            chevron
            onPress={() => router.push("/notification-settings")}
          />
        </Group>
      </View>

      {/* ACCOUNT */}

      <View style={styles.section}>
        <GroupHeader>Account</GroupHeader>

        <Group inset={16}>
          <Cell
            title="Terms of Use"
            chevron
            onPress={() => router.push("/terms")}
          />

          <Cell
            title="Privacy Policy"
            chevron
            onPress={() => router.push("/privacy")}
          />

          <Cell title="Sign Out" onPress={signOutPrompt} />

          <Cell
            title={busy ? "Working…" : "Delete Account"}
            destructive
            onPress={busy ? undefined : deleteAccount}
          />
        </Group>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
});
