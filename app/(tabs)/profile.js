import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { apiFetch } from "../../lib/api";
import {
  clearCachedData,
  getCachedData,
  setCachedData,
} from "../../lib/dataCache";
import { connectionCacheKey } from "../../lib/connection";
import { RETURNING_USER_KEY } from "../../lib/auth";
import { T } from "../../lib/theme";
import {
  Avatar,
  Button,
  Cell,
  Group,
  GroupFooter,
  GroupHeader,
  LargeTitle,
  NavBar,
  Screen,
  Toggle,
} from "../../components/ui";
import { SkeletonList } from "../../components/Skeleton";

/*
 * ==========================================
 * PROFILE
 * ==========================================
 *
 * Settings, as iOS does settings: an account row, the
 * person you are linked with, switches for reminders,
 * links to your shared space, and the relationship —
 * ending in the one red row.
 */

const REMINDERS = [
  {
    type: "daily_question",
    icon: "notifications",
    title: "Tonight's question",
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
    title: "Weekly check-in",
    subtitle: "Sundays",
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `profile-tab:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [profile, setProfile] = useState(cached?.profile ?? null);
  const [partner, setPartner] = useState(cached?.partner ?? null);
  const [connection, setConnection] = useState(cached?.connection ?? null);
  const [prefs, setPrefs] = useState(cached?.prefs ?? {});
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const [profileResponse, connectionResponse, partnerData, prefsData] =
        await Promise.all([
          apiFetch(`/users/${userId}/profile`),
          apiFetch(`/users/${userId}/connections`),
          apiFetch(`/users/${userId}/partner`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          apiFetch(`/users/${userId}/notification-preferences`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

      const profileData = await profileResponse.json();
      const connectionData = await connectionResponse.json();

      setProfile(profileData?.profile || null);
      setPartner(partnerData?.partner || null);
      setPrefs(prefsData?.preferences || {});

      const connections = Array.isArray(connectionData) ? connectionData : [];

      setConnection(
        connections.find((item) => item.status?.toLowerCase() === "accepted") ||
          null,
      );
    } catch (err) {
      console.log("PROFILE LOAD ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (loading || !cacheKey) return;

    setCachedData(cacheKey, { profile, partner, connection, prefs });
  }, [loading, cacheKey, profile, partner, connection, prefs]);

  const setReminder = async (type, value) => {
    setPrefs((current) => ({ ...current, [type]: value }));

    try {
      await apiFetch(`/users/${userId}/notification-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [type]: value } }),
      });
    } catch (err) {
      console.log("REMINDER SAVE ERROR:", err);

      setPrefs((current) => ({ ...current, [type]: !value }));
    }
  };

  const unlink = () => {
    const name =
      partner?.nickname?.trim() ||
      partner?.first_name?.trim() ||
      "your partner";

    Alert.alert(
      "Unlink Partner?",
      `This closes the space you share with ${name}. Memories, dreams, goals and dates you made together are removed for both of you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);

              const response = await apiFetch(`/users/${userId}/connection`, {
                method: "DELETE",
              });

              if (!response.ok) throw new Error("Unable to unlink.");

              setConnection(null);
              setPartner(null);

              setCachedData(connectionCacheKey(userId), false);

              [
                "home",
                "timeline",
                "dates",
                "dreams",
                "insights",
                "daily-question",
                "appreciations",
                "checkin",
                "goals",
                "special-dates",
                "connection",
              ].forEach((prefix) => clearCachedData(`${prefix}:${userId}`));
            } catch (err) {
              Alert.alert("We couldn't unlink", err?.message || "Try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

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

                    if (cacheKey) clearCachedData(cacheKey);

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

  const fullName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const nickname = profile?.nickname?.trim();

  const partnerName =
    partner?.nickname?.trim() || partner?.first_name?.trim() || "Your person";

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={T.accent}
        />
      }
    >
      <NavBar />

      <LargeTitle>Profile</LargeTitle>

      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SkeletonList count={3} />
        </View>
      ) : (
        <>
          {/* ACCOUNT */}

          <Group inset={76}>
            <Cell
              leading={<Avatar name={fullName || "You"} who="you" size={60} />}
              title={fullName || "Your account"}
              subtitle={[nickname, user?.primaryEmailAddress?.emailAddress]
                .filter(Boolean)
                .join(" · ")}
              chevron
              onPress={() => router.push("/edit-profile")}
            />
          </Group>

          {/* PARTNER */}

          {connection ? (
            <Group inset={64}>
              <Cell
                leading={<Avatar name={partnerName} who="them" size={40} />}
                title={partnerName}
                subtitle={
                  connection?.relationship_type
                    ? `${connection.relationship_type.charAt(0).toUpperCase()}${connection.relationship_type.slice(1)}`
                    : "Linked"
                }
                trailing={
                  <Button
                    title="Nudge"
                    kind="tinted"
                    size="small"
                    onPress={() => router.push("/daily-question")}
                  />
                }
              />
            </Group>
          ) : (
            <Group inset={52}>
              <Cell
                leading={
                  <Ionicons name="person-add" size={22} color={T.accent} />
                }
                title="Find your person"
                subtitle="The shared parts open once you are linked"
                chevron
                onPress={() => router.push("/find-person")}
              />
            </Group>
          )}

          {/* REMINDERS */}

          <GroupHeader>Reminders</GroupHeader>

          <Group inset={52}>
            {REMINDERS.map((reminder) => (
              <Cell
                key={reminder.type}
                leading={
                  <Ionicons name={reminder.icon} size={21} color={T.accent} />
                }
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
          </Group>

          <GroupFooter>
            Everything else lives in notification settings.
          </GroupFooter>

          {/* YOUR SPACE */}

          <GroupHeader>Your space</GroupHeader>

          <Group inset={52}>
            <Cell
              leading={<Ionicons name="time" size={21} color={T.accent} />}
              title="Timeline"
              chevron
              onPress={() => router.push("/(tabs)/memories")}
            />

            <Cell
              leading={<Ionicons name="sparkles" size={21} color={T.accent} />}
              title="Dreams"
              chevron
              onPress={() => router.push("/(tabs)/dreams")}
            />

            <Cell
              leading={<Ionicons name="calendar" size={21} color={T.accent} />}
              title="Dates"
              chevron
              onPress={() => router.push("/(tabs)/dates")}
            />

            <Cell
              leading={<Ionicons name="flag" size={21} color={T.accent} />}
              title="Goals"
              chevron
              onPress={() => router.push("/goals")}
            />

            <Cell
              leading={
                <Ionicons name="create-outline" size={21} color={T.accent} />
              }
              title="Your answers"
              subtitle="Tastes change. Update what you told us."
              chevron
              onPress={() => router.push("/onboarding")}
            />

            <Cell
              leading={
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={T.accent}
                />
              }
              title="All notifications"
              chevron
              onPress={() => router.push("/notification-settings")}
            />
          </Group>

          {/* RELATIONSHIP */}

          {connection ? (
            <>
              <GroupHeader>Relationship</GroupHeader>

              <Group>
                <Cell
                  title="Status"
                  trailing={
                    <Text style={styles.value}>
                      {connection?.relationship_type
                        ? `${connection.relationship_type.charAt(0).toUpperCase()}${connection.relationship_type.slice(1)}`
                        : "Linked"}
                    </Text>
                  }
                />

                <Cell
                  title="Together since"
                  trailing={
                    <Text style={styles.value}>
                      {connection?.connected_at
                        ? new Date(connection.connected_at).toLocaleDateString(
                            undefined,
                            { day: "numeric", month: "short", year: "numeric" },
                          )
                        : "—"}
                    </Text>
                  }
                />

                <Cell
                  title={busy ? "Working…" : "Unlink Partner"}
                  destructive
                  onPress={busy ? undefined : unlink}
                />
              </Group>

              <GroupFooter>
                Unlinking closes your shared space for both of you.
              </GroupFooter>
            </>
          ) : null}

          {/* ACCOUNT ACTIONS */}

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

            <Cell
              title="Sign Out"
              onPress={() =>
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
                ])
              }
            />

            <Cell title="Delete Account" destructive onPress={deleteAccount} />
          </Group>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 16,
    color: T.label2,
  },
});
