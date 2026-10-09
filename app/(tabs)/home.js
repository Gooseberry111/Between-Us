import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { TOTAL_QUESTIONS, countAnswered } from "../../lib/profileProgress";
import { T, TYPE } from "../../lib/theme";
import {
  Avatar,
  Button,
  Card,
  Cell,
  Empty,
  GlassButton,
  Group,
  LargeTitle,
  NavBar,
  Press,
  Screen,
  SectionHeader,
} from "../../components/ui";
import BondHero from "../../components/BondHero";
import { Skeleton, SkeletonList } from "../../components/Skeleton";

/*
 * ==========================================
 * HOME
 * ==========================================
 *
 * Leads with the two of them, then tonight's
 * question, then everything else. No greeting: the
 * date line and the bond say it better.
 */

const MOODS = [
  {
    emoji: "🥰",
    key: "glowing",
    line: "Glowing. {name} will see it on your avatar.",
  },
  { emoji: "😊", key: "happy", line: "Happy. Want to tell {name} why?" },
  { emoji: "🙂", key: "okay", line: "Okay. Steady days count too." },
  {
    emoji: "😶",
    key: "distant",
    line: "A bit distant. Tonight's question might help.",
  },
  {
    emoji: "🥺",
    key: "hurt",
    line: "Hurting. Start a gentle check-in with {name}?",
  },
];

