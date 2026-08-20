import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function InsightsScreen() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [insights, setInsights] = useState(null);
  const [preferences, setPreferences] = useState(null);

  const [partnerInsights, setPartnerInsights] = useState(null);
  const [partnerPreferences, setPartnerPreferences] = useState(null);

  const [connection, setConnection] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [insightsResponse, preferencesResponse, connectionResponse] =
        await Promise.all([
          fetch(`${API_URL}/users/${userId}/insights`),
          fetch(`${API_URL}/users/${userId}/preferences`),
          fetch(`${API_URL}/users/${userId}/connections`),
        ]);

      const insightsData = await insightsResponse.json();
      const preferencesData = await preferencesResponse.json();
      const connectionData = await connectionResponse.json();

      console.log("INSIGHTS RESPONSE:", insightsData);
      console.log("PREFERENCES RESPONSE:", preferencesData);
      console.log("INSIGHTS CONNECTIONS:", connectionData);

      if (!insightsResponse.ok) {
        throw new Error(insightsData?.error || "Unable to load your insights.");
      }

      setInsights(insightsData?.insights || null);

      setPreferences(preferencesData?.preferences || preferencesData || null);

      const connections = Array.isArray(connectionData) ? connectionData : [];

      const accepted = connections.find(
        (item) => item?.status?.toLowerCase() === "accepted",
      );

      setConnection(accepted || null);

      /*
       * ==========================================
       * LOAD PARTNER DATA
       * ==========================================
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

        console.log("PARTNER INSIGHTS RESPONSE:", partnerInsightsData);

        console.log("PARTNER PREFERENCES RESPONSE:", partnerPreferencesData);

        setPartnerInsights(partnerInsightsData?.insights || null);

        setPartnerPreferences(
          partnerPreferencesData?.preferences || partnerPreferencesData || null,
        );
      } else {
        setPartnerInsights(null);
        setPartnerPreferences(null);
      }
    } catch (err) {
      console.log("INSIGHTS LOAD ERROR:", err);

      setError(err?.message || "Unable to load your insights.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadInsights();
  };

  if (loading) {
    return <LoadingScreen />;
  }

  /*
   * ==========================================
   * BASIC DATA
   * ==========================================
   */

  const partnerName = connection?.other_first_name?.trim() || "Your partner";

  const relationshipType = connection?.relationship_type
    ? connection.relationship_type.charAt(0).toUpperCase() +
      connection.relationship_type.slice(1)
    : "Relationship";

  const loveLanguages = Array.isArray(preferences?.love_languages)
    ? preferences.love_languages
    : [];

  const partnerLoveLanguages = Array.isArray(partnerPreferences?.love_languages)
    ? partnerPreferences.love_languages
    : [];

  const goals = Array.isArray(insights?.goals) ? insights.goals : [];

  const partnerGoals = Array.isArray(partnerInsights?.goals)
    ? partnerInsights.goals
    : [];

  /*
   * ==========================================
   * COMMON DATA
   * ==========================================
   */

  const sharedLoveLanguages = loveLanguages.filter((language) =>
    partnerLoveLanguages.includes(language),
  );

  const sharedGoals = goals.filter((goal) => partnerGoals.includes(goal));

  const sharedInterests = [];

  if (
    preferences?.music_genre &&
    partnerPreferences?.music_genre &&
    preferences.music_genre.toLowerCase() ===
      partnerPreferences.music_genre.toLowerCase()
  ) {
    sharedInterests.push(`You both enjoy ${preferences.music_genre} music`);
  }

  if (
    preferences?.favorite_drink &&
    partnerPreferences?.favorite_drink &&
    preferences.favorite_drink.trim().toLowerCase() ===
      partnerPreferences.favorite_drink.trim().toLowerCase()
  ) {
    sharedInterests.push(`You both enjoy ${preferences.favorite_drink.trim()}`);
  }

  /*
   * ==========================================
   * DIFFERENCES
   * ==========================================
   */

  const differences = [];

  if (
    preferences?.movie_genre &&
    partnerPreferences?.movie_genre &&
    preferences.movie_genre.toLowerCase() !==
      partnerPreferences.movie_genre.toLowerCase()
  ) {
    differences.push(
      `You prefer ${preferences.movie_genre} movies while ${partnerName} prefers ${partnerPreferences.movie_genre}.`,
    );
  }

  if (
    preferences?.favorite_food &&
    partnerPreferences?.favorite_food &&
    preferences.favorite_food.trim().toLowerCase() !==
      partnerPreferences.favorite_food.trim().toLowerCase()
  ) {
    differences.push(
      `You enjoy ${preferences.favorite_food}, while ${partnerName} enjoys ${partnerPreferences.favorite_food}.`,
    );
  }

  /*
   * ==========================================
   * RELATIONSHIP INSIGHT
   * ==========================================
   */

  let relationshipInsight =
    "Keep learning about each other. The more you understand each other's preferences, the easier it becomes to make everyday moments meaningful.";

  if (
    insights?.personality_type &&
    partnerInsights?.personality_type &&
    insights.personality_type === partnerInsights.personality_type
  ) {
    relationshipInsight = `You are both ${insights.personality_type.toLowerCase()}s, which may mean you naturally understand each other's need for space and comfortable one-on-one moments.`;
  }

  if (
    insights?.conflict_style &&
    partnerInsights?.conflict_style &&
    insights.conflict_style === partnerInsights.conflict_style
  ) {
    relationshipInsight = `You both prefer to ${insights.conflict_style.toLowerCase()} during conflict. Giving each other that same kind of support can make difficult conversations easier.`;
  }

  if (sharedLoveLanguages.length > 0 && sharedLoveLanguages.length <= 2) {
    relationshipInsight = `You both value ${sharedLoveLanguages.join(
      " and ",
    )}. Paying attention to this shared love language can make small everyday gestures feel more meaningful.`;
  }

  if (sharedLoveLanguages.length > 2) {
    relationshipInsight = `You share several love languages, including ${sharedLoveLanguages
      .slice(0, 3)
      .join(
        ", ",
      )}. You already have several natural ways of showing care to each other.`;
  }

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

              <Text style={styles.pageTitle}>Insights</Text>
            </View>

            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>◌</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* HERO */}

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroHeart}>♡</Text>
            </View>

            <Text style={styles.heroTitle}>
              Understanding what makes you two work.
            </Text>

            <Text style={styles.heroText}>
              Between Us compares the things you both shared to help you
              understand each other better.
            </Text>
          </View>

          {/* RELATIONSHIP */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR RELATIONSHIP</Text>

            <View style={styles.connectionCard}>
              <View style={styles.connectionAvatar}>
                <Text style={styles.connectionAvatarText}>
                  {partnerName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.connectionInfo}>
                <Text style={styles.connectionLabel}>CONNECTED WITH</Text>

                <Text style={styles.connectionName}>{partnerName}</Text>

                <Text style={styles.connectionType}>{relationshipType}</Text>
              </View>
            </View>
          </View>

          {!connection ? (
            <View style={styles.noConnectionCard}>
              <Text style={styles.noConnectionTitle}>Connect with someone</Text>

              <Text style={styles.noConnectionText}>
                Once you connect with your partner, you'll be able to see shared
                insights and discover what makes your relationship unique.
              </Text>
            </View>
          ) : null}

          {/* YOUR INSIGHTS */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR INSIGHTS</Text>

            <View style={styles.aboutGrid}>
              <View style={styles.smallCard}>
                <Text style={styles.cardEyebrow}>PERSONALITY</Text>

                <Text style={styles.smallCardValue}>
                  {insights?.personality_type || "Not set"}
                </Text>
              </View>

              <View style={styles.smallCard}>
                <Text style={styles.cardEyebrow}>CONFLICT STYLE</Text>

                <Text style={styles.smallCardValue}>
                  {insights?.conflict_style || "Not set"}
                </Text>
              </View>
            </View>
          </View>

          {/* PARTNER */}

          {connection ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                ABOUT {partnerName.toUpperCase()}
              </Text>

              <View style={styles.aboutGrid}>
                <View style={styles.smallCard}>
                  <Text style={styles.cardEyebrow}>PERSONALITY</Text>

                  <Text style={styles.smallCardValue}>
                    {partnerInsights?.personality_type || "Not set"}
                  </Text>
                </View>

                <View style={styles.smallCard}>
                  <Text style={styles.cardEyebrow}>CONFLICT STYLE</Text>

                  <Text style={styles.smallCardValue}>
                    {partnerInsights?.conflict_style || "Not set"}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* SHARED */}

          {connection ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHAT YOU HAVE IN COMMON</Text>

              <View style={styles.sharedCard}>
                {sharedLoveLanguages.length > 0 ? (
                  <InsightRow
                    title="Shared love language"
                    value={sharedLoveLanguages.join(", ")}
                  />
                ) : null}

                {sharedGoals.length > 0 ? (
                  <InsightRow
                    title="Shared goal"
                    value={sharedGoals.join(", ")}
                  />
                ) : null}

                {sharedInterests.length > 0
                  ? sharedInterests.map((interest, index) => (
                      <InsightRow
                        key={`${interest}-${index}`}
                        title="Shared interest"
                        value={interest}
                      />
                    ))
                  : null}

                {sharedLoveLanguages.length === 0 &&
                sharedGoals.length === 0 &&
                sharedInterests.length === 0 ? (
                  <Text style={styles.emptyText}>
                    You are still discovering what you have in common.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* DIFFERENCES */}

          {connection ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHERE YOU DIFFER</Text>

              <View style={styles.sharedCard}>
                {differences.length > 0 ? (
                  differences.map((difference, index) => (
                    <View
                      key={`${difference}-${index}`}
                      style={[
                        styles.differenceRow,
                        index < differences.length - 1 && styles.rowDivider,
                      ]}
                    >
                      <View style={styles.dot} />

                      <Text style={styles.differenceText}>{difference}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    You have many similarities so far. Keep answering questions
                    to discover more about each other.
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {/* LOVE LANGUAGES */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR LOVE LANGUAGES</Text>

            <View style={styles.loveCard}>
              {loveLanguages.length > 0 ? (
                loveLanguages.map((language, index) => (
                  <View
                    style={[
                      styles.languageRow,
                      index < loveLanguages.length - 1 && styles.rowDivider,
                    ]}
                    key={`${language}-${index}`}
                  >
                    <View style={styles.languageNumber}>
                      <Text style={styles.languageNumberText}>{index + 1}</Text>
                    </View>

                    <Text style={styles.languageText}>{language}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  Your love languages have not been added yet.
                </Text>
              )}
            </View>
          </View>

          {/* PARTNER LOVE LANGUAGE */}

          {connection ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {partnerName.toUpperCase()}'S LOVE LANGUAGES
              </Text>

              <View style={styles.loveCard}>
                {partnerLoveLanguages.length > 0 ? (
                  partnerLoveLanguages.map((language, index) => (
                    <View
                      style={[
                        styles.languageRow,
                        index < partnerLoveLanguages.length - 1 &&
                          styles.rowDivider,
                      ]}
                      key={`${language}-${index}`}
                    >
                      <View style={styles.languageNumber}>
                        <Text style={styles.languageNumberText}>
                          {index + 1}
                        </Text>
                      </View>

                      <Text style={styles.languageText}>{language}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    Your partner has not added any love languages yet.
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {/* PERSONALIZED INSIGHT */}

          {connection ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>A LITTLE INSIGHT</Text>

              <View style={styles.insightCard}>
                <View style={styles.insightIcon}>
                  <Text style={styles.insightIconText}>♡</Text>
                </View>

                <Text style={styles.cardTitle}>What this tells us</Text>

                <Text style={styles.cardDescription}>
                  {relationshipInsight}
                </Text>
              </View>
            </View>
          ) : null}

          {/* SHARED GOALS */}

          {connection && sharedGoals.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>THINGS TO DO TOGETHER</Text>

              <View style={styles.goalsCard}>
                {sharedGoals.map((goal, index) => (
                  <View
                    style={[
                      styles.goalRow,
                      index < sharedGoals.length - 1 && styles.rowDivider,
                    ]}
                    key={`${goal}-${index}`}
                  >
                    <View style={styles.goalIcon}>
                      <Text style={styles.goalIconText}>+</Text>
                    </View>

                    <Text style={styles.goalText}>{goal}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* FAVORITES */}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR FAVORITES</Text>

            <View style={styles.favoritesCard}>
              <FavoriteRow label="Food" value={preferences?.favorite_food} />

              <View style={styles.divider} />

              <FavoriteRow label="Snack" value={preferences?.favorite_snack} />

              <View style={styles.divider} />

              <FavoriteRow label="Drink" value={preferences?.favorite_drink} />

              <View style={styles.divider} />

              <FavoriteRow label="Color" value={preferences?.favorite_color} />

              <View style={styles.divider} />

              <FavoriteRow label="Music" value={preferences?.music_genre} />

              <View style={styles.divider} />

              <FavoriteRow label="Movies" value={preferences?.movie_genre} />
            </View>
          </View>

          {/* PARTNER FAVORITES */}

          {connection ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {partnerName.toUpperCase()}'S FAVORITES
              </Text>

              <View style={styles.favoritesCard}>
                <FavoriteRow
                  label="Food"
                  value={partnerPreferences?.favorite_food}
                />

                <View style={styles.divider} />

                <FavoriteRow
                  label="Snack"
                  value={partnerPreferences?.favorite_snack}
                />

                <View style={styles.divider} />

                <FavoriteRow
                  label="Drink"
                  value={partnerPreferences?.favorite_drink}
                />

                <View style={styles.divider} />

                <FavoriteRow
                  label="Color"
                  value={partnerPreferences?.favorite_color}
                />

                <View style={styles.divider} />

                <FavoriteRow
                  label="Music"
                  value={partnerPreferences?.music_genre}
                />

                <View style={styles.divider} />

                <FavoriteRow
                  label="Movies"
                  value={partnerPreferences?.movie_genre}
                />
              </View>
            </View>
          ) : null}

          {/* FOOTER */}

          <View style={styles.footer}>
            <Text style={styles.footerHeart}>♡</Text>

            <Text style={styles.footerTitle}>BETWEEN US</Text>

            <Text style={styles.footerText}>
              Understanding each other is part of loving each other.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * SMALL COMPONENTS
 * ==========================================
 */

function FavoriteRow({ label, value }) {
  return (
    <View style={styles.favoriteRow}>
      <Text style={styles.favoriteLabel}>{label}</Text>

      <Text style={styles.favoriteValue}>{value || "Not set"}</Text>
    </View>
  );
}

function InsightRow({ title, value }) {
  return (
    <View style={styles.insightRow}>
      <View style={styles.insightBullet}>
        <Text style={styles.insightBulletText}>✓</Text>
      </View>

      <View style={styles.insightRowContent}>
        <Text style={styles.insightRowTitle}>{title}</Text>

        <Text style={styles.insightRowValue}>{value}</Text>
      </View>
    </View>
  );
}

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

  headerIconText: {
    fontSize: 25,
    color: "#6B4E45",
  },

  heroCard: {
    backgroundColor: "#6B4E45",
    borderRadius: 22,
    padding: 20,
  },

  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  heroHeart: {
    fontSize: 27,
    color: "#6B4E45",
  },

  heroTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  heroText: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: "#DCCBC4",
  },

  section: {
    marginTop: 28,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#9A918A",
    marginBottom: 9,
  },

  connectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  connectionAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E9DED8",
    alignItems: "center",
    justifyContent: "center",
  },

  connectionAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6B4E45",
  },

  connectionInfo: {
    flex: 1,
    marginLeft: 13,
  },

  connectionLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#9A918A",
  },

  connectionName: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: "700",
    color: "#302825",
  },

  connectionType: {
    marginTop: 2,
    fontSize: 11,
    color: "#817771",
  },

  noConnectionCard: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  noConnectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#302825",
  },

  noConnectionText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    color: "#817771",
  },

  aboutGrid: {
    flexDirection: "row",
    gap: 10,
  },

  smallCard: {
    flex: 1,
    minHeight: 105,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  smallCardValue: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#302825",
  },

  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EAE3DE",
    marginBottom: 10,
  },

  insightIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  insightIconText: {
    fontSize: 20,
    color: "#6B4E45",
  },

  cardEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#9A918A",
  },

  cardTitle: {
    marginTop: 7,
    fontSize: 18,
    fontWeight: "700",
    color: "#302825",
  },

  cardDescription: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    color: "#817771",
  },

  sharedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  insightRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
  },

  insightBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  insightBulletText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B4E45",
  },

  insightRowContent: {
    flex: 1,
    marginLeft: 12,
  },

  insightRowTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#9A918A",
  },

  insightRowValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: "#302825",
  },

  differenceRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEE8E3",
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6B4E45",
  },

  differenceText: {
    flex: 1,
    marginLeft: 13,
    fontSize: 13,
    lineHeight: 19,
    color: "#302825",
  },

  loveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  languageRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
  },

  languageNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  languageNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B4E45",
  },

  languageText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#302825",
  },

  goalsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  goalRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },

  goalIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1E9E5",
    alignItems: "center",
    justifyContent: "center",
  },

  goalIconText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#6B4E45",
  },

  goalText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#302825",
  },

  favoritesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: "#EAE3DE",
  },

  favoriteRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  favoriteLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9A918A",
  },

  favoriteValue: {
    flex: 1,
    marginLeft: 15,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#302825",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEE8E3",
  },

  emptyText: {
    paddingVertical: 20,
    fontSize: 12,
    lineHeight: 18,
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

  footerTitle: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#6B4E45",
  },

  footerText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 15,
    color: "#9A918A",
  },

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
