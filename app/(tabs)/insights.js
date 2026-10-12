import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useIsConnected } from "../../lib/connection";
import { T } from "../../lib/theme";
import {
  Avatar,
  Button,
  Card,
  Cell,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Screen,
  SubTitle,
  motionAllowed,
} from "../../components/ui";
import ConnectFirst from "../../components/ConnectFirst";
import { SkeletonList } from "../../components/Skeleton";

/*
 * ==========================================
 * INSIGHTS
 * ==========================================
 *
 * Built around one question: how in sync are you, and
 * where do you differ? Read straight from what you each
 * said when you joined.
 *
 *   the score       a ring: how many traits you share
 *   in sync         the ones that match, at a glance
 *   different       the ones that don't, each with a
 *                   way to work with the difference
 *   love languages  side by side, yours in rose and
 *                   theirs in plum
 *   this week       one thing to try, straight into Dates
 */

const LOVE_LANGUAGES = [
  "Quality time",
  "Words",
  "Touch",
  "Acts of service",
  "Gifts",
];

/* How much each language matters, read from the order picked. */
function strengths(picked) {
  const chosen = (picked || []).map((item) => String(item).toLowerCase());

  return LOVE_LANGUAGES.map((language) => {
    const key = language.toLowerCase().split(" ")[0];
    const hit = chosen.findIndex((item) => item.includes(key));

    return {
      language,
      value: hit === -1 ? 0.12 : Math.max(0.45, 0.95 - hit * 0.18),
      picked: hit !== -1,
    };
  });
}

const TRAITS = [
  {
    key: "personality",
    label: "Personality",
    mine: (d) => d.mine?.personality_type,
    theirs: (d) => d.theirs?.personality_type,
    tip: "One of you recharges alone and the other with people. Plan one of each this month.",
  },
  {
    key: "conflict",
    label: "In a disagreement",
    mine: (d) => d.mine?.conflict_style,
    theirs: (d) => d.theirs?.conflict_style,
    tip: "Agree on a pause word. Whoever needs time takes twenty minutes and promises to come back.",
  },
  {
    key: "affection",
    label: "Showing affection",
    mine: (d) => d.myPrefs?.affection_style,
    theirs: (d) => d.theirPrefs?.affection_style,
    tip: "You show love differently. Say out loud what you each notice most.",
  },
  {
    key: "touch",
    label: "Staying in touch",
    mine: (d) => d.myPrefs?.communication_frequency,
    theirs: (d) => d.theirPrefs?.communication_frequency,
    tip: "Different rhythms are fine as long as neither of you is guessing. Name a time you both check in.",
  },
];

const IDEAS = {
  "Quality time": "A phone-free evening walk",
  Words: "Tell each other one specific thing",
  Touch: "Ten unhurried minutes on the sofa",
  "Acts of service": "Each take a chore the other dislikes",
  Gifts: "Something small, chosen on purpose",
};

function same(a, b) {
  return (
    Boolean(a) &&
    Boolean(b) &&
    String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
  );
}

/*
 * The score ring: rose into plum, the same colours the
 * bond thread uses, filling to the share of traits you
 * have in common.
 */