function dateLine() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `home:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [profile, setProfile] = useState(cached?.profile ?? null);
  const [partner, setPartner] = useState(cached?.partner ?? null);
  const [connection, setConnection] = useState(cached?.connection ?? null);
  const [daily, setDaily] = useState(cached?.daily ?? null);
  const [reminders, setReminders] = useState(cached?.reminders ?? []);
  const [plans, setPlans] = useState(cached?.plans ?? []);
  const [activity, setActivity] = useState(cached?.activity ?? []);
  const [answeredCount, setAnsweredCount] = useState(
    cached?.answeredCount ?? null,
  );
  const [hasUnread, setHasUnread] = useState(cached?.hasUnread ?? false);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* Needs backend: the mood is only on this phone until
   * there is somewhere to send it. */
  const [mood, setMood] = useState(null);

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
        remindersData,
        notificationsData,
        onboardingData,
      ] = await Promise.all([
        apiFetch(`/users/${userId}/profile`),
        apiFetch(`/users/${userId}/connections`),
        apiFetch(`/users/${userId}/reminders`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        apiFetch(`/users/${userId}/notifications`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        apiFetch(`/users/${userId}/onboarding`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const profileData = await profileResponse.json();
      const connectionData = await connectionResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profileData?.error || "Unable to load your profile.");
      }

      setProfile(profileData?.profile || null);

      if (onboardingData?.exists) {
        setAnsweredCount(countAnswered(onboardingData.answers));
      }

      setReminders(
        Array.isArray(remindersData?.reminders) ? remindersData.reminders : [],
      );

      const notifications = Array.isArray(notificationsData?.notifications)
        ? notificationsData.notifications
        : [];

      setHasUnread(notifications.some((item) => item.is_read === false));

      /* Needs backend: a proper partner activity feed. Until
       * then, their notifications about us are the closest
       * honest thing we have. */
      setActivity(notifications.slice(0, 3));

      const connections = Array.isArray(connectionData) ? connectionData : [];

      const accepted = connections.find(
        (item) => item.status?.toLowerCase() === "accepted",
      );

      setConnection(accepted || null);

      if (accepted) {
        const [partnerData, dailyData, plansData] = await Promise.all([
          apiFetch(`/users/${userId}/partner`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          apiFetch(`/users/${userId}/daily-question`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          apiFetch(`/users/${userId}/date-plans`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        setPartner(partnerData?.partner || null);
        setDaily(dailyData);
        setPlans(Array.isArray(plansData?.plans) ? plansData.plans : []);
      } else {
        setPartner(null);
        setDaily(null);
        setPlans([]);
      }
    } catch (err) {
      console.log("HOME LOAD ERROR:", err);
      setError(err?.message || "Unable to load your home.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId]);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome]),
  );

  useEffect(() => {
    if (loading || !cacheKey) return;

    setCachedData(cacheKey, {
      profile,
      partner,
      connection,
      daily,
      reminders,
      plans,
      activity,
      answeredCount,
      hasUnread,
    });
  }, [
    loading,
    cacheKey,
    profile,
    partner,
    connection,
    daily,
    reminders,
    plans,
    activity,
    answeredCount,
    hasUnread,
  ]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.loading}>
          <Skeleton width={120} height={14} radius={7} />

          <Skeleton
            width={180}
            height={62}
            radius={16}
            style={{ marginTop: 18 }}
          />

          <View style={{ marginTop: 28, width: "100%" }}>
            <SkeletonList count={3} />
          </View>
        </View>
      </Screen>
    );
  }

  const youName =
    profile?.nickname?.trim() || profile?.first_name?.trim() || "You";

  const partnerName =
    partner?.nickname?.trim() ||
    partner?.first_name?.trim() ||
    connection?.other_first_name?.trim() ||
    "Your person";

  const days = connection?.connected_at
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(connection.connected_at).getTime()) / 86400000,
        ) + 1,
      )
    : null;

  const profileDone =
    answeredCount === null || answeredCount >= TOTAL_QUESTIONS;

  /*
   * ==========================================
   * NOT CONNECTED
   * ==========================================
   */

  if (!connection) {
    return (
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHome();
            }}
            tintColor={T.accent}
          />
        }
      >
        <NavBar left={<Text style={styles.dateline}>{dateLine()}</Text>}>
          <GlassButton
            icon="notifications-outline"
            badge={hasUnread}
            label="Notifications"
            onPress={() => router.push("/notifications")}
          />
        </NavBar>

        <LargeTitle>Between Us</LargeTitle>

        <Empty
          icon="heart-outline"
          title="This is better with two"
          text="Find the person you want to share it with. Nothing is shared until you both agree."
          action={{
            title: "Find Your Person",
            icon: "search",
            onPress: () => router.push("/find-person"),
          }}
        />

        {!profileDone ? (
          <>
            <SectionHeader>Your profile</SectionHeader>

            <Group>
              <Cell
                title="Finish your profile"
                subtitle={`${TOTAL_QUESTIONS - answeredCount} questions left. They power trivia and insights.`}
                leading={
                  <View style={styles.cellIcon}>
                    <Ionicons name="sparkles" size={16} color={T.accentText} />
                  </View>
                }
                chevron
                onPress={() => router.push("/onboarding")}
              />
            </Group>
          </>
        ) : null}
      </Screen>
    );
  }

  /*
   * ==========================================
   * CONNECTED
   * ==========================================
   */

  const youAnswered = Boolean(daily?.your_answer);
  const partnerAnswered = Boolean(daily?.partner_answered);

  const upcoming = [
    ...plans
      .filter((plan) => plan.status === "planned")
      .map((plan) => ({
        key: `plan-${plan.id}`,
        title: plan.title,
        subtitle: plan.plan_date
          ? `${plan.mine ? "You planned it" : `${plan.planner_name} planned it`}`
          : "No date set yet",
        date: plan.plan_date,
        onPress: () => router.push("/(tabs)/dates"),
      })),
    ...reminders.slice(0, 2).map((reminder, index) => ({
      key: `reminder-${index}`,
      title: reminder.title,
      subtitle: reminder.message,
      onPress: () => router.push("/special-dates"),
    })),
  ].slice(0, 3);

  const moodLine = mood
    ? MOODS.find((item) => item.key === mood)?.line.replace(
        "{name}",
        partnerName,
      )
    : `Your pick shows on your avatar. Only ${partnerName} sees it.`;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadHome();
          }}
          tintColor={T.accent}
        />
      }
    >
      <NavBar left={<Text style={styles.dateline}>{dateLine()}</Text>}>
        <GlassButton
          icon="notifications-outline"
          badge={hasUnread}
          label="Notifications"
          onPress={() => router.push("/notifications")}
        />
      </NavBar>

      <BondHero
        youName={youName}
        partnerName={partnerName}
        days={days}
        youAnswered={youAnswered}
        partnerAnswered={partnerAnswered}
        streak={Number(daily?.streak || 0)}
        mood={MOODS.find((item) => item.key === mood)?.emoji}
        onHug={() => {}}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* TONIGHT'S QUESTION */}

      <Press onPress={() => router.push("/daily-question")}>
        <Card>
          <View style={styles.questionTop}>
            <Ionicons name="sparkles" size={14} color={T.accentText} />

            <Text style={styles.questionLabel}>Tonight&apos;s question</Text>
          </View>

          <Text style={styles.question}>
            {daily?.question || "Loading tonight's question…"}
          </Text>

          <View style={styles.lockRow}>
            <Avatar name={partnerName} who="them" size={26} />

            {youAnswered ? (
              <Text style={styles.answerText} numberOfLines={1}>
                {partnerAnswered
                  ? daily?.partner_answer
                  : `${partnerName} hasn't answered yet`}
              </Text>
            ) : (
              <>
                <View style={styles.blurred}>
                  <Text style={styles.blurredText} numberOfLines={1}>
                    {partnerAnswered
                      ? "••••• ••••• ••••••• ••••"
                      : `${partnerName} hasn't answered yet`}
                  </Text>
                </View>

                {partnerAnswered ? (
                  <Ionicons name="lock-closed" size={13} color={T.label3} />
                ) : null}
              </>
            )}
          </View>

          <Button
            title={
              youAnswered
                ? partnerAnswered
                  ? `See ${partnerName}'s answer`
                  : "See your answer"
                : `Answer to unlock ${partnerName}'s`
            }
            onPress={() => router.push("/daily-question")}
            style={styles.questionButton}
          />
        </Card>
      </Press>

      {/* MOOD */}

      <Card style={styles.moodCard}>
        <Text style={styles.moodTitle}>How are you feeling about us?</Text>

        <View style={styles.moodRow}>
          {MOODS.map((item) => (
            <Press
              key={item.key}
              scaleTo={0.9}
              onPress={() => setMood(mood === item.key ? null : item.key)}
            >
              <View
                style={[
                  styles.moodOption,
                  mood === item.key && styles.moodOptionOn,
                ]}
              >
                <Text style={styles.moodFace}>{item.emoji}</Text>
              </View>
            </Press>
          ))}
        </View>

        <Text style={styles.moodLine}>{moodLine}</Text>
      </Card>

      {/* QUICK ACTIONS */}

      <View style={styles.actions}>
        {[
          { icon: "mail-outline", label: "Note", route: "/appreciations" },
          { icon: "calendar-outline", label: "Date", route: "/(tabs)/dates" },
          { icon: "camera-outline", label: "Memory", route: "/memories" },
          { icon: "flag-outline", label: "Goals", route: "/goals" },
        ].map((action) => (
          <Press
            key={action.label}
            onPress={() => router.push(action.route)}
            outerStyle={styles.actionWrap}
          >
            <View style={styles.action}>
              <Ionicons name={action.icon} size={20} color={T.accent} />

              <Text style={styles.actionLabel}>{action.label}</Text>
            </View>
          </Press>
        ))}
      </View>

      {/* FINISH PROFILE */}

      {!profileDone ? (
        <>
          <SectionHeader>Your profile</SectionHeader>

          <Group>
            <Cell
              title="Finish your profile"
              subtitle={`${TOTAL_QUESTIONS - answeredCount} questions left. They power trivia and insights.`}
              leading={
                <View style={styles.cellIcon}>
                  <Ionicons name="sparkles" size={16} color={T.accentText} />
                </View>
              }
              chevron
              onPress={() => router.push("/onboarding")}
            />
          </Group>
        </>
      ) : null}

      {/* COMING UP */}

      <SectionHeader
        action="See all"
        onAction={() => router.push("/(tabs)/dates")}
      >
        Coming up
      </SectionHeader>

      {upcoming.length > 0 ? (
        <Group>
          {upcoming.map((item) => (
            <Cell
              key={item.key}
              title={item.title}
              subtitle={item.subtitle}
              leading={
                <View style={styles.cellIcon}>
                  <Ionicons name="calendar" size={15} color={T.accentText} />
                </View>
              }
              chevron
              onPress={item.onPress}
            />
          ))}
        </Group>
      ) : (
        <Empty
          icon="calendar-outline"
          title="Nothing in the diary"
          text={`Plan something with ${partnerName}, however small.`}
          action={{
            title: "Plan a Date",
            icon: "add",
            onPress: () => router.push("/(tabs)/dates"),
          }}
        />
      )}

      {/* FROM PARTNER */}

      {activity.length > 0 ? (
        <>
          <SectionHeader>From {partnerName}</SectionHeader>

          <Group>
            {activity.map((item) => (
              <Cell
                key={item.id}
                title={item.title}
                subtitle={item.message}
                leading={<Avatar name={partnerName} who="them" size={34} />}
              />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 20,
    paddingTop: 30,
    alignItems: "center",
  },

  dateline: {
    ...TYPE.footnote,
    fontWeight: "600",
    color: T.label2,
  },

  error: {
    ...TYPE.footnote,
    color: T.red,
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  questionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  questionLabel: {
    ...TYPE.footnote,
    fontWeight: "600",
    color: T.accentText,
  },

  question: {
    ...TYPE.title3,
    color: T.label,
    marginTop: 10,
    lineHeight: 26,
  },

  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
  },

  blurred: {
    flex: 1,
    backgroundColor: T.fill4,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  blurredText: {
    ...TYPE.footnote,
    color: T.label3,
    letterSpacing: 1,
  },

  answerText: {
    flex: 1,
    ...TYPE.footnote,
    fontSize: 14,
    color: T.label2,
  },

  questionButton: {
    marginTop: 16,
  },

  moodCard: {
    marginTop: 14,
  },

  moodTitle: {
    ...TYPE.headline,
    color: T.label,
  },

  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },

  moodOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  moodOptionOn: {
    backgroundColor: T.accentTint,
    borderWidth: 2,
    borderColor: T.accent,
  },

  moodFace: {
    fontSize: 24,
  },

  moodLine: {
    ...TYPE.footnote,
    color: T.label2,
    marginTop: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },

  actionWrap: {
    flex: 1,
  },

  action: {
    backgroundColor: T.surface,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 7,
  },

  actionLabel: {
    ...TYPE.caption,
    fontWeight: "600",
    color: T.label,
  },

  cellIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
