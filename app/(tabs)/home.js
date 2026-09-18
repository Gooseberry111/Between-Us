import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { Skeleton, SkeletonCard } from "../../components/Skeleton";
import {
  GlassBackground,
  GlassPanel,
  FadeIn,
  Card,
} from "../../components/Glass";
import FinishProfileCard from "../../components/FinishProfileCard";
import { Celebrate, PASTELS, Squish, StatTile } from "../../components/Playful";
import { TOTAL_QUESTIONS, countAnswered } from "../../lib/profileProgress";

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
  const [answeredCount, setAnsweredCount] = useState(
    cached?.answeredCount ?? null,
  );
  const [partner, setPartner] = useState(cached?.partner ?? null);
  const [daily, setDaily] = useState(cached?.daily ?? null);
  const [memoryCount, setMemoryCount] = useState(cached?.memoryCount ?? null);
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
        onboardingData,
      ] = await Promise.all([
        apiFetch(`/users/${userId}/profile`),
        apiFetch(`/users/${userId}/connections`),
        apiFetch(`/users/${userId}/reminders`),
        apiFetch(`/users/${userId}/notifications`),
        /* Only drives the "finish your profile" card, so a
         * failure here should not take the rest of Home down. */
        apiFetch(`/users/${userId}/onboarding`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ]);

      if (onboardingData?.exists) {
        setAnsweredCount(countAnswered(onboardingData.answers));
      }

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

        const [partnerResponse, triviaResponse, dailyData, memoriesData] =
          await Promise.all([
            /* Under your own id: the API decides who your partner
             * is, so no request can name someone else's. */
            apiFetch(`/users/${userId}/partner`),
            apiFetch(`/users/${userId}/trivia`),
            /* The real question of the day, and the streak that
             * comes with it -- Home used to show a guess from a
             * local list, which could differ from the actual one. */
            apiFetch(`/users/${userId}/daily-question`)
              .then((response) => (response.ok ? response.json() : null))
              .catch(() => null),
            apiFetch(`/users/${userId}/memories`)
              .then((response) => (response.ok ? response.json() : null))
              .catch(() => null),
          ]);

        setDaily(dailyData);

        setMemoryCount(
          Array.isArray(memoriesData?.memories)
            ? memoriesData.memories.length
            : Array.isArray(memoriesData)
              ? memoriesData.length
              : null,
        );

        const partnerData = await partnerResponse.json();

        const triviaData = await triviaResponse.json();

        console.log("HOME PARTNER:", partnerData);

        setPartner(partnerData?.partner || null);

        setPartnerInsights(partnerData?.insights || null);

        setPartnerPreferences(partnerData?.preferences || null);

        setTrivia(triviaData);
      } else {
        setPartnerInsights(null);
        setPartnerPreferences(null);
        setTrivia(null);
        setDaily(null);
        setMemoryCount(null);
        setPartner(null);
      }
    } catch (err) {
      console.log("HOME LOAD ERROR:", err);

      setError(err?.message || "Unable to load your home.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  /*
   * Tabs stay mounted, so a mount-only fetch kept showing
   * the old partner after unlinking in Profile. Refetch
   * whenever Home comes back into view.
   */
  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome]),
  );

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
      answeredCount,
      daily,
      memoryCount,
      partner,
    });
  }, [
    loading,
    answeredCount,
    cacheKey,
    profile,
    connection,
    partnerInsights,
    partnerPreferences,
    pendingRequests,
    trivia,
    reminders,
    hasUnreadNotifications,
    daily,
    memoryCount,
    partner,
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHome();
  };

  if (loading) {
    return <HomeSkeleton />;
  }

  const dailyQuestion = daily?.question || todaysQuestionPreview();

  const streak = Number(daily?.streak || 0);

  const answeredToday = Boolean(daily?.your_answer);

  /*
   * Days since the two of you linked. A real number beats
   * any amount of decoration.
   */
  const daysTogether = connection?.connected_at
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(connection.connected_at).getTime()) / 86400000,
        ) + 1,
      )
    : null;

  const finishProfileCard =
    answeredCount !== null && answeredCount < TOTAL_QUESTIONS ? (
      <FinishProfileCard
        answered={answeredCount}
        onPress={() => router.push("/onboarding")}
      />
    ) : null;

  const firstName = profile?.first_name?.trim() || "there";

  /* A nickname is what they actually call each other, so it
     wins over the name on the birth certificate. */
  const partnerName =
    partner?.nickname?.trim() ||
    partner?.first_name?.trim() ||
    connection?.other_first_name?.trim() ||
    "Your person";

  const myName =
    profile?.nickname?.trim() || profile?.first_name?.trim() || "You";

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
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <GlassBackground>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#D9456B"
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

              {finishProfileCard}

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

              <QuickActions router={router} locked />
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#D9456B"
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

            {/* FINISH YOUR PROFILE -- first, until it's done */}

            {finishProfileCard}

            {/* CONNECTION CARD */}

            <FadeIn delay={40}>
              <Pressable onPress={() => router.push("/connection")}>
                <GlassPanel style={styles.connectionCard}>
                  <Text style={styles.togetherLabel}>{relationshipLabel}</Text>

                  {/* The two of you, overlapping, because that is
                      the whole idea of the app. */}
                  <View style={styles.pairRow}>
                    <View style={styles.pairSideLeft}>
                      <View style={[styles.pairAvatar, styles.pairAvatarMine]}>
                        <Text style={styles.pairAvatarText}>
                          {(myName || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <Text style={styles.pairName} numberOfLines={1}>
                        {myName}
                      </Text>
                    </View>

                    <View style={styles.pairKnot}>
                      <Text style={styles.pairHeart}>♡</Text>
                    </View>

                    <View style={styles.pairSideRight}>
                      <View
                        style={[styles.pairAvatar, styles.pairAvatarTheirs]}
                      >
                        <Text style={styles.pairAvatarText}>
                          {(partnerName || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <Text style={styles.pairName} numberOfLines={1}>
                        {partnerName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.connectionDivider} />

                  <View style={styles.connectionBottom}>
                    <Text style={styles.connectionSmallText}>
                      {daysTogether
                        ? `Linked ${daysTogether} ${daysTogether === 1 ? "day" : "days"} ago`
                        : "Keep choosing each other."}
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#F0E4DE"
                    />
                  </View>
                </GlassPanel>
              </Pressable>
            </FadeIn>

            {/* THE NUMBERS THAT MEAN SOMETHING */}

            <FadeIn delay={90}>
              <View style={styles.statRow}>
                {daysTogether ? (
                  <StatTile
                    value={daysTogether}
                    label={
                      daysTogether === 1 ? "day together" : "days together"
                    }
                    tone="blush"
                  />
                ) : null}

                {memoryCount !== null ? (
                  <StatTile
                    value={memoryCount}
                    label={memoryCount === 1 ? "memory" : "memories"}
                    tone="sky"
                  />
                ) : null}

                {streak > 0 ? (
                  <StatTile
                    value={streak}
                    label={streak === 1 ? "day streak" : "day streak"}
                    tone="sage"
                  />
                ) : null}
              </View>
            </FadeIn>

            {/* QUICK ACCESS */}

            <QuickActions router={router} />

            {/* DAILY QUESTION */}

            <FadeIn delay={280}>
              <Squish onPress={() => router.push("/daily-question")}>
                <View style={styles.dailyCard}>
                  <View style={styles.dailyTop}>
                    <Text style={styles.dailyLabel}>TODAY'S QUESTION</Text>

                    {answeredToday ? (
                      <Celebrate tone="sage">
                        {daily?.partner_answered
                          ? "Both answered"
                          : "You've answered"}
                      </Celebrate>
                    ) : null}
                  </View>

                  <Text style={styles.dailyText} numberOfLines={4}>
                    {dailyQuestion}
                  </Text>

                  <View style={styles.dailyButton}>
                    <Text style={styles.dailyButtonText}>
                      {answeredToday
                        ? daily?.partner_answered
                          ? `See what ${partnerName} said`
                          : `Waiting on ${partnerName}`
                        : `Answer & unlock ${partnerName}'s`}
                    </Text>

                    <Ionicons name="arrow-forward" size={15} color="#8A6B32" />
                  </View>
                </View>
              </Squish>
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

            {/* Everything about them lives on Insights.
                Home used to repeat it all, which made the screen
                long and the Insights tab pointless. */}

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

  const hour = new Date().getHours();

  const timeOfDay =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <View style={styles.brandRow}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.brandMark}
            resizeMode="contain"
          />

          <Text style={styles.brand}>BETWEEN US</Text>
        </View>

        <Text style={styles.greeting}>
          {timeOfDay},{"\n"}
          <Text style={styles.greetingName}>{firstName}.</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={styles.notificationButton}
        activeOpacity={0.8}
        onPress={() => router.push("/notifications")}
      >
        <Ionicons name="notifications-outline" size={21} color="#D9456B" />

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

function QuickActions({ router, locked = false }) {
  /*
   * Six shortcuts in a 2x3 grid. Small on purpose:
   * these are signposts, not content, so they should
   * not out-shout the cards underneath them.
   */
  const items = [
    {
      icon: "time-outline",
      label: "Timeline",
      route: "/memories",
      tone: "sky",
    },
    {
      icon: "stats-chart-outline",
      label: "Insights",
      route: "/insights",
      tone: "lilac",
    },
    {
      icon: "heart-outline",
      label: "Thanks",
      route: "/appreciations",
      tone: "blush",
    },
    {
      icon: "pulse-outline",
      label: "Check-in",
      route: "/check-in",
      tone: "sage",
    },
    { icon: "flag-outline", label: "Goals", route: "/goals", tone: "butter" },
    {
      icon: "calendar-outline",
      label: "Dates",
      route: "/special-dates",
      tone: "clay",
    },
  ];

  return (
    <View style={styles.quickWrap}>
      {items.map((item, index) => (
        <FadeIn
          key={item.route}
          delay={90 + index * 30}
          style={styles.quickCell}
        >
          <Squish
            style={[styles.quickAction, locked && styles.quickActionLocked]}
            onPress={() => {
              if (!locked) {
                router.push(item.route);
                return;
              }

              /* Every shortcut here is a shared feature. */
              Alert.alert(
                "Connect first",
                `${item.label} is something you share with your partner, so it unlocks once you're linked.`,
                [
                  { text: "Not now", style: "cancel" },
                  {
                    text: "Find someone",
                    onPress: () => router.push("/find-person"),
                  },
                ],
              );
            }}
          >
            <View
              style={[
                styles.quickIcon,
                {
                  backgroundColor: locked
                    ? "#EDE6E1"
                    : (PASTELS[item.tone] || PASTELS.clay).bg,
                },
              ]}
            >
              <Ionicons
                name={locked ? "lock-closed" : item.icon}
                size={locked ? 14 : 17}
                color={
                  locked ? "#9A8F88" : (PASTELS[item.tone] || PASTELS.clay).ink
                }
              />
            </View>

            <Text style={styles.quickTitle}>{item.label}</Text>
          </Squish>
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingHeart}>♡</Text>
          </View>

          <Text style={styles.loadingTitle}>Between Us</Text>

          <ActivityIndicator
            size="small"
            color="#D9456B"
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
    /* Clears the floating tab bar and the phone's own
     * navigation underneath it. */
    paddingBottom: 120,
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

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  brandMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },

  brand: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#D9456B",
  },

  greeting: {
    fontFamily: "DancingScript_600SemiBold",
    marginTop: 10,
    fontSize: 34,
    lineHeight: 40,
    color: "#9C8F97",
    letterSpacing: 0,
  },

  greetingName: {
    fontFamily: "DancingScript_700Bold",
    fontSize: 38,
    color: "#D9456B",
  },

  /* The row of numbers under the partner card. */
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(217, 69, 107, 0.09)",
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
    borderColor: "#F5DCE4",
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
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dailyCard: {
    backgroundColor: "#F8E8C8",
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
  },

  dailyLabel: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#A88A4E",
  },

  dailyText: {
    fontFamily: "Fraunces_700Bold",
    marginTop: 14,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: "#5C4726",
    letterSpacing: -0.2,
  },

  dailyButton: {
    marginTop: 18,
    height: 46,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },

  dailyButtonText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
    fontWeight: "800",
    color: "#8A6B32",
  },

  connectionCard: {
    marginBottom: 14,
    borderRadius: 28,
  },

  pairRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 6,
  },

  /* The two circles overlap, with the heart sitting in the
     join, so the card says "linked" before any word does. */
  pairSideLeft: {
    alignItems: "center",
    marginRight: -16,
    zIndex: 1,
  },

  pairSideRight: {
    alignItems: "center",
    marginLeft: -16,
    zIndex: 1,
  },

  pairAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.65)",
  },

  pairAvatarMine: {
    backgroundColor: "#F7E2E6",
  },

  pairAvatarTheirs: {
    backgroundColor: "#DCE7F2",
  },

  pairAvatarText: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 22,
    fontWeight: "800",
    color: "#7A2E4A",
  },

  /* The knot in the middle: the two circles lean into it. */
  pairKnot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
    zIndex: 3,
  },

  pairHeart: {
    fontFamily: "Nunito_400Regular",
    fontSize: 18,
    color: "#D9456B",
  },

  pairName: {
    fontFamily: "DancingScript_700Bold",
    marginTop: 9,
    fontSize: 20,
    color: "#FFFFFF",
    maxWidth: 110,
    textAlign: "center",
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
    fontFamily: "Fraunces_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  connectionInfo: {
    flex: 1,
    marginLeft: 14,
  },

  togetherLabel: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#EBC9D5",
  },

  partnerName: {
    fontFamily: "Fraunces_700Bold",
    marginTop: 3,
    fontSize: 21,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  relationshipText: {
    fontFamily: "Nunito_400Regular",
    marginTop: 2,
    fontSize: 12,
    color: "#EBC9D5",
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
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#EBC9D5",
  },

  connectionSmallText: {
    fontFamily: "Nunito_400Regular",
    marginTop: 4,
    fontSize: 13,
    color: "#FFFFFF",
  },

  connectionHeart: {
    fontFamily: "Nunito_400Regular",
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
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9C8F97",
    marginBottom: 8,
  },

  sectionTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#2E2430",
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
    backgroundColor: "rgba(217, 69, 107, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  promptIconText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 18,
    color: "#D9456B",
  },

  promptEyebrow: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#9C8F97",
    marginBottom: 6,
  },

  promptTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#2E2430",
  },

  promptDescription: {
    fontFamily: "Nunito_400Regular",
    marginTop: 9,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5F68",
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
    fontFamily: "Nunito_700Bold",
    color: "#D9456B",
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
    fontFamily: "Fraunces_700Bold",
    fontSize: 16,
    fontWeight: "700",
    color: "#2E2430",
    marginBottom: 4,
  },

  snapshotRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#FAECF1",
  },

  snapshotLabel: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    fontWeight: "700",
    color: "#9C8F97",
  },

  snapshotValue: {
    fontFamily: "Nunito_600SemiBold",
    flex: 1,
    marginLeft: 15,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#2E2430",
  },

  emptySnapshot: {
    fontFamily: "Nunito_400Regular",
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B5F68",
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
    fontFamily: "Fraunces_700Bold",
    fontSize: 16,
    fontWeight: "700",
    color: "#2E2430",
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
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    fontWeight: "700",
    color: "#D9456B",
  },

  infoRow: {
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: "#FAECF1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoLabel: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    fontWeight: "700",
    color: "#9C8F97",
  },

  infoValue: {
    fontFamily: "Nunito_600SemiBold",
    flex: 1,
    marginLeft: 15,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: "#2E2430",
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
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    color: "#D9456B",
  },

  goalText: {
    fontFamily: "Nunito_600SemiBold",
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#2E2430",
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
    fontFamily: "Fraunces_700Bold",
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  triviaContent: {
    flex: 1,
    marginLeft: 14,
  },

  triviaTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  triviaDescription: {
    fontFamily: "Nunito_400Regular",
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: "#EBC9D5",
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
    fontFamily: "Nunito_800ExtraBold",
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
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
  },

  quickActionLocked: {
    opacity: 0.55,
  },

  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  quickIconText: {
    fontFamily: "Nunito_400Regular",
    color: "#D9456B",
    fontSize: 17,
  },

  quickTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    fontWeight: "700",
    color: "#2E2430",
  },

  quickText: {
    fontFamily: "Nunito_400Regular",
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B5F68",
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
    /* Without this the quick access grid sat flush against
     * it -- the connected layout only looked fine because
     * the partner card above the grid had its own margin. */
    marginBottom: 20,
  },

  welcomeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(217, 69, 107, 0.09)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  heart: {
    fontFamily: "Nunito_400Regular",
    fontSize: 28,
    color: "#D9456B",
  },

  welcomeTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
    color: "#2E2430",
  },

  welcomeDescription: {
    fontFamily: "Nunito_400Regular",
    marginTop: 13,
    fontSize: 14,
    lineHeight: 21,
    color: "#6B5F68",
  },

  primaryButton: {
    height: 54,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: "#D9456B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
  },

  primaryButtonText: {
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  primaryArrow: {
    fontFamily: "Nunito_400Regular",
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
    backgroundColor: "rgba(217, 69, 107, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  pendingHeart: {
    fontFamily: "Nunito_400Regular",
    color: "#D9456B",
    fontSize: 22,
  },

  pendingContent: {
    flex: 1,
    marginLeft: 12,
  },

  pendingTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 14,
    fontWeight: "700",
    color: "#2E2430",
  },

  pendingText: {
    fontFamily: "Nunito_400Regular",
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B5F68",
  },

  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
  },

  smallButtonText: {
    fontFamily: "Nunito_700Bold",
    color: "#D9456B",
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
    backgroundColor: "#FBEEF2",
    alignItems: "center",
  },

  footerQuote: {
    fontFamily: "Nunito_600SemiBold",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "#D9456B",
  },

  footerSubtext: {
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    marginTop: 7,
    fontSize: 11,
    lineHeight: 17,
    color: "#6B5F68",
  },

  /*
   * ERROR
   */

  errorBox: {
    backgroundColor: "#F9E3EA",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 15,
  },

  errorText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: "#C2405F",
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
    backgroundColor: "rgba(217, 69, 107, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingHeart: {
    fontFamily: "Nunito_400Regular",
    fontSize: 29,
    color: "#D9456B",
  },

  loadingTitle: {
    fontFamily: "Fraunces_700Bold",
    marginTop: 14,
    fontSize: 21,
    fontWeight: "700",
    color: "#2E2430",
  },

  loadingIndicator: {
    marginTop: 15,
  },
});
