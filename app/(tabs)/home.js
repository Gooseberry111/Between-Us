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
  const [partnerInsights, setPartnerInsights] = useState(null);
  const [partnerPreferences, setPartnerPreferences] = useState(null);
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

      const accepted = connections.find(
        (item) => item.status?.toLowerCase() === "accepted",
      );

      const incoming = connections.filter(
        (item) =>
          item.status?.toLowerCase() === "pending" &&
          item.request_direction === "incoming",
      );

      setPendingRequests(incoming);
      setConnection(accepted || null);

      console.log("HOME ACCEPTED CONNECTION:", accepted);

      /*
       * ==========================================
       * LOAD PARTNER INFORMATION
       * ==========================================
       *
       * The connections endpoint gives us the
       * partner's Clerk ID through other_clerk_id.
       */

      if (accepted?.other_clerk_id) {
        const partnerClerkId = accepted.other_clerk_id;

        const [partnerInsightsResponse, partnerPreferencesResponse] =
          await Promise.all([
            fetch(`${API_URL}/users/${partnerClerkId}/insights`),
            fetch(`${API_URL}/users/${partnerClerkId}/preferences`),
          ]);

        const partnerInsightsData = await partnerInsightsResponse.json();

        const partnerPreferencesData = await partnerPreferencesResponse.json();

        console.log("HOME PARTNER INSIGHTS:", partnerInsightsData);

        console.log("HOME PARTNER PREFERENCES:", partnerPreferencesData);

        setPartnerInsights(partnerInsightsData?.insights || null);

        setPartnerPreferences(partnerPreferencesData?.preferences || null);
      } else {
        setPartnerInsights(null);
        setPartnerPreferences(null);
      }
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

  if (loading) {
    return <LoadingScreen />;
  }

  const firstName = profile?.first_name?.trim() || "there";

  const partnerName = connection?.other_first_name?.trim() || "Your person";

  const relationshipLabel = connection?.relationship_type
    ? connection.relationship_type.charAt(0).toUpperCase() +
      connection.relationship_type.slice(1)
    : "Your relationship";

  /*
   * ==========================================
   * NO CONNECTION
   * ==========================================
   */

  if (!connection) {
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
   * ==========================================
   * PARTNER DATA
   * ==========================================
   */

  const loveLanguages = Array.isArray(partnerPreferences?.love_languages)
    ? partnerPreferences.love_languages
    : [];

  const goals = Array.isArray(partnerInsights?.goals)
    ? partnerInsights.goals
    : [];

  const conflictStyle = partnerInsights?.conflict_style || "";

  const affectionStyle = partnerPreferences?.affection_style || "";

  const communicationFrequency =
    partnerPreferences?.communication_frequency || "";

  const food = partnerPreferences?.favorite_food?.trim() || "";

  const drink = partnerPreferences?.favorite_drink?.trim() || "";

  const movieGenre = partnerPreferences?.movie_genre?.trim() || "";

  const musicGenre = partnerPreferences?.music_genre?.trim() || "";

  const favoriteColor = partnerPreferences?.favorite_color?.trim() || "";

  /*
   * ==========================================
   * CREATE A PERSONALIZED TODAY PROMPT
   * ==========================================
   */

  const todayPrompt = getTodayPrompt({
    partnerName,
    loveLanguages,
    goals,
    conflictStyle,
    affectionStyle,
    communicationFrequency,
    food,
    drink,
    movieGenre,
    musicGenre,
    favoriteColor,
  });

  /*
   * ==========================================
   * CONNECTED HOME
   * ==========================================
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

          <TouchableOpacity
            style={styles.connectionCard}
            activeOpacity={0.9}
            onPress={() => router.push("/connection")}
          >
            <View style={styles.connectionTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(partnerName || "?").charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.connectionInfo}>
                <Text style={styles.togetherLabel}>YOU & THEM</Text>

                <Text style={styles.partnerName}>{partnerName}</Text>

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
          </TouchableOpacity>

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

              <Text style={styles.promptEyebrow}>
                FOR {partnerName.toUpperCase()}
              </Text>

              <Text style={styles.promptTitle}>{todayPrompt.title}</Text>

              <Text style={styles.promptDescription}>
                {todayPrompt.description}
              </Text>

              <TouchableOpacity
                style={styles.promptButton}
                activeOpacity={0.8}
                onPress={() => {
                  if (todayPrompt.route) {
                    router.push(todayPrompt.route);
                  }
                }}
              >
                <Text style={styles.promptButtonText}>
                  {todayPrompt.buttonText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PARTNER SNAPSHOT */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT THEM</Text>

            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotTitle}>What they enjoy</Text>

              {food ? <SnapshotRow label="Food" value={food} /> : null}

              {drink ? <SnapshotRow label="Drink" value={drink} /> : null}

              {movieGenre ? (
                <SnapshotRow label="Movies" value={movieGenre} />
              ) : null}

              {musicGenre ? (
                <SnapshotRow label="Music" value={musicGenre} />
              ) : null}

              {favoriteColor ? (
                <SnapshotRow label="Favorite color" value={favoriteColor} />
              ) : null}

              {!food &&
              !drink &&
              !movieGenre &&
              !musicGenre &&
              !favoriteColor ? (
                <Text style={styles.emptySnapshot}>
                  You are still learning more about each other.
                </Text>
              ) : null}
            </View>
          </View>

          {/* HOW TO LOVE THEM */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HOW TO LOVE THEM</Text>

            <View style={styles.loveCard}>
              <Text style={styles.loveCardTitle}>
                What feels natural to them
              </Text>

              {loveLanguages.length > 0 ? (
                <View style={styles.tagContainer}>
                  {loveLanguages.map((language, index) => (
                    <View key={`${language}-${index}`} style={styles.tag}>
                      <Text style={styles.tagText}>{language}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {affectionStyle ? (
                <InfoRow label="Affection" value={affectionStyle} />
              ) : null}

              {communicationFrequency ? (
                <InfoRow label="Communication" value={communicationFrequency} />
              ) : null}

              {conflictStyle ? (
                <InfoRow label="During conflict" value={conflictStyle} />
              ) : null}
            </View>
          </View>

          {/* GOALS */}

          {goals.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHAT THEY WANT MORE OF</Text>

              <View style={styles.goalsCard}>
                {goals.map((goal, index) => (
                  <View key={`${goal}-${index}`} style={styles.goalRow}>
                    <View style={styles.goalIcon}>
                      <Text style={styles.goalIconText}>✦</Text>
                    </View>

                    <Text style={styles.goalText}>{goal}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* QUICK ACTIONS */}

          <QuickActions router={router} />

          {/* FOOTER */}

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
 * PERSONALIZED PROMPT
 * ==========================================
 */

function getTodayPrompt({
  partnerName,
  loveLanguages,
  goals,
  conflictStyle,
  affectionStyle,
  communicationFrequency,
  food,
  drink,
  movieGenre,
  musicGenre,
  favoriteColor,
}) {
  /*
   * Date ideas get priority because it is an
   * explicit relationship goal.
   */

  if (goals.includes("Date Ideas")) {
    if (movieGenre) {
      return {
        title: `Plan a ${movieGenre.toLowerCase()} movie date.`,
        description: `${partnerName} enjoys ${movieGenre.toLowerCase()} movies. Turn that preference into a simple plan for the two of you.`,
        buttonText: "Plan a date",
        route: "/memories",
      };
    }

    return {
      title: `Plan a little date with ${partnerName}.`,
      description:
        "They have date ideas as something they want more of. A simple intentional plan can make the day feel special.",
      buttonText: "Plan a date",
      route: "/memories",
    };
  }

  /*
   * Receiving Gifts is another strong signal.
   */

  if (
    loveLanguages.some(
      (language) => language.toLowerCase() === "receiving gifts",
    )
  ) {
    if (favoriteColor) {
      return {
        title: `Surprise ${partnerName} with something thoughtful.`,
        description: `They appreciate receiving gifts. Even something small in their favorite color, ${favoriteColor.toLowerCase()}, could make them smile.`,
        buttonText: "Think of a gift",
      };
    }

    return {
      title: `Surprise ${partnerName} with something thoughtful.`,
      description:
        "Receiving gifts is one of the ways they feel loved. It does not need to be expensive; thoughtfulness matters more.",
      buttonText: "Think of a gift",
    };
  }

  /*
   * Acts of Service.
   */

  if (
    loveLanguages.some(
      (language) => language.toLowerCase() === "acts of service",
    )
  ) {
    return {
      title: `Do something helpful for ${partnerName}.`,
      description:
        "Acts of service are one of the ways they receive love. Take one small thing off their plate today.",
      buttonText: "Do something kind",
    };
  }

  /*
   * Quality Time.
   */

  if (
    loveLanguages.some((language) => language.toLowerCase() === "quality time")
  ) {
    return {
      title: `Give ${partnerName} some uninterrupted time.`,
      description:
        "Quality time is one of the ways they feel connected. Put the distractions away and spend a little intentional time together.",
      buttonText: "Make time",
    };
  }

  /*
   * Words of Affirmation.
   */

  if (
    loveLanguages.some(
      (language) => language.toLowerCase() === "words of affirmation",
    )
  ) {
    return {
      title: `Tell ${partnerName} something you genuinely appreciate.`,
      description:
        "Words of affirmation help them feel loved. Be specific about something you appreciate about them.",
      buttonText: "Tell them",
    };
  }

  /*
   * Conflict style.
   */

  if (conflictStyle.toLowerCase() === "need reassurance") {
    return {
      title: `Remind ${partnerName} that you are on their side.`,
      description:
        "They tend to need reassurance when things become difficult. A simple reminder that you are still together can mean a lot.",
      buttonText: "Send reassurance",
    };
  }

  /*
   * Communication preference.
   */

  if (communicationFrequency.toLowerCase() === "text") {
    return {
      title: `Send ${partnerName} a thoughtful message.`,
      description:
        "They prefer communicating through text. Send something that lets them know you are thinking about them.",
      buttonText: "Send a message",
    };
  }

  /*
   * Food.
   */

  if (food) {
    return {
      title: `Do something with ${food.toLowerCase()} today.`,
      description: `${partnerName} enjoys ${food.toLowerCase()}. You could surprise them with it or make plans around it.`,
      buttonText: "Make it happen",
    };
  }

  /*
   * Drink.
   */

  if (drink) {
    return {
      title: `Pick up their favorite drink.`,
      description: `${partnerName} enjoys ${drink}. A small familiar gesture can make an ordinary day feel thoughtful.`,
      buttonText: "Make a small gesture",
    };
  }

  /*
   * Music.
   */

  if (musicGenre) {
    return {
      title: `Share some ${musicGenre.toLowerCase()} music together.`,
      description: `${partnerName} enjoys ${musicGenre.toLowerCase()} music. Put on something they love and enjoy the moment together.`,
      buttonText: "Make a moment",
    };
  }

  /*
   * Fallback.
   */

  return {
    title: `Tell ${partnerName} one thing you appreciate about them.`,
    description:
      "It does not have to be big. Small moments of intentionality are what keep relationships alive.",
    buttonText: "Do it today",
  };
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
 * SNAPSHOT ROW
 * ==========================================
 */

function SnapshotRow({ label, value }) {
  return (
    <View style={styles.snapshotRow}>
      <Text style={styles.snapshotLabel}>{label}</Text>

      <Text style={styles.snapshotValue}>{value}</Text>
    </View>
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

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
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

  promptEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#9A918A",
    marginBottom: 6,
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
   * SNAPSHOT
   */

  snapshotCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  snapshotTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 4,
  },

  snapshotRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#EEE8E3",
  },

  snapshotLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9A918A",
  },

  snapshotValue: {
    flex: 1,
    marginLeft: 15,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#302825",
  },

  emptySnapshot: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#817771",
  },

  /*
   * HOW TO LOVE THEM
   */

  loveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  loveCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 13,
  },

  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  tag: {
    backgroundColor: "#F1E9E5",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  tagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B4E45",
  },

  infoRow: {
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: "#EEE8E3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9A918A",
  },

  infoValue: {
    flex: 1,
    marginLeft: 15,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: "#302825",
  },

  /*
   * GOALS
   */

  goalsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  goalRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
  },

  goalRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
  },

  goalIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  goalIconText: {
    fontSize: 15,
    color: "#6B4E45",
  },

  goalText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#302825",
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
   * WELCOME
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
