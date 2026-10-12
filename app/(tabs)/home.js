import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { TOTAL_QUESTIONS, countAnswered } from "../../lib/profileProgress";
import { T } from "../../lib/theme";
import {
  Avatar,
  Button,
  Card,
  Cell,
  DateBlock,
  Empty,
  GlassButton,
  Group,
  Icon,
  LargeTitle,
  LoveButton,
  NavBar,
  Press,
  Screen,
  SectionHeader,
  Sheet,
} from "../../components/ui";
import BondHero from "../../components/BondHero";
import { SkeletonList } from "../../components/Skeleton";

/*
 * ==========================================
 * HOME
 * ==========================================
 *
 * Laid out exactly as the prototype lays it out:
 *
 *   date line + bell
 *   the bond (day count, both of you, the thread)
 *   tonight's question, theirs blurred until you reply
 *   the mood check-in
 *   four quick actions
 *   Coming up
 *   From {partner}
 */

const MOODS = [
  {
    key: "glowing",
    emoji: "🥰",
    line: "Glowing. {name} will see it on your avatar.",
  },
  { key: "happy", emoji: "😊", line: "Happy. Want to tell {name} why?" },
  { key: "okay", emoji: "🙂", line: "Okay. Steady days count too." },
  {
    key: "distant",
    emoji: "😶",
    line: "A bit distant. Tonight's question might help.",
  },
  {
    key: "hurt",
    emoji: "🥺",
    line: "Hurting. Start a gentle check-in with {name}?",
  },
];

