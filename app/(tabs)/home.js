import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
import { Ionicons } from "@expo/vector-icons";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { Skeleton, SkeletonCard } from "../../components/Skeleton";
import {
  GlassBackground,
  GlassPanel,
  FadeIn,
  Card,
} from "../../components/Glass";

const API_URL = "https://between-us-api.between-us.workers.dev";

const DAILY_QUESTION_PREVIEWS = [
  "What is something I did recently that you appreciated but never said out loud?",
  "What does a perfect ordinary day together look like to you?",
  "When do you feel closest to me?",
  "What is something you are looking forward to right now?",
  "What is one thing you wish we did more often?",
  "What is a small thing that instantly improves your mood?",
  "What is something you are proud of yourself for this week?",
  "Where would you most want to wake up tomorrow?",
  "What is something about me that made you laugh recently?",
  "What is one thing you need more of from me right now?",
];

function todaysQuestionPreview() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000);

  return DAILY_QUESTION_PREVIEWS[dayOfYear % DAILY_QUESTION_PREVIEWS.length];
}

export default function HomeScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  /*
   * Seed straight from the session cache so coming
   * back to Home renders the real screen instantly
   * instead of flashing a spinner.
   */
  const cacheKey = userId ? `home:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [profile, setProfile] = useState(cached?.profile ?? null);
  const [connection, setConnection] = useState(cached?.connection ?? null);
  const [partnerInsights, setPartnerInsights] = useState(
    cached?.partnerInsights ?? null,
  );
  const [partnerPreferences, setPartnerPreferences] = useState(
    cached?.partnerPreferences ?? null,
  );
  const [pendingRequests, setPendingRequests] = useState(
    cached?.pendingRequests ?? [],
  );
  const [trivia, setTrivia] = useState(cached?.trivia ?? null);
  const [reminders, setReminders] = useState(cached?.reminders ?? []);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(
    cached?.hasUnreadNotifications ?? false,
  );
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHome = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [
        profileResponse,
        connectionResponse,
        remindersResponse,
        notificationsResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/users/${userId}/profile`),
        fetch(`${API_URL}/users/${userId}/connections`),
        fetch(`${API_URL}/users/${userId}/reminders`),
        fetch(`${API_URL}/users/${userId}/notifications`),
      ]);

      const profileData = await profileResponse.json();
      const connectionData = await connectionResponse.json();
      const remindersData = await remindersResponse.json();
      const notificationsData = await notificationsResponse.json();

      console.log("HOME PROFILE:", profileData);
      console.log("HOME CONNECTIONS:", connectionData);
      console.log("HOME REMINDERS:", remindersData);
      console.log("HOME NOTIFICATIONS:", notificationsData);

      if (!profileResponse.ok) {
        throw new Error(profileData?.error || "Unable to load your profile.");
      }

      if (!connectionResponse.ok) {
        throw new Error(
          connectionData?.error || "Unable to load your connections.",
        );
      }

      if (!remindersResponse.ok) {
        throw new Error(
          remindersData?.error || "Unable to load your reminders.",
        );
      }

      if (!notificationsResponse.ok) {
        throw new Error(
          notificationsData?.error || "Unable to load your notifications.",
        );
      }

      setProfile(profileData?.profile || null);

      setReminders(
        Array.isArray(remindersData?.reminders) ? remindersData.reminders : [],
      );

      const notifications = Array.isArray(notificationsData?.notifications)
        ? notificationsData.notifications
        : [];

      // Show only a small dot on the bell when at least
      // one notification has not been read.
      setHasUnreadNotifications(
        notifications.some((notification) => notification.is_read === false),
      );

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
       */

      if (accepted?.other_clerk_id) {
        const partnerClerkId = accepted.other_clerk_id;

        const [
          partnerInsightsResponse,
          partnerPreferencesResponse,
          triviaResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/users/${partnerClerkId}/insights`),
          fetch(`${API_URL}/users/${partnerClerkId}/preferences`),
          fetch(`${API_URL}/users/${userId}/trivia`),
        ]);

        const partnerInsightsData = await partnerInsightsResponse.json();

        const partnerPreferencesData = await partnerPreferencesResponse.json();

        const triviaData = await triviaResponse.json();

        console.log("HOME PARTNER INSIGHTS:", partnerInsightsData);

        console.log("HOME PARTNER PREFERENCES:", partnerPreferencesData);

        console.log("HOME TRIVIA:", triviaData);

        setPartnerInsights(partnerInsightsData?.insights || null);

        setPartnerPreferences(partnerPreferencesData?.preferences || null);

        setTrivia(triviaData);
      } else {
        setPartnerInsights(null);
        setPartnerPreferences(null);
        setTrivia(null);
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

  /*
   * Keep the cache in step with whatever is on screen.
   */
  useEffect(() => {
    if (loading || !cacheKey) return;

    setCachedData(cacheKey, {
      profile,
      connection,
      partnerInsights,
      partnerPreferences,
      pendingRequests,
      trivia,
      reminders,
      hasUnreadNotifications,
    });
  }, [
    loading,
    cacheKey,
    profile,
    connection,
    partnerInsights,
    partnerPreferences,
    pendingRequests,
    trivia,
    reminders,
    hasUnreadNotifications,
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHome();
  };

  if (loading) {
    return <HomeSkeleton />;
  }

  const dailyQuestion = todaysQuestionPreview();

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
        <GlassBackground>
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
              <Header
                firstName={firstName}
                hasUnreadNotifications={hasUnreadNotifications}
              />

              {error ? <ErrorMessage message={error} /> : null}

              <Card style={styles.welcomeCard}>
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
                  connect, this becomes your shared space for memories,
                  insights, reminders and meaningful moments.
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/find-person")}
                >
                  <Text style={styles.primaryButtonText}>Find someone</Text>

                  <Text style={styles.primaryArrow}>→</Text>
                </TouchableOpacity>
              </Card>

              {pendingRequests.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>CONNECTION REQUEST</Text>

                  <Card style={styles.pendingCard}>
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
                  </Card>
                </View>
              ) : null}

              <QuickActions router={router} />
            </View>
          </ScrollView>
        </GlassBackground>
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

  const focusAreas = Array.isArray(partnerInsights?.focus_areas)
    ? partnerInsights.focus_areas
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
   * TODAY PROMPT
   * ==========================================
   */

  const todayPrompt = getTodayPrompt({
    partnerName,
    loveLanguages,
    focusAreas,
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
      <GlassBackground>
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
            <Header
              firstName={firstName}
              hasUnreadNotifications={hasUnreadNotifications}
            />

            {error ? <ErrorMessage message={error} /> : null}

            {/* CONNECTION CARD */}

            <FadeIn delay={40}>
              <Pressable onPress={() => router.push("/connection")}>
                <GlassPanel style={styles.connectionCard}>
                  <View style={styles.connectionTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(partnerName || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.connectionInfo}>
                      <Text style={styles.togetherLabel}>YOU & THEM</Text>

                      <Text style={styles.partnerName}>{partnerName}</Text>

                      <Text style={styles.relationshipText}>
                        {relationshipLabel}
                      </Text>
                    </View>

                    <View style={styles.onlineDot} />
                  </View>

                  <View style={styles.connectionDivider} />

                  <View style={styles.connectionBottom}>
                    <View>
                      <Text style={styles.connectionSmallLabel}>
                        YOUR SPACE
                      </Text>

                      <Text style={styles.connectionSmallText}>
                        Keep choosing each other.
                      </Text>
                    </View>

                    <Text style={styles.connectionHeart}>♡</Text>
                  </View>
                </GlassPanel>
              </Pressable>
            </FadeIn>

            {/* QUICK ACCESS */}

            <QuickActions router={router} />

            {/* DAILY QUESTION */}

            <FadeIn delay={280}>
              <GlassPanel style={styles.dailyPanel}>
                <View style={styles.dailyTop}>
                  <Text style={styles.dailyLabel}>TODAY'S QUESTION</Text>

                  <Ionicons name="arrow-forward" size={16} color="#F0E4DE" />
                </View>

                <Text style={styles.dailyText} numberOfLines={3}>
                  {dailyQuestion}
                </Text>

                <TouchableOpacity
                  style={styles.dailyButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/daily-question")}
                >
                  <Text style={styles.dailyButtonText}>
                    Answer & unlock {partnerName}'s
                  </Text>
                </TouchableOpacity>
              </GlassPanel>
            </FadeIn>

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

              <Card style={styles.promptCard}>
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
              </Card>
            </View>

            {/* COUPLE TRIVIA */}

            {trivia?.questions?.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionLabel}>COUPLE TRIVIA</Text>

                    <Text style={styles.sectionTitle}>
                      How well do you know {partnerName}?
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={styles.triviaCard}
                  onPress={() => router.push("/trivia")}
                >
                  <GlassPanel>
                    <View style={styles.triviaRow}>
                      <View style={styles.triviaIcon}>
                        <Text style={styles.triviaIconText}>?</Text>
                      </View>

                      <View style={styles.triviaContent}>
                        <Text style={styles.triviaTitle}>
                          Test what you know about them
                        </Text>

                        <Text style={styles.triviaDescription}>
                          Answer {trivia.total_questions} quick questions about{" "}
                          {partnerName}.
                        </Text>

                        <View style={styles.triviaButton}>
                          <Text style={styles.triviaButtonText}>
                            Play trivia →
                          </Text>
                        </View>
                      </View>
                    </View>
                  </GlassPanel>
                </Pressable>
              </View>
            ) : null}

            {/* PARTNER SNAPSHOT */}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ABOUT THEM</Text>

              <Card style={styles.snapshotCard}>
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
              </Card>
            </View>

            {/* HOW TO LOVE THEM */}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HOW TO LOVE THEM</Text>

              <Card style={styles.loveCard}>
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
                  <InfoRow
                    label="Communication"
                    value={communicationFrequency}
                  />
                ) : null}

                {conflictStyle ? (
                  <InfoRow label="During conflict" value={conflictStyle} />
                ) : null}
              </Card>
            </View>

            {/* GOALS */}

            {focusAreas.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>WHAT THEY WANT MORE OF</Text>

                <Card style={styles.goalsCard}>
                  {focusAreas.map((focusArea, index) => (
                    <View key={`${focusArea}-${index}`} style={styles.goalRow}>
                      <View style={styles.goalIcon}>
                        <Text style={styles.goalIconText}>✦</Text>
                      </View>

                      <Text style={styles.goalText}>{focusArea}</Text>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}

            {/* FOOTER */}

            <Card style={styles.footerCard}>
              <Text style={styles.footerQuote}>
                "The little things are often the big things."
              </Text>

              <Text style={styles.footerSubtext}>
                Between Us is here to help you remember them.
              </Text>
            </Card>
          </View>
        </ScrollView>
      </GlassBackground>
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
  focusAreas,
  conflictStyle,
  communicationFrequency,
  food,
  drink,
  movieGenre,
  musicGenre,
  favoriteColor,
}) {
  if (focusAreas.includes("Date Ideas")) {
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

  if (conflictStyle.toLowerCase() === "need reassurance") {
    return {
      title: `Remind ${partnerName} that you are on their side.`,
      description:
        "They tend to need reassurance when things become difficult. A simple reminder that you are still together can mean a lot.",
      buttonText: "Send reassurance",
    };
  }

  if (communicationFrequency.toLowerCase() === "text") {
    return {
      title: `Send ${partnerName} a thoughtful message.`,
      description:
        "They prefer communicating through text. Send something that lets them know you are thinking about them.",
      buttonText: "Send a message",
    };
  }

  if (food) {
    return {
      title: `Do something with ${food.toLowerCase()} today.`,
      description: `${partnerName} enjoys ${food.toLowerCase()}. You could surprise them with it or make plans around it.`,
      buttonText: "Make it happen",
    };
  }

  if (drink) {
    return {
      title: `Pick up their favorite drink.`,
      description: `${partnerName} enjoys ${drink}. A small familiar gesture can make an ordinary day feel thoughtful.`,
      buttonText: "Make a small gesture",
    };
  }

  if (musicGenre) {
    return {
      title: `Share some ${musicGenre.toLowerCase()} music together.`,
      description: `${partnerName} enjoys ${musicGenre.toLowerCase()} music. Put on something they love and enjoy the moment together.`,
      buttonText: "Make a moment",
    };
  }

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

function Header({ firstName, hasUnreadNotifications }) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.brand}>BETWEEN US</Text>

        <Text style={styles.greeting}>Good to see you, {firstName}.</Text>
      </View>

      <TouchableOpacity
        style={styles.notificationButton}
        activeOpacity={0.8}
        onPress={() => router.push("/notifications")}
      >
        <Ionicons name="notifications-outline" size={21} color="#6B4E45" />

        {hasUnreadNotifications ? (
          <View style={styles.notificationUnreadDot} />
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

/*
 * ==========================================
 * QUICK ACTIONS
 * ==========================================
 */

function QuickActions({ router }) {
  /*
   * Six shortcuts in a 2x3 grid. Small on purpose:
   * these are signposts, not content, so they should
   * not out-shout the cards underneath them.
   */
  const items = [
    { icon: "time-outline", label: "Timeline", route: "/memories" },
    { icon: "stats-chart-outline", label: "Insights", route: "/insights" },
    { icon: "heart-outline", label: "Thanks", route: "/appreciations" },
    { icon: "pulse-outline", label: "Check-in", route: "/check-in" },
    { icon: "flag-outline", label: "Goals", route: "/goals" },
    { icon: "calendar-outline", label: "Dates", route: "/special-dates" },
  ];

  return (
    <View style={styles.quickWrap}>
      {items.map((item, index) => (
        <FadeIn
          key={item.route}
          delay={90 + index * 30}
          style={styles.quickCell}
        >
          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => router.push(item.route)}
          >
            <View style={styles.quickIcon}>
              <Ionicons name={item.icon} size={16} color="#6B4E45" />
            </View>

            <Text style={styles.quickTitle}>{item.label}</Text>
          </TouchableOpacity>
        </FadeIn>
      ))}
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

/*
 * ==========================================
 * HOME SKELETON
 * ==========================================
 *
 * Shown only on a genuinely cold load, when
 * there is nothing cached yet. It mirrors the
 * real layout so the screen appears immediately
 * and fills in, rather than blocking on a spinner.
 */

function HomeSkeleton() {
  return (
    <SafeAreaView style={styles.screen}>
      <GlassBackground>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.container}>
            <View style={{ marginBottom: 26 }}>
              <Skeleton width={96} height={11} radius={6} />
              <Skeleton
                width="65%"
                height={28}
                radius={9}
                style={{ marginTop: 12 }}
              />
              <Skeleton width="45%" height={13} style={{ marginTop: 10 }} />
            </View>

            <SkeletonCard lines={2} style={{ marginBottom: 13 }} />
            <SkeletonCard lines={3} style={{ marginBottom: 13 }} />
            <SkeletonCard lines={2} />
          </View>
        </ScrollView>
      </GlassBackground>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <GlassBackground>
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
      </GlassBackground>
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
  },

  /*
   * Cards are translucent now so the gradient and
   * colour blobs behind them show through as glass.
   */

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

  headerText: {
    flex: 1,
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

  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    position: "relative",
  },

  notificationUnreadDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#B34A3C",
    borderWidth: 1.5,
    borderColor: "#E9DED8",
  },

  /*
   * CONNECTION
   */

  dailyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
    marginBottom: 13,
  },

  dailyTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dailyLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#DCCBC4",
  },

  dailyText: {
    marginTop: 12,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  dailyButton: {
    marginTop: 16,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
  },

  dailyButtonText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  connectionCard: {
    marginBottom: 18,
  },

  connectionTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
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
    backgroundColor: "#7FA383",
  },

  connectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
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
    color: "#E9C7BE",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },

  promptIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 20,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
   * COUPLE TRIVIA
   */

  triviaCard: {
    marginTop: 14,
  },

  triviaRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  triviaIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  triviaIconText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  triviaContent: {
    flex: 1,
    marginLeft: 14,
  },

  triviaTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  triviaDescription: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: "#DCCBC4",
  },

  triviaButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },

  triviaButtonText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /*
   * QUICK ACTIONS
   */

  quickWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 18,
  },

  quickCell: {
    width: "33.333%",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },

  quickAction: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
  },

  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },

  quickIconText: {
    color: "#6B4E45",
    fontSize: 17,
  },

  quickTitle: {
    fontSize: 11,
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
   * WELCOME
   */

  welcomeCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },

  welcomeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },

  pendingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
    backgroundColor: "rgba(255, 255, 255, 0.78)",
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
    backgroundColor: "rgba(107, 78, 69, 0.09)",
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
