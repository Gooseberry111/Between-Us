import { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { chooseAction } from "../lib/actions";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
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
  Notice,
  Screen,
  SectionHeader,
  Sheet,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import DateInput from "../components/DateInput";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * DATES
 * ==========================================
 *
 * Plans the two of you are making, the anniversaries
 * that come round every year, and an idea for when
 * neither of you can think of anything.
 *
 *   +            plan a date, in a sheet
 *   idea         today's suggestion, one tap to plan it
 *   coming up    tap one to say you did it, or remove it
 *   come round   anniversaries and birthdays, soonest first
 *   you've had   the ones you have done
 */

const DATE_IDEAS = [
  "Cook something neither of you has made before",
  "Film at home, phones in another room",
  "Walk somewhere you've never been",
  "Breakfast out before work",
  "Play each other three songs that matter",
  "Game night, loser picks the next date",
  "Watch the sunrise together",
  "Read the same thing and argue about it",
];

function ideaOfTheDay() {
  const day = Math.floor(Date.now() / 86400000);

  return DATE_IDEAS[day % DATE_IDEAS.length];
}

function daysUntil(isoDate) {
  if (!isoDate) return null;

  const target = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return Math.round((target - today) / 86400000);
}

function whenLabel(isoDate) {
  const days = daysUntil(isoDate);

  if (days === null) return "No date yet";
  if (days < 0)
    return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `In ${days} days`;

  return new Date(
    `${String(isoDate).slice(0, 10)}T00:00:00`,
  ).toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

export default function DatesScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `dates:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [plans, setPlans] = useState(cached?.plans ?? []);
  const [specialDates, setSpecialDates] = useState(cached?.specialDates ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [planDate, setPlanDate] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [plansResponse, datesResponse] = await Promise.all([
        apiFetch(`/users/${userId}/date-plans`),
        apiFetch(`/users/${userId}/special-dates`),
      ]);

      const plansData = await plansResponse.json();
      const datesData = await datesResponse.json();

      if (plansResponse.ok) {
        setPlans(Array.isArray(plansData?.plans) ? plansData.plans : []);
      }

      const upcoming = Array.isArray(datesData)
        ? datesData
        : Array.isArray(datesData?.special_dates)
          ? datesData.special_dates
          : [];

      setSpecialDates(upcoming);

      if (cacheKey) {
        setCachedData(cacheKey, {
          plans: Array.isArray(plansData?.plans) ? plansData.plans : [],
          specialDates: upcoming,
        });
      }
    } catch (err) {
      setError(err?.message || "Unable to load your dates.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const savePlan = async () => {
    const cleanTitle = title.trim();

    if (!cleanTitle || saving) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/date-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          place: place.trim() || null,
          plan_date: planDate.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this date.");
      }

      setTitle("");
      setPlace("");
      setPlanDate("");
      setAdding(false);

      await load();
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (plan) => {
    try {
      const response = await apiFetch(
        `/users/${userId}/date-plans/${plan.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        },
      );

      if (!response.ok) throw new Error("Unable to update this date.");

      await load();
    } catch (err) {
      Alert.alert(
        "We couldn't update that",
        err?.message || "Please try again.",
      );
    }
  };

  const removePlan = (plan) => {
    Alert.alert("Remove this date?", `"${plan.title}" will be deleted.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/users/${userId}/date-plans/${plan.id}`, {
              method: "DELETE",
            });

            await load();
          } catch (err) {}
        },
      },
    ]);
  };

  if (connected === false) {
    return <ConnectFirst feature="Dates" />;
  }

  const planned = plans.filter((plan) => plan.status === "planned");
  const past = plans.filter((plan) => plan.status === "done");
  const idea = ideaOfTheDay();

  /* Anniversaries, soonest first, with the countdown. */
  const upcomingSpecial = specialDates
    .map((item) => ({
      ...item,
      days: daysUntil(item.next_occurrence || item.event_date),
    }))
    .filter((item) => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const openPlan = (plan) =>
    chooseAction({
      title: plan.title,
      options: [
        { label: "We Did This", onPress: () => markDone(plan) },
        { label: "Remove", destructive: true, onPress: () => removePlan(plan) },
      ],
    });

  const closeSheet = () => {
    setAdding(false);
    setTitle("");
    setPlace("");
    setPlanDate("");
  };

  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={T.accent}
          />
        }
      >
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        >
          <GlassButton
            icon="add"
            label="Plan a date"
            onPress={() => setAdding(true)}
          />
        </NavBar>

        <LargeTitle>Dates</LargeTitle>

        <SubTitle>What you&apos;re planning, and what comes round.</SubTitle>

        <Notice>{error}</Notice>

        {/* IDEA FOR TODAY */}

        <Card style={styles.idea}>
          <View style={styles.ideaHead}>
            <Icon name="sparkle" size={16} color={T.secondary} />

            <Text style={styles.ideaLabel}>Idea for today</Text>
          </View>

          <Text style={styles.ideaText}>{idea}</Text>

          <Button
            title="Plan This One"
            kind="tinted"
            size="small"
            block={false}
            style={styles.ideaButton}
            onPress={() => {
              setTitle(idea);
              setAdding(true);
            }}
          />
        </Card>

        {/* COMING UP */}

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={2} />
          </View>
        ) : (
          <>
            <SectionHeader>Coming up</SectionHeader>

            {planned.length === 0 ? (
              <Empty
                icon="calendar"
                title="Nothing planned yet"
                text="A date in the diary is the difference between meaning to and actually going."
                action={{
                  title: "Plan a Date",
                  icon: "add",
                  onPress: () => setAdding(true),
                }}
              />
            ) : (
              <Group inset={72}>
                {planned.map((plan) => (
                  <Cell
                    key={plan.id}
                    leading={
                      plan.plan_date ? (
                        <DateBlock
                          date={plan.plan_date}
                          tone={plan.mine ? "you" : "them"}
                        />
                      ) : (
                        <View style={styles.noDate}>
                          <Icon name="calendar" size={20} color={T.label2} />
                        </View>
                      )
                    }
                    title={plan.title}
                    subtitle={[
                      whenLabel(plan.plan_date),
                      plan.place,
                      plan.mine
                        ? "You planned it"
                        : `${plan.planner_name} planned it`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    chevron
                    onPress={() => openPlan(plan)}
                  />
                ))}
              </Group>
            )}

            {/* DATES THAT COME ROUND */}

            <SectionHeader
              action="Manage"
              onAction={() => router.push("/special-dates")}
            >
              Every year
            </SectionHeader>

            {upcomingSpecial.length > 0 ? (
              <Group inset={52}>
                {upcomingSpecial.map((item) => (
                  <Cell
                    key={item.id}
                    leading={
                      <Icon name="heart" size={20} color={T.you} filled />
                    }
                    title={item.title}
                    value={
                      item.days === 0
                        ? "Today"
                        : `In ${item.days} ${item.days === 1 ? "day" : "days"}`
                    }
                  />
                ))}
              </Group>
            ) : (
              <Group inset={52}>
                <Cell
                  leading={<Icon name="add" size={20} color={T.accent} />}
                  title="Add an anniversary or birthday"
                  chevron
                  onPress={() => router.push("/special-dates")}
                />
              </Group>
            )}

            {/* DATES YOU'VE HAD */}

            {past.length > 0 ? (
              <>
                <SectionHeader>You&apos;ve had</SectionHeader>

                <Group inset={52}>
                  {past.slice(0, 8).map((plan) => (
                    <Cell
                      key={plan.id}
                      leading={
                        <Icon name="checkCircle" size={20} color={T.green} />
                      }
                      title={plan.title}
                      value={plan.plan_date ? whenLabel(plan.plan_date) : null}
                    />
                  ))}
                </Group>
              </>
            ) : null}
          </>
        )}
      </Screen>

      {/* PLAN A DATE */}

      <Sheet
        visible={adding}
        title="Plan a Date"
        subtitle="They'll know as soon as you save it."
        onCancel={closeSheet}
        onSave={savePlan}
        saveDisabled={!title.trim() || saving}
      >
        <Group>
          <TextInputRow
            value={title}
            onChangeText={setTitle}
            placeholder="What are you doing?"
            autoFocus
          />

          <TextInputRow
            value={place}
            onChangeText={setPlace}
            placeholder="Where? (optional)"
          />

          <DateInput
            value={planDate}
            onChangeText={setPlanDate}
            placeholder="When? YYYY-MM-DD (optional)"
            style={styles.field}
          />
        </Group>

        <Button
          title="Save the Date"
          onPress={savePlan}
          busy={saving}
          disabled={!title.trim()}
        />
      </Sheet>
    </>
  );
}

function TextInputRow(props) {
  return (
    <TextInput
      placeholderTextColor={T.label3}
      style={styles.field}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  idea: {
    gap: 6,
  },

  ideaHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  ideaLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.secondary,
  },

  ideaText: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: T.label,
  },

  ideaButton: {
    marginTop: 8,
  },

  noDate: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
});
