import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";

import { apiFetch } from "../../lib/api";

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      slideAnim.setValue(18);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      if (!userId) {
        return;
      }

      const data = await apiFetch(`/users/${userId}/profile`);

      console.log("HOME PROFILE:", data);

      if (data?.exists && data?.profile) {
        setProfile(data.profile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.log("HOME PROFILE ERROR:", error?.message || error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFindPerson = () => {
    router.push("/find-person");
  };

  /*
   * Always use the name saved during onboarding.
   *
   * Example:
   * first_name = "Ella"
   *
   * Home:
   * Hello, Ella
   */

  const firstName = profile?.first_name?.trim() || "there";

  const initial = firstName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>♡</Text>
        </View>

        <Text style={styles.loadingTitle}>Between Us</Text>

        <Text style={styles.loadingText}>Getting everything ready...</Text>

        <ActivityIndicator
          size="small"
          color="#6B4E45"
          style={styles.loadingIndicator}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.animatedContent,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: slideAnim,
                },
              ],
            },
          ]}
        >
          {/* HEADER */}

          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greeting}>Hello, {firstName}</Text>

              <Text style={styles.subtitle}>
                Let’s make your relationship a little more intentional.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.8}
            >
              <Text style={styles.profileInitial}>{initial}</Text>
            </TouchableOpacity>
          </View>

          {/* RELATIONSHIP STATUS */}

          {profile?.relationship_status ? (
            <View style={styles.statusCard}>
              <View style={styles.statusDot} />

              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Your relationship</Text>

                <Text style={styles.statusValue}>
                  {profile.relationship_status}
                </Text>
              </View>
            </View>
          ) : null}

          {/* FIND YOUR PERSON */}

          <TouchableOpacity
            style={styles.findPersonCard}
            onPress={handleFindPerson}
            activeOpacity={0.9}
          >
            <View style={styles.findPersonContent}>
              <Text style={styles.findPersonEyebrow}>CONNECTION</Text>

              <Text style={styles.findPersonTitle}>Find Your Person</Text>

              <Text style={styles.findPersonDescription}>
                Connect with someone special and start building your
                relationship together.
              </Text>

              <View style={styles.findPersonButton}>
                <Text style={styles.findPersonButtonText}>Find someone</Text>

                <Text style={styles.arrow}>→</Text>
              </View>
            </View>

            <View style={styles.findPersonDecorationLarge} />
            <View style={styles.findPersonDecorationSmall} />
          </TouchableOpacity>

          {/* TODAY */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today</Text>

            <Text style={styles.sectionHint}>
              A little effort goes a long way
            </Text>
          </View>

          <View style={styles.reminderCard}>
            <View style={styles.reminderIcon}>
              <Text style={styles.reminderIconText}>♥</Text>
            </View>

            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>Make them feel loved</Text>

              <Text style={styles.reminderText}>
                Send your person a thoughtful message today.
              </Text>
            </View>
          </View>

          {/* QUICK ACTIONS */}

          <Text style={styles.sectionTitle}>Quick actions</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionCard} activeOpacity={0.85}>
              <View style={styles.actionIcon}>
                <Text style={styles.actionIconText}>+</Text>
              </View>

              <Text style={styles.actionTitle}>Add memory</Text>

              <Text style={styles.actionDescription}>
                Save a special moment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} activeOpacity={0.85}>
              <View style={styles.actionIcon}>
                <Text style={styles.actionIconText}>★</Text>
              </View>

              <Text style={styles.actionTitle}>Plan something</Text>

              <Text style={styles.actionDescription}>
                Find something fun to do
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpace} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  loadingLogo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  loadingLogoText: {
    fontSize: 30,
    color: "#6B4E45",
  },

  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#332B28",
  },

  loadingText: {
    marginTop: 7,
    fontSize: 14,
    color: "#817771",
  },

  loadingIndicator: {
    marginTop: 18,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 40,
  },

  animatedContent: {
    width: "100%",
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 15,
  },

  greeting: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: "#332B28",
    marginBottom: 7,
  },

  subtitle: {
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 20,
    color: "#8D837C",
  },

  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E7DDD7",
    alignItems: "center",
    justifyContent: "center",
  },

  profileInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B4E45",
  },

  /* STATUS */

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    marginBottom: 20,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6B4E45",
    marginRight: 12,
  },

  statusTextContainer: {
    flex: 1,
  },

  statusLabel: {
    fontSize: 12,
    color: "#9A9089",
    marginBottom: 3,
  },

  statusValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#332B28",
    textTransform: "capitalize",
  },

  /* FIND PERSON */

  findPersonCard: {
    minHeight: 210,
    borderRadius: 26,
    backgroundColor: "#6B4E45",
    padding: 22,
    marginBottom: 28,
    overflow: "hidden",
    position: "relative",
  },

  findPersonContent: {
    flex: 1,
    paddingRight: 78,
    justifyContent: "center",
    zIndex: 2,
  },

  findPersonEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#DCCDC6",
    marginBottom: 7,
  },

  findPersonTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },

  findPersonDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#F4EDEA",
    maxWidth: 245,
  },

  findPersonButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  findPersonButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B4E45",
  },

  arrow: {
    fontSize: 17,
    fontWeight: "700",
    color: "#6B4E45",
    marginLeft: 8,
  },

  findPersonDecorationLarge: {
    position: "absolute",
    right: -35,
    bottom: -45,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#82645A",
  },

  findPersonDecorationSmall: {
    position: "absolute",
    right: 20,
    top: -30,
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: "#806158",
    opacity: 0.7,
  },

  /* SECTIONS */

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#332B28",
    marginBottom: 4,
  },

  sectionHint: {
    fontSize: 13,
    color: "#968C85",
  },

  /* REMINDER */

  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
  },

  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F0E6E0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  reminderIconText: {
    fontSize: 20,
    color: "#6B4E45",
  },

  reminderContent: {
    flex: 1,
  },

  reminderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#332B28",
    marginBottom: 5,
  },

  reminderText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#8D837C",
  },

  /* QUICK ACTIONS */

  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },

  actionCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    minHeight: 150,
  },

  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F0E6E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  actionIconText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B4E45",
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#332B28",
    marginBottom: 5,
  },

  actionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: "#968C85",
  },

  bottomSpace: {
    height: 30,
  },
});
