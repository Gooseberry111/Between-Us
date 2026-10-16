import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { chooseAction } from "../lib/actions";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Button,
  Cell,
  Chip,
  DateBlock,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  Sheet,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import DateInput from "../components/DateInput";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * EVERY YEAR
 * ==========================================
 *
 * Birthdays, anniversaries and anything else that comes
 * round each year, soonest first, with how long to go.
 * You both get a nudge as each one gets close.
 */

const SUGGESTIONS = ["Our anniversary", "First date", "Their birthday"];

/* Days until this date next comes round, counting today as 0. */
function daysToNext(iso) {
  if (!iso) return null;

  const original = new Date(String(iso).slice(0, 10) + "T00:00:00");

  if (Number.isNaN(original.getTime())) return null;

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const next = new Date(
    today.getFullYear(),
    original.getMonth(),
    original.getDate(),
  );

  if (next < today) next.setFullYear(today.getFullYear() + 1);

  return Math.round((next - today) / 86400000);
}

function countdown(days) {
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";

  return `In ${days} days`;
}

export default function SpecialDatesScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `special-dates:${userId}` : null;
  const cachedSpecialDates = cacheKey ? getCachedData(cacheKey) : undefined;

  const [specialDates, setSpecialDates] = useState(cachedSpecialDates || []);
  const [loading, setLoading] = useState(!cachedSpecialDates);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");

  const loadSpecialDates = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const cached = cacheKey ? getCachedData(cacheKey) : undefined;

    if (cached) {
      setSpecialDates(cached);
      setLoading(false);
    }

    try {
      setError("");

      const response = await apiFetch(`/users/${userId}/special-dates`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load special dates.");
      }

      const nextSpecialDates = Array.isArray(data?.special_dates)
        ? data.special_dates
        : [];

      setSpecialDates(nextSpecialDates);

      if (cacheKey) setCachedData(cacheKey, nextSpecialDates);
    } catch (err) {
      if (!cached) {
        setError(err?.message || "Unable to load your special dates.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useEffect(() => {
    loadSpecialDates();
  }, [loadSpecialDates]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSpecialDates();
  };

  const resetForm = () => {
    setTitle("");
    setEventDate("");
    setShowForm(false);
  };

  const saveSpecialDate = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please give this date a title.");
      return;
    }

    if (!eventDate.trim()) {
      Alert.alert("Missing date", "Please choose a date.");
      return;
    }

    if (!userId) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/special-dates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          event_date: eventDate.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save special date.");
      }

      resetForm();
      await loadSpecialDates();
    } catch (err) {
      Alert.alert(
        "Something went wrong",
        err?.message || "Unable to save special date.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSpecialDate = (specialDate) => {
    Alert.alert(
      "Delete this date?",
      `"${specialDate.title}" will be permanently removed.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await apiFetch(
                `/users/${userId}/special-dates/${specialDate.id}`,
                {
                  method: "DELETE",
                },
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  data?.error || "Unable to delete special date.",
                );
              }

              setSpecialDates((current) => {
                const next = current.filter(
                  (item) => item.id !== specialDate.id,
                );
                if (cacheKey) setCachedData(cacheKey, next);
                return next;
              });
            } catch (err) {
              Alert.alert(
                "Something went wrong",
                err?.message || "Unable to delete special date.",
              );
            }
          },
        },
      ],
    );
  };

  if (connected === false) {
    return <ConnectFirst feature="Special dates" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dates");
  };

  const sorted = specialDates
    .map((item) => ({ ...item, days: daysToNext(item.event_date) }))
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={T.accent}
          />
        }
      >
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        >
          <GlassButton
            icon="add"
            label="Add a date"
            onPress={() => setShowForm(true)}
          />
        </NavBar>

        <LargeTitle>Every year</LargeTitle>

        <SubTitle>The days worth remembering, soonest first.</SubTitle>

        <Notice>{error}</Notice>

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={3} />
          </View>
        ) : sorted.length === 0 ? (
          <Empty
            icon="calendar"
            title="Nothing to remember yet"
            text="Birthdays, your anniversary, the first date. You both get a nudge before each one."
            chips={SUGGESTIONS.map((label) => ({
              label,
              onPress: () => {
                setTitle(label);
                setShowForm(true);
              },
            }))}
          />
        ) : (
          <>
            <Group inset={72}>
              {sorted.map((item) => (
                <Cell
                  key={item.id}
                  leading={<DateBlock date={item.event_date} tone="you" />}
                  title={item.title}
                  subtitle={countdown(item.days)}
                  onPress={() =>
                    chooseAction({
                      title: item.title,
                      options: [
                        {
                          label: "Delete",
                          destructive: true,
                          onPress: () => deleteSpecialDate(item),
                        },
                      ],
                    })
                  }
                />
              ))}
            </Group>

            <GroupFooter>
              You both get a reminder as each one gets close.
            </GroupFooter>
          </>
        )}
      </Screen>

      <Sheet
        visible={showForm}
        title="New Date"
        onCancel={resetForm}
        onSave={saveSpecialDate}
        saveDisabled={!title.trim() || !eventDate.trim() || saving}
      >
        <View style={styles.chips}>
          {SUGGESTIONS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={title === label}
              onPress={() => setTitle(label)}
            />
          ))}
        </View>

        <Group>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What is it?"
            placeholderTextColor={T.label3}
            style={styles.field}
          />

          <DateInput
            value={eventDate}
            onChangeText={setEventDate}
            placeholder="YYYY-MM-DD"
            style={styles.field}
          />
        </Group>

        <GroupFooter>
          The year it first happened. It comes round on the same day each year.
        </GroupFooter>

        <Button
          title="Save Date"
          onPress={saveSpecialDate}
          busy={saving}
          disabled={!title.trim() || !eventDate.trim()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
});
