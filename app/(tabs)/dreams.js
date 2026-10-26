import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useIsConnected } from "../../lib/connection";
import { STARTERS, coverFor, hopingFor, progressOf } from "../../lib/dreams";
import { T } from "../../lib/theme";
import {
  Card,
  Cell,
  Check,
  Empty,
  GlassButton,
  Group,
  Icon,
  LargeTitle,
  NavBar,
  Press,
  Ring,
  Screen,
  SectionHeader,
  Sheet,
} from "../../components/ui";
import Celebration from "../../components/Celebration";
import ConnectFirst from "../../components/ConnectFirst";
import DreamCover from "../../components/DreamCover";
import DreamSheet from "../../components/DreamSheet";
import { SkeletonList } from "../../components/Skeleton";

/*
 * ==========================================
 * DREAMS
 * ==========================================
 *
 * A board of things the two of you want to do.
 *
 *   the board      how many dreams are on it
 *   in progress    the one you are focused on: its cover,
 *                  Reminders-style steps you tick right
 *                  here, and a ring that fills as you do
 *   the rest       every other dream, a tap from its sheet
 *   starters       dreams to say yes to, cover and first
 *                  steps already written; Add opens them
 *                  ready to save, See all lists them all
 *   completed      the ones you have finished together
 *
 * Tick the last step and it offers to mark the dream
 * done, with a celebration when you do.
 */

const SHOWN_STEPS = 5;

/* After one sheet closes, wait for it to finish sliding
 * away before another opens, or iOS drops the second. */
const SHEET_HANDOFF_MS = 450;

