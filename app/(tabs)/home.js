import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function HomeScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [profile, setProfile] = useState(null);
  const [connection, setConnection] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHome = useCallback(async () => {
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

      console.log("HOME PROFILE:", profileData);
      console.log("HOME CONNECTIONS:", connectionData);

      if (!profileResponse.ok) {
        throw new Error(profileData?.error || "Unable to load your profile.");
      }

      if (!connectionResponse.ok) {
        throw new Error(
          connectionData?.error || "Unable to load your connections.",
        );
      }

      setProfile(profileData?.profile || null);

      const connections = Array.isArray(connectionData) ? connectionData : [];

      const accepted = connections.find((item) => item.status === "accepted");

      const incoming = connections.filter(
        (item) =>
          item.status === "pending" && item.request_direction === "incoming",
      );

      const outgoing = connections.filter(
        (item) =>
          item.status === "pending" && item.request_direction === "outgoing",
      );

      setPendingRequests(incoming);

      setConnection(accepted || null);
      setPendingRequests(pending);
    } catch (err) {
      console.log("HOME LOAD ERROR:", err);
      setError(err?.message || "Unable to load your home.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHome();
  };

  const firstName = profile?.first_name || "there";

  const relationshipLabel = connection?.relationship_type
    ? connection.relationship_type.charAt(0).toUpperCase() +
      connection.relationship_type.slice(1)
    : "Your relationship";

  /*
   * No connection yet.
   */
  if (!loading && !connection) {
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
            <Header firstName={firstName} />

            {error ? <ErrorMessage message={error} /> : null}

            <View style={styles.welcomeCard}>
              <View style={styles.welcomeIcon}>
                <Text style={styles.heart}>♡</Text>
              </View>

              <Text style={styles.welcomeTitle}>
                Make Between Us
                {"\n"}
                about both of you.
              </Text>

              <Text style={styles.welcomeDescription}>
                Find the person you want to stay connected with. Once you
                connect, this becomes your shared space for memories, insights,
                reminders and meaningful moments.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={() => router.push("/find-person")}
              >
                <Text style={styles.primaryButtonText}>Find someone</Text>
                <Text style={styles.primaryArrow}>→</Text>
              </TouchableOpacity>
            </View>

            {pendingRequests.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>CONNECTION REQUEST</Text>

                <View style={styles.pendingCard}>
                  <View style={styles.pendingIcon}>
                    <Text style={styles.pendingHeart}>♡</Text>
                  </View>

                  <View style={styles.pendingContent}>
                    <Text style={styles.pendingTitle}>
                      Someone wants to connect
                    </Text>

                    <Text style={styles.pendingText}>
                      Open your connections to review the request.
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push("/find-person")}
                    style={styles.smallButton}
                  >
                    <Text style={styles.smallButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <QuickActions router={router} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
   * Connected home.
   */
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
          <Header firstName={firstName} />

          {error ? <ErrorMessage message={error} /> : null}

          {/* CONNECTION CARD */}

          <View style={styles.connectionCard}>
            <View style={styles.connectionTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(connection?.other_first_name || "?")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.connectionInfo}>
                <Text style={styles.togetherLabel}>YOU & THEM</Text>

                <Text style={styles.partnerName}>
                  {connection?.other_first_name || "Your person"}
                </Text>

                <Text style={styles.relationshipText}>{relationshipLabel}</Text>
              </View>

              <View style={styles.onlineDot} />
            </View>

            <View style={styles.connectionDivider} />

            <View style={styles.connectionBottom}>
              <View>
                <Text style={styles.connectionSmallLabel}>YOUR SPACE</Text>

                <Text style={styles.connectionSmallText}>
                  Keep choosing each other.
                </Text>
              </View>

              <Text style={styles.connectionHeart}>♡</Text>
            </View>
          </View>

          {/* TODAY */}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionLabel}>TODAY</Text>
                <Text style={styles.sectionTitle}>
                  A little intention goes a long way.
                </Text>
              </View>
            </View>

            <View style={styles.promptCard}>
              <View style={styles.promptIcon}>
                <Text style={styles.promptIconText}>✦</Text>
              </View>

              <Text style={styles.promptTitle}>
                Tell them one thing you appreciate about them.
              </Text>

              <Text style={styles.promptDescription}>
                It does not have to be big. Small moments of intentionality are
                what keep relationships alive.
              </Text>

              <TouchableOpacity style={styles.promptButton} activeOpacity={0.8}>
                <Text style={styles.promptButtonText}>Do it today</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* QUICK ACTIONS */}

          <QuickActions router={router} />

          {/* RECENT / COMING SOON STYLE AREA */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR RELATIONSHIP</Text>

            <View style={styles.featureGrid}>
              <TouchableOpacity
                style={styles.featureCard}
                activeOpacity={0.8}
                onPress={() => router.push("/memories")}
              >
                <Text style={styles.featureIcon}>♡</Text>
                <Text style={styles.featureTitle}>Memories</Text>
                <Text style={styles.featureDescription}>
                  Moments worth keeping.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureCard}
                activeOpacity={0.8}
                onPress={() => router.push("/insights")}
              >
                <Text style={styles.featureIcon}>◌</Text>
                <Text style={styles.featureTitle}>Insights</Text>
                <Text style={styles.featureDescription}>
                  Understand each other better.
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FOOTER MESSAGE */}

          <View style={styles.footerCard}>
            <Text style={styles.footerQuote}>
              "The little things are often the big things."
            </Text>

            <Text style={styles.footerSubtext}>
              Between Us is here to help you remember them.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * HEADER
 * ==========================================
 */

function Header({ firstName }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>BETWEEN US</Text>

        <Text style={styles.greeting}>Good to see you, {firstName}.</Text>
      </View>

      <View style={styles.logoCircle}>
        <Text style={styles.logo}>♡</Text>
      </View>
    </View>
  );
}

