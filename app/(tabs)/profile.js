import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [profile, setProfile] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [profileResponse, connectionResponse] = await Promise.all([
        fetch(`${API_URL}/users/${userId}/profile`),
        fetch(`${API_URL}/users/${userId}/connections`),
      ]);

      const profileData = await profileResponse.json();
      const connectionData = await connectionResponse.json();

      console.log("PROFILE RESPONSE:", profileData);
      console.log("PROFILE CONNECTIONS:", connectionData);

      if (!profileResponse.ok) {
        throw new Error(profileData?.error || "Unable to load your profile.");
      }

      if (!connectionResponse.ok) {
        throw new Error(
          connectionData?.error || "Unable to load your connection.",
        );
      }

      setProfile(profileData?.profile || null);

      const connections = Array.isArray(connectionData) ? connectionData : [];

      const accepted = connections.find(
        (item) => item.status?.toLowerCase() === "accepted",
      );

      setConnection(accepted || null);
    } catch (err) {
      console.log("PROFILE LOAD ERROR:", err);
      setError(err?.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of Between Us?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/");
            } catch (error) {
              console.log("SIGN OUT ERROR:", error);
            }
          },
        },
      ],
    );
  };

  const handleUnlink = () => {
    if (!connection || unlinking) {
      return;
    }

    const partnerName = connection?.other_first_name?.trim() || "your partner";

    Alert.alert(
      "Unlink partner",
      `Are you sure you want to unlink from ${partnerName}? You will no longer be connected on Between Us.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unlink",
          style: "destructive",
          onPress: confirmUnlink,
        },
      ],
    );
  };

  const confirmUnlink = async () => {
    try {
      setUnlinking(true);
      setError("");

      const response = await fetch(`${API_URL}/users/${userId}/connection`, {
        method: "DELETE",
      });

      const data = await response.json();

      console.log("UNLINK RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to unlink your connection.");
      }

      setConnection(null);

      Alert.alert(
        "Connection ended",
        "You and your partner are no longer connected on Between Us.",
      );
    } catch (err) {
      console.log("UNLINK ERROR:", err);

      setError(err?.message || "Unable to unlink your connection.");
    } finally {
      setUnlinking(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete account", "Account deletion is not connected yet.", [
      {
        text: "OK",
      },
    ]);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const firstName = profile?.first_name?.trim() || "User";
  const lastName = profile?.last_name?.trim() || "";

  const fullName = `${firstName} ${lastName}`.trim();

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const relationshipLabel = connection?.relationship_type
    ? connection.relationship_type.charAt(0).toUpperCase() +
      connection.relationship_type.slice(1)
    : "Not connected";

  const partnerFirstName = connection?.other_first_name?.trim() || "";

  const partnerLastName = connection?.other_last_name?.trim() || "";

  const partnerName =
    `${partnerFirstName} ${partnerLastName}`.trim() || "Your partner";

  const partnerInitial = partnerFirstName.charAt(0).toUpperCase() || "♡";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
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
            <View>
              <Text style={styles.brand}>BETWEEN US</Text>

              <Text style={styles.pageTitle}>Profile</Text>
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

          {/* YOUR PROFILE */}

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "U"}</Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName}</Text>

              {profile?.email ? (
                <Text style={styles.profileEmail}>{profile.email}</Text>
              ) : null}

              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>BETWEEN US MEMBER</Text>
              </View>
            </View>
          </View>

          {/* PERSONAL INFORMATION */}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>

              <TouchableOpacity
                style={styles.editButton}
                activeOpacity={0.8}
                onPress={() => router.push("/edit-profile")}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoCard}>
              <InfoRow
                label="First name"
                value={profile?.first_name || "Not set"}
              />

              <View style={styles.divider} />

              <InfoRow
                label="Last name"
                value={profile?.last_name || "Not set"}
              />

              {profile?.email ? (
                <>
                  <View style={styles.divider} />

                  <InfoRow label="Email" value={profile.email} />
                </>
              ) : null}
            </View>
          </View>

          {/* YOUR CONNECTION */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR CONNECTION</Text>

            {connection ? (
              <>
                <View style={styles.partnerCard}>
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.partnerAvatarText}>
                      {partnerInitial}
                    </Text>
                  </View>

                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerEyebrow}>CONNECTED WITH</Text>

                    <Text style={styles.partnerName}>{partnerName}</Text>

                    <Text style={styles.partnerRelationship}>
                      {relationshipLabel}
                    </Text>
                  </View>

                  <View style={styles.connectedDot} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.unlinkButton,
                    unlinking && styles.unlinkButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={handleUnlink}
                  disabled={unlinking}
                >
                  {unlinking ? (
                    <ActivityIndicator size="small" color="#9A5548" />
                  ) : (
                    <Text style={styles.unlinkText}>Unlink Partner</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.unlinkWarning}>
                  Unlinking ends your current connection. You can connect again
                  later.
                </Text>
              </>
            ) : (
              <TouchableOpacity
                style={styles.noConnectionCard}
                activeOpacity={0.85}
                onPress={() => router.push("/connection")}
              >
                <View style={styles.noConnectionIcon}>
                  <Text style={styles.noConnectionIconText}>♡</Text>
                </View>

                <View style={styles.noConnectionInfo}>
                  <Text style={styles.noConnectionTitle}>
                    No partner connected
                  </Text>

                  <Text style={styles.noConnectionDescription}>
                    Connect with someone to start building your relationship
                    together.
                  </Text>
                </View>

                <Text style={styles.noConnectionArrow}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SETTINGS */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR SPACE</Text>

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.8}
              onPress={() => router.push("/memories")}
            >
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconText}>♡</Text>
              </View>

              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Your Memories</Text>

                <Text style={styles.settingDescription}>
                  View the moments you have saved together.
                </Text>
              </View>

              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              activeOpacity={0.8}
              onPress={() => router.push("/insights")}
            >
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconText}>◌</Text>
              </View>

              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Insights</Text>

                <Text style={styles.settingDescription}>
                  Learn more about your relationship.
                </Text>
              </View>

              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* SIGN OUT */}

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.signOutButton}
              activeOpacity={0.8}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* DELETE ACCOUNT */}

          <View style={styles.dangerSection}>
            <TouchableOpacity
              style={styles.deleteButton}
              activeOpacity={0.8}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>

            <Text style={styles.deleteWarning}>
              Account deletion permanently removes your Between Us data.
            </Text>
          </View>

          {/* FOOTER */}

          <View style={styles.footer}>
            <Text style={styles.footerHeart}>♡</Text>

            <Text style={styles.footerText}>BETWEEN US</Text>

            <Text style={styles.footerSubtext}>
              A little more intention. A little more connection.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * INFO ROW
 * ==========================================
 */

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/*
 * ==========================================
 * LOADING
 * ==========================================
 */

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.loadingContainer}>
        <View style={styles.loadingLogo}>
          <Text style={styles.loadingHeart}>♡</Text>
        </View>

        <Text style={styles.loadingTitle}>Between Us</Text>

        <ActivityIndicator
          size="small"
          color="#6B4E45"
          style={styles.loadingIndicator}
        />
      </View>
    </SafeAreaView>
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

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 35,
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  brand: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#6B4E45",
  },

  pageTitle: {
    marginTop: 7,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: "#302825",
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  headerHeart: {
    fontSize: 27,
    color: "#6B4E45",
  },

  /*
   * YOUR PROFILE
   */

  profileCard: {
    backgroundColor: "#6B4E45",
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#6B4E45",
  },

  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },

  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  profileEmail: {
    marginTop: 4,
    fontSize: 12,
    color: "#DCCBC4",
  },

  profileBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#806B62",
  },

  profileBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#F8F5F0",
  },

  /*
   * SECTIONS
   */

  section: {
    marginTop: 28,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 9,
  },

  /*
   * EDIT BUTTON
   */

  editButton: {
    marginBottom: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#E9DED8",
  },

  editButtonText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B4E45",
  },

  /*
   * INFORMATION
   */

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  infoRow: {
    minHeight: 58,
    justifyContent: "center",
  },

  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#9A918A",
    textTransform: "uppercase",
  },

  infoValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#302825",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEE8E3",
  },

  /*
   * PARTNER CARD
   */

  partnerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  partnerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  partnerAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#6B4E45",
  },

  partnerInfo: {
    flex: 1,
    marginLeft: 14,
  },

  partnerEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#9A918A",
  },

  partnerName: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "700",
    color: "#302825",
  },

  partnerRelationship: {
    marginTop: 3,
    fontSize: 11,
    color: "#817771",
  },

  connectedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#6B4E45",
  },

  /*
   * UNLINK
   */

  unlinkButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E4D2CC",
    backgroundColor: "#F8F1EE",
    alignItems: "center",
    justifyContent: "center",
  },

  unlinkButtonDisabled: {
    opacity: 0.65,
  },

  unlinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9A5548",
  },

  unlinkWarning: {
    marginTop: 7,
    paddingHorizontal: 8,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 15,
    color: "#9A918A",
  },

  /*
   * NO CONNECTION
   */

  noConnectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  noConnectionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  noConnectionIconText: {
    fontSize: 22,
    color: "#6B4E45",
  },

  noConnectionInfo: {
    flex: 1,
    marginLeft: 14,
  },

  noConnectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#302825",
  },

  noConnectionDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  noConnectionArrow: {
    marginLeft: 8,
    fontSize: 27,
    color: "#9A918A",
  },

  /*
   * SETTINGS
   */

  settingRow: {
    backgroundColor: "#FFFFFF",
    minHeight: 75,
    borderRadius: 17,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE3DE",
    marginBottom: 10,
  },

  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  settingIconText: {
    fontSize: 18,
    color: "#6B4E45",
  },

  settingContent: {
    flex: 1,
    marginLeft: 12,
  },

  settingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  settingDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  settingArrow: {
    marginLeft: 8,
    fontSize: 26,
    color: "#9A918A",
  },

  /*
   * SIGN OUT
   */

  signOutButton: {
    height: 53,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    alignItems: "center",
    justifyContent: "center",
  },

  signOutText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /*
   * DELETE
   */

  dangerSection: {
    marginTop: 18,
    alignItems: "center",
  },

  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  deleteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9A5548",
  },

  deleteWarning: {
    maxWidth: 290,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 15,
    color: "#9A918A",
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
    marginTop: 30,
    paddingTop: 25,
    paddingBottom: 10,
    alignItems: "center",
  },

  footerHeart: {
    fontSize: 25,
    color: "#6B4E45",
  },

  footerText: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
  },

  footerSubtext: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 10,
    color: "#9A918A",
  },

  /*
   * LOADING
   */

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingHeart: {
    fontSize: 29,
    color: "#6B4E45",
  },

  loadingTitle: {
    marginTop: 14,
    fontSize: 21,
    fontWeight: "700",
    color: "#302825",
  },

  loadingIndicator: {
    marginTop: 15,
  },
});
