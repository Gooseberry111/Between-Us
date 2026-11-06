import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { TOTAL_QUESTIONS, countAnswered } from "../../lib/profileProgress";
import { T, themedStyles, useTheme } from "../../lib/theme";
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
  NavBar,
  Press,
  Screen,
  SectionHeader,
} from "../../components/ui";
import ActivityRow from "../../components/ActivityRow";
import BondHero from "../../components/BondHero";
import {
  Challenge,
  Distance,
  LetterWaiting,
  OnThisDay,
} from "../../components/HomeExtras";
import { useFeatures } from "../../lib/features";
import { openMenu } from "../../lib/menu";
import {
  activityHandlers,
  loadActivity,
  updateActivity,
} from "../../lib/activity";
import { playHug, playHugAnswer, playTap } from "../../lib/hugs";
import { openTour } from "../../lib/tour";
import { warmPlaces } from "../../lib/places";
import { tourSeen } from "../../components/Walkthrough";
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

/* Good days and hard ones. The keys match the API's. */
const MOODS = [
  {
    key: "glowing",
    emoji: "🥰",
    line: "Glowing. {name} will see it on your avatar.",
  },
  { key: "happy", emoji: "😊", line: "Happy. Want to tell {name} why?" },
  { key: "excited", emoji: "🤩", line: "Excited. Tell {name} what about." },
  { key: "okay", emoji: "🙂", line: "Okay. Steady days count too." },
  { key: "missing", emoji: "🥹", line: "Missing {name}. Send a note?" },
  {
    key: "tired",
    emoji: "😴",
    line: "Tired. Be gentle with yourself tonight.",
  },
  {
    key: "stressed",
    emoji: "😮‍💨",
    line: "Stressed. {name} will know to go easy.",
  },
  { key: "sad", emoji: "😢", line: "Sad. {name} can see you might need them." },
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
  {
    key: "angry",
    emoji: "😠",
    line: "Angry. Take a breath; Repair is there when you're ready.",
  },
];

/* A mood, in a word, for under each circle. */
const MOOD_WORDS = {
  glowing: "glowing",
  happy: "happy",
  excited: "excited",
  okay: "okay",
  missing: "lonely",
  tired: "tired",
  stressed: "stressed",
  sad: "sad",
  distant: "distant",
  hurt: "hurt",
  angry: "angry",
};