/*
 * ==========================================
 * QUICK ACTIONS
 * ==========================================
 */

function QuickActions({ router }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>QUICK ACCESS</Text>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          activeOpacity={0.8}
          onPress={() => router.push("/memories")}
        >
          <View style={styles.quickIcon}>
            <Text style={styles.quickIconText}>♡</Text>
          </View>

          <Text style={styles.quickTitle}>Memories</Text>
          <Text style={styles.quickText}>Remember moments</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          activeOpacity={0.8}
          onPress={() => router.push("/insights")}
        >
          <View style={styles.quickIcon}>
            <Text style={styles.quickIconText}>✦</Text>
          </View>

          <Text style={styles.quickTitle}>Insights</Text>
          <Text style={styles.quickText}>Learn about each other</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
 * ==========================================
 * ERROR
 * ==========================================
 */

function ErrorMessage({ message }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
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
    paddingBottom: 30,
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

  greeting: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: "#302825",
  },

  logoCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    fontSize: 26,
    color: "#6B4E45",
  },

  /*
   * CONNECTION
   */

  connectionCard: {
    backgroundColor: "#6B4E45",
    borderRadius: 22,
    padding: 20,
  },

  connectionTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6B4E45",
  },

  connectionInfo: {
    flex: 1,
    marginLeft: 14,
  },

  togetherLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#DCCBC4",
  },

  partnerName: {
    marginTop: 3,
    fontSize: 21,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  relationshipText: {
    marginTop: 2,
    fontSize: 12,
    color: "#DCCBC4",
  },

  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#D9C7BE",
  },

  connectionDivider: {
    height: 1,
    backgroundColor: "#806B62",
    marginVertical: 18,
  },

  connectionBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  connectionSmallLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#DCCBC4",
  },

  connectionSmallText: {
    marginTop: 4,
    fontSize: 13,
    color: "#FFFFFF",
  },

  connectionHeart: {
    fontSize: 27,
    color: "#E9DED8",
  },

  /*
   * SECTION
   */

  section: {
    marginTop: 30,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#302825",
  },

  /*
   * TODAY PROMPT
   */

  promptCard: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  promptIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  promptIconText: {
    fontSize: 18,
    color: "#6B4E45",
  },

  promptTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#302825",
  },

  promptDescription: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
  },

  promptButton: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#F1E9E5",
  },

  promptButtonText: {
    color: "#6B4E45",
    fontSize: 13,
    fontWeight: "700",
  },

  /*
   * QUICK ACTIONS
   */

  quickActions: {
    flexDirection: "row",
    gap: 12,
  },

  quickAction: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  quickIconText: {
    color: "#6B4E45",
    fontSize: 17,
  },

  quickTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#302825",
  },

  quickText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  /*
   * FEATURE CARDS
   */

  featureGrid: {
    flexDirection: "row",
    gap: 12,
  },

  featureCard: {
    flex: 1,
    minHeight: 145,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  featureIcon: {
    fontSize: 21,
    color: "#6B4E45",
    marginBottom: 17,
  },

  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#302825",
  },

  featureDescription: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  /*
   * WELCOME / NO CONNECTION
   */

  welcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  welcomeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  heart: {
    fontSize: 28,
    color: "#6B4E45",
  },

  welcomeTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
    color: "#302825",
  },

  welcomeDescription: {
    marginTop: 13,
    fontSize: 14,
    lineHeight: 21,
    color: "#817771",
  },

  primaryButton: {
    height: 54,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  primaryArrow: {
    color: "#FFFFFF",
    fontSize: 21,
  },

  /*
   * PENDING
   */

  pendingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  pendingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  pendingHeart: {
    color: "#6B4E45",
    fontSize: 22,
  },

  pendingContent: {
    flex: 1,
    marginLeft: 12,
  },

  pendingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#302825",
  },

  pendingText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F1E9E5",
  },

  smallButtonText: {
    color: "#6B4E45",
    fontSize: 12,
    fontWeight: "700",
  },

  /*
   * FOOTER
   */

  footerCard: {
    marginTop: 30,
    marginBottom: 10,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#EFE7E2",
    alignItems: "center",
  },

  footerQuote: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "#6B4E45",
  },

  footerSubtext: {
    textAlign: "center",
    marginTop: 7,
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