export default function DreamsScreen() {
  const router = useRouter();
  const { open: openId } = useLocalSearchParams();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `dreams:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [dreams, setDreams] = useState(cached?.dreams ?? []);
  const [titles, setTitles] = useState(cached?.titles ?? []);
  const [done, setDone] = useState(cached?.done ?? 0);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [fresh, setFresh] = useState(false);

  /* The dream sheet: { dream } to edit, { starter } or {} for new. */
  const [editor, setEditor] = useState(null);
  const [allStarters, setAllStarters] = useState(false);
  const [celebrating, setCelebrating] = useState(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/dreams`);
      const data = await response.json();

      const all = Array.isArray(data) ? data : data?.dreams || [];

      const open = all.filter((dream) => !dream.is_completed);
      const closed = all.length - open.length;
      const names = all.map((dream) =>
        String(dream.title).trim().toLowerCase(),
      );

      setDreams(open);
      setDone(closed);
      setTitles(names);

      if (cacheKey) {
        setCachedData(cacheKey, { dreams: open, done: closed, titles: names });
      }
    } catch (err) {
      console.log("DREAMS LOAD ERROR:", err);
    } finally {
      setFresh(true);
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /* Arriving from a row on Home ("Added a dream: …") opens
   * that dream's sheet, once. */
  useEffect(() => {
    if (!openId) return;

    const match = dreams.find((dream) => String(dream.id) === String(openId));

    /* The cached board may not have it yet; wait for the
     * fresh one before giving up. */
    if (!match && !fresh) return;

    if (match) setEditor({ dream: match });

    router.setParams({ open: undefined });
  }, [openId, fresh, dreams, router]);

  const endCelebration = useCallback(() => setCelebrating(null), []);

  const celebrate = useCallback((name) => {
    setTimeout(() => setCelebrating(name || "Done"), SHEET_HANDOFF_MS);
  }, []);

  /* ---------- finishing a dream ---------- */

  const complete = async (dream) => {
    try {
      const response = await apiFetch(`/users/${userId}/dreams/${dream.id}`, {
        method: "PUT",
        body: JSON.stringify({ clerk_id: userId, is_completed: true }),
      });

      if (!response.ok) throw new Error("Unable to mark it done.");

      await load();

      celebrate(dream.title);
    } catch (err) {
      Alert.alert("We couldn't do that", err?.message || "Please try again.");
    }
  };

  /* ---------- ticking a step on the board ---------- */

  const toggleStep = async (dream, stepId) => {
    const before = dream.steps || [];

    const steps = before.map((step) =>
      step.id === stepId ? { ...step, done: !step.done } : step,
    );

    const swap = (list) =>
      setDreams((current) =>
        current.map((item) =>
          item.id === dream.id ? { ...item, steps: list } : item,
        ),
      );

    swap(steps);

    try {
      const response = await apiFetch(`/users/${userId}/dreams/${dream.id}`, {
        method: "PUT",
        body: JSON.stringify({ clerk_id: userId, steps }),
      });

      if (!response.ok) throw new Error("That step didn't save.");
    } catch (err) {
      swap(before);

      Alert.alert("We couldn't save that", err?.message || "Please try again.");
      return;
    }

    const ticked = steps.find((step) => step.id === stepId)?.done;

    if (ticked && steps.every((step) => step.done)) {
      Alert.alert("That's every step", `Mark “${dream.title}” as done?`, [
        { text: "Not Yet", style: "cancel" },
        { text: "Mark as Done", onPress: () => complete(dream) },
      ]);
    }
  };

  /* ---------- starters ---------- */

  const added = (starter) => titles.includes(starter.title.toLowerCase());

  const openStarter = (starter) => setEditor({ starter });

  const openStarterFromList = (starter) => {
    setAllStarters(false);

    setTimeout(() => setEditor({ starter }), SHEET_HANDOFF_MS);
  };

  if (connected === false) {
    return <ConnectFirst feature="Dreams" showBack={false} />;
  }

  const featured = dreams[0];
  const rest = dreams.slice(1);
  const progress = progressOf(featured);
  const shownSteps = (featured?.steps || []).slice(0, SHOWN_STEPS);
  const hiddenSteps = (featured?.steps || []).length - shownSteps.length;

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
        <NavBar>
          <GlassButton
            icon="add"
            label="Add a dream"
            onPress={() => setEditor({})}
          />
        </NavBar>

        <LargeTitle>Dreams</LargeTitle>

        {/* THE BOARD */}

        <Card style={styles.board}>
          <Text style={styles.boardNumber}>{dreams.length}</Text>

          <View style={styles.boardText}>
            <Text style={styles.boardTitle}>
              {dreams.length === 1
                ? "dream on your board"
                : "dreams on your board"}
            </Text>

            <Text style={styles.boardSub}>
              Add a starter and watch this go up
            </Text>
          </View>

          <Icon name="sparkle" size={26} color={T.accent} />
        </Card>

        {/* IN PROGRESS */}

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={2} />
          </View>
        ) : featured ? (
          <Card style={styles.dream} padded={false}>
            <Press
              onPress={() => setEditor({ dream: featured })}
              scaleTo={0.99}
              accessibilityLabel={`Open ${featured.title}`}
            >
              <DreamCover
                cover={coverFor(featured)}
                photoId={featured.photo_id}
                photoUrl={featured.photo_url}
                height={130}
                iconSize={34}
              >
                <View style={styles.coverChip}>
                  <Text style={styles.coverChipText}>In progress</Text>
                </View>
              </DreamCover>
            </Press>

            {/* Reminders-style steps, ticked right here. */}
            <Group inset={50} style={styles.steps}>
              {[
                ...shownSteps.map((step) => (
                  <View key={step.id} style={styles.stepRow}>
                    <Check
                      on={step.done}
                      onPress={() => toggleStep(featured, step.id)}
                      label={step.title}
                    />

                    <Text
                      style={[styles.stepText, step.done && styles.stepDone]}
                      numberOfLines={2}
                    >
                      {step.title}
                    </Text>
                  </View>
                )),

                hiddenSteps > 0 ? (
                  <Cell
                    key="more"
                    title={`${hiddenSteps} more ${hiddenSteps === 1 ? "step" : "steps"}`}
                    chevron
                    onPress={() => setEditor({ dream: featured })}
                  />
                ) : null,

                shownSteps.length === 0 ? (
                  <Cell
                    key="first"
                    leading={<Icon name="add" size={18} color={T.accent} />}
                    title="Add the first step"
                    onPress={() => setEditor({ dream: featured })}
                  />
                ) : null,
              ]}
            </Group>

            <Press
              onPress={() => setEditor({ dream: featured })}
              scaleTo={0.99}
            >
              <View style={styles.dreamHead}>
                <View style={styles.dreamText}>
                  <Text style={styles.dreamTitle} numberOfLines={2}>
                    {featured.title}
                  </Text>

                  <Text style={styles.dreamSub}>
                    {progress.total
                      ? hopingFor(featured.target_date)
                        ? `Hoping for ${hopingFor(featured.target_date)}`
                        : "Tick a step to fill the ring"
                      : "Break it into steps to start the ring"}
                  </Text>
                </View>

                <Ring
                  value={progress.value}
                  size={52}
                  label={`${progress.done}/${progress.total}`}
                />
              </View>
            </Press>
          </Card>
        ) : (
          <Empty
            icon="dreams"
            title="What are you two dreaming of?"
            text="Put one thing on the board. It can be small."
            chips={STARTERS.slice(0, 3).map((starter) => ({
              label: starter.title,
              onPress: () => openStarter(starter),
            }))}
            action={{
              title: "Add a Dream",
              icon: "add",
              onPress: () => setEditor({}),
            }}
          />
        )}

        {/* THE REST */}

        {rest.length > 0 ? (
          <>
            <SectionHeader>Also on the board</SectionHeader>

            <Group inset={70}>
              {rest.map((dream) => {
                const own = progressOf(dream);
                const when = hopingFor(dream.target_date);

                return (
                  <Cell
                    key={dream.id}
                    leading={
                      <DreamCover
                        cover={coverFor(dream)}
                        photoId={dream.photo_id}
                        photoUrl={dream.photo_url}
                        height={42}
                        iconSize={16}
                        radius={10}
                        style={styles.thumb}
                      />
                    }
                    title={dream.title}
                    subtitle={[
                      own.total
                        ? `${own.done} of ${own.total} steps`
                        : "No steps yet",
                      when,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    chevron
                    onPress={() => setEditor({ dream })}
                  />
                );
              })}
            </Group>
          </>
        ) : null}

        {/* STARTERS */}

        <SectionHeader action="See All" onAction={() => setAllStarters(true)}>
          Dream starters
        </SectionHeader>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.starters}
          decelerationRate="fast"
          snapToInterval={164}
        >
          {STARTERS.slice(0, 6).map((starter) => (
            <Press
              key={starter.id}
              onPress={() => openStarter(starter)}
              scaleTo={0.96}
              accessibilityLabel={`Add ${starter.title}`}
            >
              <Card style={styles.starter} padded={false} inset={false}>
                <DreamCover
                  cover={starter.cover}
                  icon={starter.icon}
                  height={92}
                  iconSize={28}
                />

                <View style={styles.starterBody}>
                  <Text style={styles.starterTitle} numberOfLines={2}>
                    {starter.title}
                  </Text>

                  <Text style={styles.starterKind}>{starter.kind}</Text>

                  <GetPill added={added(starter)} />
                </View>
              </Card>
            </Press>
          ))}
        </ScrollView>

        {/* COMPLETED */}

        <Group inset={52}>
          <Cell
            title="Completed together"
            subtitle={
              done > 0
                ? "Every dream you have finished"
                : "Your first finished dream gets a celebration here"
            }
            leading={<Icon name="trophy" size={22} color={T.secondary} />}
            value={String(done)}
            chevron
            onPress={() => router.push("/completed-dreams")}
          />
        </Group>
      </Screen>

      {/* A DREAM, NEW OR OLD */}

      <DreamSheet
        visible={Boolean(editor)}
        userId={userId}
        dream={editor?.dream}
        starter={editor?.starter}
        isFocused={editor?.dream?.id === featured?.id}
        onClose={() => setEditor(null)}
        onChanged={load}
        onCompleted={celebrate}
      />

      {/* EVERY STARTER */}

      <Sheet
        visible={allStarters}
        title="Dream Starters"
        subtitle="Each comes with a cover and its first steps. Change anything before you save."
        onCancel={() => setAllStarters(false)}
      >
        <Group inset={74}>
          {STARTERS.map((starter) => (
            <Cell
              key={starter.id}
              leading={
                <DreamCover
                  cover={starter.cover}
                  icon={starter.icon}
                  height={46}
                  iconSize={18}
                  radius={11}
                  style={styles.thumbLarge}
                />
              }
              title={starter.title}
              subtitle={`${starter.kind} · ${starter.steps.length} steps`}
              trailing={<GetPill added={added(starter)} />}
              onPress={() => openStarterFromList(starter)}
            />
          ))}
        </Group>
      </Sheet>

      <Celebration
        visible={Boolean(celebrating)}
        title="Dream complete"
        message={
          celebrating && celebrating !== "Done"
            ? `“${celebrating}”, done together.`
            : "Something you dreamed up together, done."
        }
        onDone={endCelebration}
      />
    </>
  );
}