/* The moods, as the wheel on your circle shows them. */
const MOOD_WHEEL = MOODS.map((item) => ({
  key: item.key,
  emoji: item.emoji,
  label: MOOD_WORDS[item.key],
}));

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
  useTheme();

  const router = useRouter();
  const features = useFeatures();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `home:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [profile, setProfile] = useState(cached?.profile ?? null);
  const [partner, setPartner] = useState(cached?.partner ?? null);
  const [connection, setConnection] = useState(cached?.connection ?? null);
  const [daily, setDaily] = useState(cached?.daily ?? null);
  const [reminders, setReminders] = useState(cached?.reminders ?? []);
  const [plans, setPlans] = useState(cached?.plans ?? []);
  /* Rows from before activity had a kind were notifications. */
  const [activity, setActivity] = useState(
    (cached?.activity ?? []).filter((item) => item.kind),
  );
  const [answeredCount, setAnsweredCount] = useState(
    cached?.answeredCount ?? null,
  );
  const [hasUnread, setHasUnread] = useState(cached?.hasUnread ?? false);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  /* Yours and theirs, each for a day. Theirs sits on their
   * circle in the hero; yours goes in their feed. */
  const [mood, setMood] = useState(cached?.mood ?? null);
  const [partnerMood, setPartnerMood] = useState(cached?.partnerMood ?? null);
  /* A wheel is out on Home: the page holds still for the spin. */
  const [wheelOut, setWheelOut] = useState(false);

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
        activityData,
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
        loadActivity(userId, { limit: 3 }).catch(() => null),
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
      if (activityData) setActivity(activityData.items);

      const connections = Array.isArray(connectionData) ? connectionData : [];

      const accepted = connections.find(
        (item) => item.status?.toLowerCase() === "accepted",
      );

      setConnection(accepted || null);

      if (accepted) {
        const [partnerData, dailyData, plansData, moodData] = await Promise.all(
          [
            apiFetch(`/users/${userId}/partner`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
            apiFetch(`/users/${userId}/daily-question`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
            apiFetch(`/users/${userId}/date-plans`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
            apiFetch(`/users/${userId}/mood`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          ],
        );

        if (moodData) {
          setMood(moodData.mine?.mood || null);
          setPartnerMood(moodData.partner || null);
        }

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
      mood,
      partnerMood,
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
    mood,
    partnerMood,
  ]);

  const partnerName =
    partner?.nickname?.trim() ||
    partner?.first_name?.trim() ||
    connection?.other_first_name?.trim() ||
    "Your person";

  /* Freshly linked: the tour, once. */
  const tourAsked = useRef(false);

  useEffect(() => {
    if (tourAsked.current || !userId || !partner) return undefined;

    tourAsked.current = true;

    if (tourSeen(userId)) return undefined;

    const timer = setTimeout(openTour, 900);

    return () => clearTimeout(timer);
  }, [userId, partner]);

  /* Date spots near you, fetched quietly so Dates opens ready.
   * Only if location is already allowed; it never asks here. */
  useEffect(() => {
    if (!userId || !partner) return undefined;

    const timer = setTimeout(() => warmPlaces(userId), 3000);

    return () => clearTimeout(timer);
  }, [userId, partner]);

  /* A hug they sent while you were away plays when you
   * arrive, once, and is then marked seen. */
  const playedHugs = useRef(new Set());

  useEffect(() => {
    const fresh = activity.filter(
      (item) =>
        ["hug", "tap", "hug_declined", "hug_accepted"].includes(item.kind) &&
        !item.read &&
        !playedHugs.current.has(item.id),
    );

    if (fresh.length === 0) return;

    fresh.forEach((item) => {
      playedHugs.current.add(item.id);
      updateActivity(userId, item.id, { read: true }).catch(() => {});
    });

    /* A hug outranks an answer to yours, which outranks a
     * tap; the newest of each plays. */
    const hug = fresh.find((item) => item.kind === "hug");
    const answer = fresh.find((item) => item.kind.startsWith("hug_"));

    if (hug) playHug({ from: partnerName });
    else if (answer) {
      playHugAnswer({
        kind: answer.kind === "hug_declined" ? "declined" : "accepted",
        from: partnerName,
      });
    } else playTap({ kind: fresh[0].detail, from: partnerName });

    setActivity((current) =>
      current.map((item) =>
        fresh.some((hug) => hug.id === item.id)
          ? { ...item, read: true }
          : item,
      ),
    );
  }, [activity, partnerName, userId]);

  const feed = activityHandlers({
    userId,
    setItems: setActivity,
    router,
    partnerName,
  });

  /* A kiss, "miss you"... from the burst around their circle. */
  const sendTap = (kind) => {
    apiFetch(`/users/${userId}/tap`, {
      method: "POST",
      body: JSON.stringify({ clerk_id: userId, kind }),
    }).catch(() => {});
  };

  /* Holding the heart sends a real hug. */
  const sendHug = () => {
    apiFetch(`/users/${userId}/hug`, {
      method: "POST",
      body: JSON.stringify({ clerk_id: userId }),
    }).catch(() => {});
  };

  /* Shown at once, saved behind it, taken back if it fails. */
  const chooseMood = (next) => {
    const before = mood;

    setMood(next);

    apiFetch(`/users/${userId}/mood`, {
      method: "PUT",
      body: JSON.stringify({ clerk_id: userId, mood: next }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Mood not saved");
      })
      .catch(() => setMood(before));
  };

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
        <NavBar
          left={<GlassButton icon="menu" label="Menu" onPress={openMenu} />}
          centre={<Text style={styles.dateline}>{dateLine()}</Text>}
        />

        <View style={styles.loading}>
          <SkeletonList count={4} />
        </View>
      </Screen>
    );
  }

  const youName =
    profile?.nickname?.trim() || profile?.first_name?.trim() || "You";

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
        <NavBar
          left={<GlassButton icon="menu" label="Menu" onPress={openMenu} />}
          centre={<Text style={styles.dateline}>{dateLine()}</Text>}
        >
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
    <Screen
      refreshControl={wheelOut ? undefined : refresh}
      scrollEnabled={!wheelOut}
    >
      <NavBar
        left={<GlassButton icon="menu" label="Menu" onPress={openMenu} />}
        centre={<Text style={styles.dateline}>{dateLine()}</Text>}
      >
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
        moodLabel={MOOD_WORDS[mood]}
        partnerMood={partnerMood?.emoji}
        partnerMoodLabel={MOOD_WORDS[partnerMood?.key || partnerMood?.mood]}
        onHug={sendHug}
        onSendTap={features.enabled("taps") ? sendTap : undefined}
        moods={MOOD_WHEEL}
        moodKey={mood}
        onChooseMood={(key) => chooseMood(mood === key ? null : key)}
        onWheel={setWheelOut}
      />

      {/* A LETTER WAITING */}

      {features.enabled("letters") ? (
        <LetterWaiting partnerName={partnerName} />
      ) : null}

      {features.enabled("distance") ? (
        <Distance partnerName={partnerName} />
      ) : null}

      {/* QUICK ACTIONS -- right above tonight's questions, in reach. */}

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

      {/* ON THIS DAY, AND THIS WEEK'S CHALLENGE */}

      <OnThisDay />

      {features.enabled("challenge") ? <Challenge /> : null}

      {finishProfile}

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

      {/* FROM THEM: what they did, newest first. Tap to open
          it, heart it to tell them. */}

      {activity.length > 0 ? (
        <>
          <SectionHeader
            action="See All"
            onAction={() => router.push("/activity")}
          >
            From {partnerName}
          </SectionHeader>

          <Group inset={68}>
            {activity.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                name={partnerName}
                onPress={() => feed.open(item)}
                onLove={(value) => feed.love(item, value)}
              />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
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

  /* Runs to the card's edges so the row scrolls under them. */

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
}));