const ACTIONS = [
  { icon: "mail", label: "Note", route: "/appreciations" },
  { icon: "calendar", label: "Date", route: "/dates" },
  { icon: "camera", label: "Memory", route: "/(tabs)/memories" },
  { icon: "flag", label: "Goals", route: "/goals" },
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

  /* Needs backend: the mood never leaves this phone yet. */
  const [mood, setMood] = useState(null);
  const [moodSheet, setMoodSheet] = useState(false);
  const [loved, setLoved] = useState({});

  const loadHome = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
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
      setActivity(notifications.slice(0, 2));

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

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadHome();
      }}
      tintColor={T.accent}
    />
  );

  if (loading) {
    return (
      <Screen scroll={false}>
        <NavBar left={<Text style={styles.dateline}>{dateLine()}</Text>} />

        <View style={styles.loading}>
          <SkeletonList count={4} />
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

  const finishProfile = profileDone ? null : (
    <Group inset={58}>
      <Cell
        leading={
          <View style={styles.cellIcon}>
            <Icon name="sparkle" size={16} color={T.accentText} />
          </View>
        }
        title="Finish your profile"
        subtitle={`${TOTAL_QUESTIONS - answeredCount} left. They power trivia and insights.`}
        chevron
        onPress={() => router.push("/onboarding")}
      />
    </Group>
  );

  /*
   * ==========================================
   * NOT CONNECTED
   * ==========================================
   */

  if (!connection) {
    return (
      <Screen refreshControl={refresh}>
        <NavBar left={<Text style={styles.dateline}>{dateLine()}</Text>}>
          <GlassButton
            icon="bell"
            badge={hasUnread}
            label="Notifications"
            onPress={() => router.push("/notifications")}
          />
        </NavBar>

        <LargeTitle>Between Us</LargeTitle>

        <Empty
          icon="heartOutline"
          title="This is better with two"
          text="Find the person you want to share it with. Nothing is shared until you both agree."
          action={{
            title: "Find Your Person",
            icon: "search",
            onPress: () => router.push("/find-person"),
          }}
        />

        {finishProfile}
      </Screen>
    );
  }

  /*
   * ==========================================
   * CONNECTED
   * ==========================================
   */

  const tonight = Array.isArray(daily?.questions) ? daily.questions : [];

  const answeredTonight = tonight.filter((item) => item.your_answer).length;
  const totalTonight = tonight.length || 3;

  /* The one they would answer next. */
  const nextQuestion =
    tonight.find((item) => !item.your_answer) || tonight[0] || null;

  const youAnswered = answeredTonight >= totalTonight;

  const partnerAnswered = tonight.some((item) => item.partner_answered);
  const hoursLeft = Math.max(1, 24 - new Date().getHours());

  const moodLine = mood
    ? MOODS.find((item) => item.key === mood)?.line.replace(
        "{name}",
        partnerName,
      )
    : `Your pick shows on your avatar above. Only ${partnerName} sees it.`;

  const comingUp = [
    ...plans
      .filter((plan) => plan.status === "planned")
      .map((plan) => ({
        key: `plan-${plan.id}`,
        title: plan.title,
        subtitle: plan.mine
          ? "Date night · You planned it"
          : `Date night · ${plan.planner_name} planned it`,
        date: plan.plan_date,
        tone: "them",
      })),
    ...reminders.slice(0, 2).map((reminder, index) => ({
      key: `reminder-${index}`,
      title: reminder.title,
      subtitle: reminder.message,
      tone: "you",
    })),
  ].slice(0, 3);

  return (
    <Screen refreshControl={refresh}>
      <NavBar left={<Text style={styles.dateline}>{dateLine()}</Text>}>
        <GlassButton
          icon="bell"
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
        onPickMood={() => setMoodSheet(true)}
      />

      {/* TONIGHT'S QUESTION */}

      {/* Not tappable as a whole: the button inside is the
          action. With both, one tap opened the sheet twice. */}
      <Card>
        <View style={styles.qTop}>
          <Icon name="sparkle" size={18} color={T.accent} filled />

          <Text style={styles.qLabel}>
            {answeredTonight > 0 && answeredTonight < totalTonight
              ? `${totalTonight - answeredTonight} question${totalTonight - answeredTonight === 1 ? "" : "s"} left`
              : "Tonight's questions"}
          </Text>

          <Text style={styles.qTime}>{hoursLeft}h left</Text>
        </View>

        <Text style={styles.question}>
          {nextQuestion?.question ||
            daily?.question ||
            "Loading tonight's questions…"}
        </Text>

        <View style={styles.lock}>
          <Avatar name={partnerName} who="them" size={30} />

          {youAnswered ? (
            <Text style={styles.lockText} numberOfLines={1}>
              {partnerAnswered
                ? tonight.find((item) => item.partner_answer)?.partner_answer
                : `${partnerName} hasn't answered yet`}
            </Text>
          ) : (
            <>
              <Text style={styles.lockBlur} numberOfLines={1}>
                {partnerAnswered
                  ? "▇▇▇▇ ▇▇▇▇▇▇ ▇▇▇ ▇▇▇▇▇▇▇"
                  : `${partnerName} hasn't answered yet`}
              </Text>

              {partnerAnswered ? (
                <Icon name="lock" size={18} color={T.label2} />
              ) : null}
            </>
          )}
        </View>

        <Button
          title={
            youAnswered
              ? partnerAnswered
                ? `See ${partnerName}'s answers`
                : "See your answers"
              : answeredTonight > 0
                ? "Carry on answering"
                : `Answer to unlock ${partnerName}'s`
          }
          onPress={() => router.push("/daily-question")}
          block={false}
          style={styles.qButton}
        />
      </Card>

      {/* MOOD */}

      <Card>
        <Text style={styles.moodTitle}>How are you feeling about us?</Text>

        <View style={styles.moodRow}>
          {MOODS.map((item) => (
            <Press
              key={item.key}
              scaleTo={0.9}
              onPress={() => setMood(mood === item.key ? null : item.key)}
            >
              <View style={[styles.mood, mood === item.key && styles.moodOn]}>
                <Text style={styles.moodFace}>{item.emoji}</Text>
              </View>
            </Press>
          ))}
        </View>

        <Text style={styles.moodLine}>{moodLine}</Text>
      </Card>

      {/* QUICK ACTIONS */}

      <View style={styles.actions}>
        {ACTIONS.map((action) => (
          <Press
            key={action.label}
            onPress={() => router.push(action.route)}
            outerStyle={styles.actionWrap}
          >
            <View style={styles.action}>
              <Icon name={action.icon} size={24} color={T.accent} filled />

              <Text style={styles.actionLabel}>{action.label}</Text>
            </View>
          </Press>
        ))}
      </View>

      {finishProfile}

      {/* WHEN IT'S GONE WRONG */}

      <Group inset={58}>
        <Cell
          leading={
            <View style={styles.repairIcon}>
              <Icon name="pulse" size={16} color={T.accentText} />
            </View>
          }
          title="Something's off between us"
          subtitle="Take a pause, then say it properly"
          chevron
          onPress={() => router.push("/repair")}
        />
      </Group>

      {/* COMING UP */}

      <SectionHeader action="See all" onAction={() => router.push("/dates")}>
        Coming up
      </SectionHeader>

      {comingUp.length > 0 ? (
        <Group inset={68}>
          {comingUp.map((item) => (
            <Cell
              key={item.key}
              leading={
                item.date ? (
                  <DateBlock date={item.date} tone={item.tone} />
                ) : (
                  <View style={styles.cal}>
                    <Icon name="calendar" size={20} color={T.accent} />
                  </View>
                )
              }
              title={item.title}
              subtitle={item.subtitle}
              chevron
              onPress={() => router.push("/dates")}
            />
          ))}
        </Group>
      ) : (
        <Empty
          icon="calendar"
          title="Nothing in the diary"
          text={`Plan something with ${partnerName}, however small.`}
          action={{
            title: "Plan a Date",
            icon: "add",
            onPress: () => router.push("/dates"),
          }}
        />
      )}

      {/* HOW YOU'RE FEELING */}

      <Sheet
        visible={moodSheet}
        title="How are you?"
        onCancel={() => setMoodSheet(false)}
        onSave={() => setMoodSheet(false)}
        saveLabel="Done"
        subtitle={`It shows on your avatar. Only ${partnerName} sees it.`}
      >
        <Group inset={16}>
          {MOODS.map((item) => (
            <Cell
              key={item.key}
              leading={<Text style={styles.sheetFace}>{item.emoji}</Text>}
              title={item.line.replace("{name}", partnerName).split(".")[0]}
              trailing={
                mood === item.key ? (
                  <Icon name="check" size={18} color={T.accent} />
                ) : null
              }
              onPress={() => {
                setMood(item.key);
                setMoodSheet(false);
              }}
            />
          ))}
        </Group>

        {mood ? (
          <Button
            title="Clear it"
            kind="plain"
            onPress={() => {
              setMood(null);
              setMoodSheet(false);
            }}
          />
        ) : null}
      </Sheet>

      {/* FROM THEM */}

      {activity.length > 0 ? (
        <>
          <SectionHeader>From {partnerName}</SectionHeader>

          <Group inset={64}>
            {activity.map((item) => (
              <Cell
                key={item.id}
                leading={<Avatar name={partnerName} who="them" size={40} />}
                title={item.title}
                subtitle={item.message}
                trailing={
                  <LoveButton
                    value={Boolean(loved[item.id])}
                    onChange={(value) =>
                      setLoved((current) => ({ ...current, [item.id]: value }))
                    }
                  />
                }
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
    paddingTop: 20,
  },

  dateline: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.13,
    color: T.label2,
  },

  qTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  qLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: T.accent,
  },

  qTime: {
    marginLeft: "auto",
    fontSize: 13,
    color: T.label2,
  },

  question: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.52,
    color: T.label,
    marginTop: 12,
  },

  lock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: T.fill4,
  },

  lockBlur: {
    flex: 1,
    fontSize: 15,
    color: T.label3,
    letterSpacing: 1,
  },

  lockText: {
    flex: 1,
    fontSize: 15,
    color: T.label2,
  },

  qButton: {
    marginTop: 12,
  },

  moodTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.34,
    color: T.label,
  },

  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  mood: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  moodOn: {
    backgroundColor: T.accentTint,
    borderWidth: 2,
    borderColor: T.accent,
  },

  moodFace: {
    fontSize: 25,
  },

  moodLine: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    marginTop: 12,
  },

  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },

  actionWrap: {
    flex: 1,
  },

  action: {
    backgroundColor: T.surface,
    borderRadius: 14,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
    gap: 3,
  },

  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: T.accent,
  },

  repairIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  cellIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  cal: {
    width: 40,
    alignItems: "center",
  },

  sheetFace: {
    fontSize: 26,
  },
});