/* The App Store's GET button: Add, or a check once it is on the board. */
function GetPill({ added }) {
  return (
    <View style={[styles.get, added && styles.getAdded]}>
      {added ? <Icon name="check" size={12} color={T.accentText} /> : null}

      <Text style={styles.getText}>{added ? "Added" : "Add"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  board: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  boardNumber: {
    fontFamily: "ui-rounded",
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "700",
    letterSpacing: -1.9,
    color: T.accent,
    minWidth: 30,
  },

  boardText: {
    flex: 1,
  },

  boardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  boardSub: {
    fontSize: 13,
    color: T.label2,
    marginTop: 2,
  },

  dream: {
    overflow: "hidden",
  },

  coverChip: {
    position: "absolute",
    left: 12,
    top: 12,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },

  coverChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  steps: {
    marginHorizontal: 0,
    borderRadius: 0,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  stepText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: T.label,
  },

  stepDone: {
    color: T.label2,
  },

  dreamHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.separator,
  },

  dreamText: {
    flex: 1,
    minWidth: 0,
  },

  dreamTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: T.label,
  },

  dreamSub: {
    fontSize: 13,
    color: T.label2,
    marginTop: 2,
  },

  thumb: {
    width: 42,
  },

  thumbLarge: {
    width: 46,
  },

  starters: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 12,
  },

  starter: {
    width: 152,
    overflow: "hidden",
  },

  starterBody: {
    padding: 12,
    paddingTop: 10,
  },

  starterTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
    color: T.label,
    minHeight: 38,
  },

  starterKind: {
    fontSize: 12,
    color: T.label2,
    marginTop: 2,
  },

  get: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: T.fill3,
    marginTop: 10,
  },

  getAdded: {
    backgroundColor: T.accentTint,
  },

  getText: {
    fontSize: 14,
    fontWeight: "700",
    color: T.accent,
  },
});