function SyncRing({ value, size = 132 }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const fill = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let listener = null;

    motionAllowed().then((allowed) => {
      if (cancelled) return;

      if (!allowed) {
        setShown(value);
        return;
      }

      fill.setValue(0);

      listener = fill.addListener(({ value: v }) => setShown(v));

      Animated.timing(fill, {
        toValue: value,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      cancelled = true;

      if (listener) fill.removeListener(listener);
    };
  }, [value, fill]);

  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgGradient id="sync" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={T.you} />
          <Stop offset="1" stopColor={T.accent} />
        </SvgGradient>
      </Defs>

      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={T.fill3}
        strokeWidth={stroke}
        fill="none"
      />

      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="url(#sync)"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - shown)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function InsightsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `insights:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [mine, setMine] = useState(cached?.mine ?? null);
  const [myPrefs, setMyPrefs] = useState(cached?.myPrefs ?? null);
  const [theirs, setTheirs] = useState(cached?.theirs ?? null);
  const [theirPrefs, setTheirPrefs] = useState(cached?.theirPrefs ?? null);
  const [partner, setPartner] = useState(cached?.partner ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const [insightsData, prefsData, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/insights`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        apiFetch(`/users/${userId}/preferences`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const next = {
        mine: insightsData?.insights || null,
        myPrefs: prefsData?.preferences || prefsData || null,
        theirs: partnerData?.insights || null,
        theirPrefs: partnerData?.preferences || null,
        partner: partnerData?.partner || null,
      };

      setMine(next.mine);
      setMyPrefs(next.myPrefs);
      setTheirs(next.theirs);
      setTheirPrefs(next.theirPrefs);
      setPartner(next.partner);

      if (cacheKey) setCachedData(cacheKey, next);
    } catch (err) {
      console.log("INSIGHTS LOAD ERROR:", err);
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

  if (connected === false) {
    return <ConnectFirst feature="Insights" showBack={false} />;
  }

  const partnerName =
    partner?.nickname?.trim() || partner?.first_name?.trim() || "Them";

  const data = { mine, myPrefs, theirs, theirPrefs };

  /* Only traits you have both answered can be compared. */
  const compared = TRAITS.map((trait) => ({
    ...trait,
    you: trait.mine(data),
    them: trait.theirs(data),
  })).filter((trait) => trait.you && trait.them);

  const inSync = compared.filter((trait) => same(trait.you, trait.them));
  const different = compared.filter((trait) => !same(trait.you, trait.them));

  const score = compared.length ? inSync.length / compared.length : 0;

  const myLanguages = strengths(myPrefs?.love_languages);
  const theirLanguages = strengths(theirPrefs?.love_languages);

  /* A language you both picked, strongest first. */
  const shared = myLanguages
    .map((item, index) => ({
      language: item.language,
      both: item.picked && theirLanguages[index].picked,
      weight: item.value + theirLanguages[index].value,
    }))
    .filter((item) => item.both)
    .sort((a, b) => b.weight - a.weight)[0];

  const nothingYet = !mine && !theirs && !myPrefs && !theirPrefs;

  const headline =
    compared.length === 0
      ? "Not enough answers yet"
      : inSync.length === compared.length
        ? "In sync on everything"
        : inSync.length === 0
          ? "Opposites, usefully"
          : `In sync on ${inSync.length} of ${compared.length}`;

  const summary =
    compared.length === 0
      ? `Once you and ${partnerName} both answer, this fills in.`
      : inSync.length >= different.length
        ? "More alike than not. The differences below are where you grow."
        : "You balance each other out. Each difference comes with a way in.";

  return (
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
          icon="edit"
          label="Edit your answers"
          onPress={() => router.push("/onboarding")}
        />
      </NavBar>

      <LargeTitle>Insights</LargeTitle>

      <SubTitle>What you share, and where you differ.</SubTitle>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={3} />
        </View>
      ) : nothingYet ? (
        <Empty
          icon="insights"
          title="Answer a few questions first"
          text="Insights come from what you each said when you joined."
          action={{
            title: "Finish Your Answers",
            icon: "edit",
            onPress: () => router.push("/onboarding"),
          }}
        />
      ) : (
        <>
          {/* THE SCORE */}

          <Card style={styles.hero}>
            <View style={styles.ringWrap}>
              <SyncRing value={score} />

              <View style={styles.ringCentre}>
                <View style={styles.pair}>
                  <Avatar name="You" who="you" size={34} />

                  <Avatar
                    name={partnerName}
                    who="them"
                    size={34}
                    style={styles.pairThem}
                  />
                </View>

                <Text style={styles.percent}>{Math.round(score * 100)}%</Text>
              </View>
            </View>

            <Text style={styles.headline}>{headline}</Text>

            <Text style={styles.summary}>{summary}</Text>
          </Card>

          {/* IN SYNC */}

          {inSync.length > 0 ? (
            <>
              <GroupHeader>In sync</GroupHeader>

              <Group inset={54}>
                {inSync.map((trait) => (
                  <Cell
                    key={trait.key}
                    leading={
                      <View style={styles.markSync}>
                        <Icon name="check" size={14} color="#1E8E3E" />
                      </View>
                    }
                    title={trait.label}
                    value={trait.you}
                  />
                ))}
              </Group>
            </>
          ) : null}

          {/* DIFFERENT */}

          {different.length > 0 ? (
            <>
              <GroupHeader>Different, and that&apos;s useful</GroupHeader>

              {different.map((trait) => (
                <Card key={trait.key} padded={false} style={styles.diff}>
                  <Text style={styles.diffLabel}>{trait.label}</Text>

                  <View style={styles.sides}>
                    <View style={styles.side}>
                      <View style={[styles.dot, { backgroundColor: T.you }]} />

                      <View style={styles.sideText}>
                        <Text style={styles.sideWho}>You</Text>

                        <Text style={styles.sideValue}>{trait.you}</Text>
                      </View>
                    </View>

                    <View style={styles.sideRule} />

                    <View style={styles.side}>
                      <View
                        style={[styles.dot, { backgroundColor: T.accent }]}
                      />

                      <View style={styles.sideText}>
                        <Text style={styles.sideWho}>{partnerName}</Text>

                        <Text style={styles.sideValue}>{trait.them}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.tip}>
                    <Icon name="bulb" size={15} color={T.secondary} filled />

                    <Text style={styles.tipText}>{trait.tip}</Text>
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {/* LOVE LANGUAGES */}

          <GroupHeader>Love languages</GroupHeader>

          <Card style={styles.love}>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: T.you }]} />

                <Text style={styles.legendText}>You</Text>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: T.accent }]}
                />

                <Text style={styles.legendText}>{partnerName}</Text>
              </View>
            </View>

            {myLanguages.map((item, index) => {
              const them = theirLanguages[index];
              const bothPicked = item.picked && them.picked;

              return (
                <View key={item.language} style={styles.llRow}>
                  <View style={styles.llHead}>
                    <Text style={styles.llLabel}>{item.language}</Text>

                    {bothPicked ? (
                      <Text style={styles.llBoth}>Both</Text>
                    ) : null}
                  </View>

                  <View style={styles.track}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${item.value * 100}%`,
                          backgroundColor: T.you,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.track}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${them.value * 100}%`,
                          backgroundColor: T.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </Card>

          <GroupFooter>
            Longer bars are the ones each of you put first.
          </GroupFooter>

          {/* THIS WEEK */}

          {shared ? (
            <>
              <GroupHeader>This week, try</GroupHeader>

              <Card style={styles.week}>
                <View style={styles.weekIcon}>
                  <Icon name="sparkle" size={20} color={T.secondary} />
                </View>

                <Text style={styles.weekTitle}>
                  {IDEAS[shared.language] || "Something small, together"}
                </Text>

                <Text style={styles.weekText}>
                  {shared.language} matters to both of you.
                </Text>

                <Button
                  title="Add to Dates"
                  icon="calendar"
                  kind="tinted"
                  size="small"
                  block={false}
                  style={styles.weekButton}
                  onPress={() => router.push("/dates")}
                />
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  hero: {
    alignItems: "center",
    paddingVertical: 24,
  },

  ringWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },

  ringCentre: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },

  pair: {
    flexDirection: "row",
  },

  pairThem: {
    marginLeft: -10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  percent: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: T.label,
    marginTop: 6,
  },

  headline: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: T.label,
    marginTop: 18,
    textAlign: "center",
  },

  summary: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  markSync: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(52,199,89,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  diff: {
    overflow: "hidden",
  },

  diffLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  sides: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  side: {
    flex: 1,
    flexDirection: "row",
    gap: 9,
  },

  sideRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: T.separator,
    marginHorizontal: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },

  sideText: {
    flex: 1,
  },

  sideWho: {
    fontSize: 12,
    color: T.label2,
  },

  sideValue: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
    marginTop: 2,
  },

  tip: {
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: T.fill4,
  },

  tipText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    color: T.label2,
  },

  love: {
    paddingTop: 14,
  },

  legend: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 4,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  legendText: {
    fontSize: 13,
    color: T.label2,
  },

  llRow: {
    marginTop: 14,
    gap: 5,
  },

  llHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  llLabel: {
    fontSize: 15,
    color: T.label,
  },

  llBoth: {
    fontSize: 12,
    fontWeight: "600",
    color: T.secondary,
  },

  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: T.fill4,
    overflow: "hidden",
  },

  bar: {
    height: 6,
    borderRadius: 3,
  },

  week: {
    padding: 18,
  },

  weekIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(201,151,63,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  weekTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: T.label,
    marginTop: 12,
  },

  weekText: {
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    marginTop: 4,
  },

  weekButton: {
    alignSelf: "flex-start",
    marginTop: 14,
  },
});
