import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";

import { EMPTY_ANSWERS, loadAnswers, saveAnswers } from "../lib/answers";
import { clearCachedData } from "../lib/dataCache";
import { isAnswered, notifyProfileSaved } from "../lib/profileProgress";
import { birthdayError } from "../lib/validation";
import { T } from "../lib/theme";
import {
  Button,
  Cell,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  Sheet,
  SubTitle,
} from "../components/ui";
import QuestionCard from "../components/onboarding/QuestionCard";
import { questions } from "../components/onboarding/questions";

/*
 * ==========================================
 * YOUR ANSWERS
 * ==========================================
 *
 * Everything you said in onboarding, already filled in,
 * grouped the way Settings groups things. Tap one to
 * change just that answer in a sheet; nothing else is
 * asked again. Insights, trivia and what your partner
 * sees all read from here.
 */

const SECTIONS = [
  {
    title: "About you",
    items: [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["nickname", "What they call you"],
      ["birthday", "Birthday"],
      ["gender", "Gender"],
      ["country", "Country"],
      ["relationshipStatus", "Relationship"],
    ],
  },
  {
    title: "How you are",
    items: [
      ["personalityType", "Personality"],
      ["communicationStyle", "Talking"],
      ["conflictStyle", "In a disagreement"],
      ["affectionStyle", "Showing affection"],
      ["loveLanguages", "Love languages"],
    ],
  },
  {
    title: "Favourites",
    items: [
      ["favoriteFood", "Food"],
      ["favoriteSnack", "Snack"],
      ["favoriteDrink", "Drink"],
      ["favoriteColor", "Colour"],
      ["musicGenre", "Music"],
      ["movieGenre", "Films"],
    ],
  },
  {
    title: "From the app",
    items: [["focusAreas", "Help with"]],
  },
];

function shown(value) {
  if (Array.isArray(value)) return value.join(", ");

  return String(value || "");
}

function clip(text, length = 26) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export default function AnswersScreen() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();

  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* The question open in the sheet, and what is typed in it. */
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !userId) return;

    try {
      setError("");

      const { answers: loaded } = await loadAnswers(userId);

      setAnswers(loaded);
    } catch (err) {
      setError(err?.message || "Unable to load your answers.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (id) => {
    const question = questions.find((item) => item.id === id);

    if (!question) return;

    setEditing(question);
    setDraft(answers[id]);
  };

  const close = () => {
    setEditing(null);
    setDraft(null);
  };

  const original = editing ? answers[editing.id] : null;
  const dirty =
    Boolean(editing) && JSON.stringify(draft) !== JSON.stringify(original);

  const problem = !editing
    ? null
    : editing.id === "birthday"
      ? draft
        ? birthdayError(draft)
        : null
      : editing.id === "firstName" && !String(draft || "").trim()
        ? "Your first name is needed."
        : null;

  const save = async () => {
    if (!editing || saving || problem) return;

    const next = { ...answers, [editing.id]: draft };

    try {
      setSaving(true);

      await saveAnswers({
        userId,
        email: user?.primaryEmailAddress?.emailAddress || "",
        answers: next,
      });

      setAnswers(next);
      close();

      /* Everything that reads these should fetch them fresh. */
      notifyProfileSaved();
      clearCachedData(`home:${userId}`);
      clearCachedData(`insights:${userId}`);
      clearCachedData(`me-name:${userId}`);
    } catch (err) {
      setError(err?.message || "Unable to save that.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  return (
    <>
      <Screen>
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        />

        <LargeTitle>Your answers</LargeTitle>

        <SubTitle>Tap one to change it.</SubTitle>

        <Notice>{error}</Notice>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : (
          SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <GroupHeader>{section.title}</GroupHeader>

              <Group>
                {section.items.map(([id, label]) => {
                  const value = answers[id];

                  return (
                    <Cell
                      key={id}
                      title={label}
                      value={isAnswered(value) ? clip(shown(value)) : "Add"}
                      chevron
                      onPress={() => open(id)}
                    />
                  );
                })}
              </Group>
            </View>
          ))
        )}

        {!loading ? (
          <GroupFooter>
            Insights, trivia and what your partner sees all come from these.
          </GroupFooter>
        ) : null}
      </Screen>

      <Sheet
        visible={Boolean(editing)}
        title="Change Answer"
        onCancel={close}
        onSave={save}
        saveDisabled={!dirty || saving || Boolean(problem)}
        dirty={dirty}
      >
        {editing ? (
          <>
            <QuestionCard
              key={editing.id}
              question={editing}
              value={draft}
              onChange={setDraft}
            />

            <Notice>{problem}</Notice>

            <Button
              title="Save"
              onPress={save}
              busy={saving}
              disabled={!dirty || Boolean(problem)}
            />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 60,
    alignItems: "center",
  },

  section: {
    gap: 14,
  },
});
