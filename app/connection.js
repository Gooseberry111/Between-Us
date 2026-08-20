import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function ConnectionScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadConnection = async () => {
      if (!isLoaded || !isSignedIn || !userId) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/users/${userId}/connections`);

        const data = await response.json();

        console.log("CONNECTION SCREEN DATA:", data);

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load your connection.");
        }

        const connections = Array.isArray(data) ? data : [];

        const accepted = connections.find(
          (item) => item.status?.toLowerCase() === "accepted",
        );

        setConnection(accepted || null);
      } catch (err) {
        console.log("CONNECTION SCREEN ERROR:", err);

        setError(err?.message || "Unable to load your relationship.");
      } finally {
        setLoading(false);
      }
    };

    loadConnection();
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded || loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6B4E45" />

          <Text style={styles.loadingText}>Loading your space...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const partnerName = connection?.other_first_name?.trim() || "Your person";

  const relationship = connection?.relationship_type?.trim() || "relationship";

  const relationshipLabel =
    relationship.charAt(0).toUpperCase() + relationship.slice(1);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!connection ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No connection yet</Text>

            <Text style={styles.emptyText}>
              Your relationship space will appear here once you are connected.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.eyebrow}>YOUR RELATIONSHIP</Text>

            <Text style={styles.title}>You & {partnerName}</Text>

            <Text style={styles.subtitle}>
              This is your shared space for everything you build together.
            </Text>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {partnerName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.partnerName}>{partnerName}</Text>

                <Text style={styles.relationship}>{relationshipLabel}</Text>
              </View>

              <View style={styles.connectedDot} />
            </View>

            <View style={styles.featureSection}>
              <TouchableOpacity
                style={styles.featureCard}
                activeOpacity={0.85}
                onPress={() => router.push("/memories")}
              >
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>♡</Text>
                </View>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Memories</Text>

                  <Text style={styles.featureText}>
                    Keep the moments you never want to forget.
                  </Text>
                </View>

                <Text style={styles.featureArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureCard}
                activeOpacity={0.85}
                onPress={() => router.push("/insights")}
              >
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>✦</Text>
                </View>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Insights</Text>

                  <Text style={styles.featureText}>
                    Understand each other a little better.
                  </Text>
                </View>

                <Text style={styles.featureArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Text style={styles.featureIconText}>♡</Text>
                </View>

                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Reminders</Text>

                  <Text style={styles.featureText}>
                    Small reminders to show up for each other.
                  </Text>
                </View>

                <Text style={styles.comingSoon}>SOON</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  featureSection: {
    marginTop: 18,
    gap: 10,
  },

  featureCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F1E9E5",
    justifyContent: "center",
    alignItems: "center",
  },

  featureIconText: {
    fontSize: 21,
    color: "#6B4E45",
  },

  featureContent: {
    flex: 1,
    marginLeft: 12,
  },

  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#302825",
  },

  featureText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#817771",
  },

  featureArrow: {
    fontSize: 25,
    color: "#9A918A",
    marginLeft: 8,
  },

  comingSoon: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#9A918A",
  },
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  container: {
    flex: 1,
    padding: 22,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#817771",
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 35,
  },

  backText: {
    fontSize: 22,
    color: "#6B4E45",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: "#9A918A",
  },

  title: {
    marginTop: 7,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "700",
    color: "#302825",
  },

  subtitle: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#817771",
  },

  profileCard: {
    marginTop: 28,
    backgroundColor: "#6B4E45",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 23,
    fontWeight: "700",
    color: "#6B4E45",
  },

  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },

  partnerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  relationship: {
    marginTop: 3,
    fontSize: 12,
    color: "#DCCBC4",
  },

  connectedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#D9C7BE",
  },

  card: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 21,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  cardIcon: {
    fontSize: 29,
    color: "#6B4E45",
  },

  cardTitle: {
    marginTop: 14,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: "#302825",
  },

  cardText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
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

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#302825",
  },

  emptyText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
  },
});
