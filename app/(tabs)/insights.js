import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useIsConnected } from "../../lib/connection";
import { T } from "../../lib/theme";
import {
  Button,
  Card,
  Empty,
  GlassButton,
  LargeTitle,
  NavBar,
  Screen,
  SubTitle,
} from "../../components/ui";
import ConnectFirst from "../../components/ConnectFirst";
import { SkeletonList } from "../../components/Skeleton";

/*
 * ==========================================
 * INSIGHTS
 * ==========================================
 *
 * What the two of you share, and where you differ,
 * read straight off the onboarding answers. Your
 * colour on the left, theirs on the right, every
 * time, so a glance is enough.
 */

const LOVE_LANGUAGES = [
  "Quality time",
  "Words",
  "Touch",
  "Acts of service",
  "Gifts",
];

/* A rough strength for each language: picked ones lead. */
function strengths(picked) {
  const chosen = (picked || []).map((item) => String(item).toLowerCase());

  return LOVE_LANGUAGES.map((language) => {
    const key = language.toLowerCase().split(" ")[0];
    const hit = chosen.findIndex((item) => item.includes(key));

    return {
      language,
      value: hit === -1 ? 0.18 : Math.max(0.45, 0.95 - hit * 0.18),
    };
  });
}

function Trait({ label, mine, theirs, tip, partnerName }) {
  if (!mine && !theirs) return null;

  const match =
    mine && theirs && mine.trim().toLowerCase() === theirs.trim().toLowerCase();

  return (
    <Card style={styles.trait}>
      <View style={styles.traitHead}>
        <Text style={styles.traitLabel}>{label}</Text>

        <View
          style={[styles.badge, match ? styles.badgeMatch : styles.badgeComp]}
        >
          {match ? (
            <Ionicons name="checkmark" size={12} color="#1E8E3E" />
          ) : null}

          <Text
            style={[
              styles.badgeText,
              { color: match ? "#1E8E3E" : T.accentText },
            ]}
          >
            {match ? "Match" : "Complementary"}
          </Text>
        </View>
      </View>

      <View style={styles.pair}>
        <View style={styles.who}>
          <Text style={styles.whoLabel}>You</Text>

          <Text style={[styles.whoValue, { color: T.youText }]}>
            {mine || "Not set"}
          </Text>
        </View>

        <View style={[styles.who, styles.whoThem]}>
          <Text style={styles.whoLabel}>{partnerName}</Text>

          <Text style={[styles.whoValue, { color: T.accentText }]}>
            {theirs || "Not set"}
          </Text>
        </View>
      </View>

      {!match && tip ? (
        <View style={styles.tip}>
          <Ionicons name="bulb" size={15} color={T.orange} />

          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ) : null}
    </Card>
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

      setMine(insightsData?.insights || null);
      setMyPrefs(prefsData?.preferences || prefsData || null);
      setTheirs(partnerData?.insights || null);
      setTheirPrefs(partnerData?.preferences || null);
      setPartner(partnerData?.partner || null);

      if (cacheKey) {
        setCachedData(cacheKey, {
          mine: insightsData?.insights || null,
          myPrefs: prefsData?.preferences || prefsData || null,
          theirs: partnerData?.insights || null,
          theirPrefs: partnerData?.preferences || null,
          partner: partnerData?.partner || null,
        });
      }
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

  const samePersonality =
    mine?.personality_type &&
    theirs?.personality_type &&
    mine.personality_type === theirs.personality_type;

  const myLanguages = strengths(myPrefs?.love_languages);
  const theirLanguages = strengths(theirPrefs?.love_languages);

  const topShared = myLanguages.find(
    (item, index) => item.value > 0.4 && theirLanguages[index].value > 0.4,
  );

  const nothingYet = !mine && !theirs && !myPrefs && !theirPrefs;

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
          icon="create-outline"
          label="Edit your answers"
          onPress={() => router.push("/onboarding")}
        />
      </NavBar>

      <LargeTitle>Insights</LargeTitle>

      <SubTitle>What you share, and where you differ.</SubTitle>

      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SkeletonList count={3} />
        </View>
      ) : nothingYet ? (
        <Empty
          icon="git-compare-outline"
          title="Answer a few questions first"
          text="Insights come from what you each said when you joined."
          action={{
            title: "Finish Your Answers",
            icon: "create-outline",
            onPress: () => router.push("/onboarding"),
          }}
        />
      ) : (
        <>
          {/* THE OVERLAP */}

          {samePersonality ? (
            <Card style={styles.venn}>
              <View style={styles.vennArt}>
                <View style={styles.vennPair}>
                  <View style={[styles.vennCircle, styles.vennYou]}>
                    <Text style={[styles.vennLabel, { color: T.youText }]}>
                      You
                    </Text>
                  </View>

                  <View style={[styles.vennCircle, styles.vennThem]}>
                    <Text
                      style={[styles.vennLabel, { color: T.accentText }]}
                      numberOfLines={1}
                    >
                      {partnerName}
                    </Text>
                  </View>
                </View>

                <View style={styles.vennMid}>
                  <Text style={styles.vennMidText}>
                    Both {String(mine.personality_type).toLowerCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.vennTitle}>
                You are both {String(mine.personality_type).toLowerCase()}
              </Text>

              <Text style={styles.vennText}>
                The dates that suit you are the ones that suit you both.
              </Text>
            </Card>
          ) : null}

          <Trait
            label="Personality"
            mine={mine?.personality_type}
            theirs={theirs?.personality_type}
            partnerName={partnerName}
            tip={`One of you recharges alone and the other with people. Plan one of each this month.`}
          />

          <Trait
            label="In a disagreement"
            mine={mine?.conflict_style}
            theirs={theirs?.conflict_style}
            partnerName={partnerName}
            tip={`Agree on a pause word. Whoever needs time takes twenty minutes and promises to come back.`}
          />

          <Trait
            label="Showing affection"
            mine={myPrefs?.affection_style}
            theirs={theirPrefs?.affection_style}
            partnerName={partnerName}
            tip={`You show love differently. Say out loud what you each notice most.`}
          />

          <Trait
            label="Staying in touch"
            mine={myPrefs?.communication_frequency}
            theirs={theirPrefs?.communication_frequency}
            partnerName={partnerName}
            tip={`Different rhythms are fine as long as neither of you is guessing. Name a time you both check in.`}
          />

          {/* LOVE LANGUAGES */}

          <Card style={styles.languages}>
            <View style={styles.traitHead}>
              <Text style={styles.traitLabel}>Love languages</Text>
            </View>

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

            {myLanguages.map((item, index) => (
              <View key={item.language} style={styles.llRow}>
                <Text style={styles.llLabel}>{item.language}</Text>

                <View style={styles.bars}>
                  <View style={styles.barTrack}>
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

                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${theirLanguages[index].value * 100}%`,
                          backgroundColor: T.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </Card>

          {/* THIS WEEK */}

          {topShared ? (
            <Card style={styles.suggest}>
              <Text style={styles.suggestKicker}>This week, try</Text>

              <Text style={styles.suggestTitle}>
                {topShared.language === "Quality time"
                  ? "A phone-free evening walk"
                  : topShared.language === "Words"
                    ? "Telling each other one specific thing"
                    : topShared.language === "Touch"
                      ? "Ten unhurried minutes on the sofa"
                      : topShared.language === "Gifts"
                        ? "Something small, picked on purpose"
                        : "Doing one chore the other hates"}
              </Text>

              <Text style={styles.suggestText}>
                {topShared.language} matters to both of you.
              </Text>

              <Button
                title="Add to Dates"
                icon="calendar-outline"
                kind="tinted"
                size="small"
                style={styles.suggestButton}
                onPress={() => router.push("/dates")}
              />
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  venn: {
    padding: 16,
  },

  vennArt: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 14,
  },

  /* Two circles that genuinely overlap, each labelled
     inside its own half so nothing sits on top of
     anything else. */
  vennPair: {
    flexDirection: "row",
    alignItems: "center",
  },

  vennCircle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: "center",
    justifyContent: "center",
  },

  vennYou: {
    backgroundColor: "rgba(217,87,122,0.14)",
    marginRight: -34,
    paddingRight: 26,
  },

  vennThem: {
    backgroundColor: "rgba(74,45,92,0.14)",
    paddingLeft: 26,
  },

  vennLabel: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: 74,
    textAlign: "center",
  },

  vennMid: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.fill4,
  },

  vennMidText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: T.label,
  },

  vennTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: T.label,
  },

  vennText: {
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    marginTop: 4,
  },

  trait: {
    padding: 16,
  },

  traitHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  traitLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },

  badgeMatch: {
    backgroundColor: "rgba(52,199,89,0.14)",
  },

  badgeComp: {
    backgroundColor: T.accentTint,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  pair: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  who: {
    flex: 1,
    backgroundColor: "rgba(217,87,122,0.10)",
    borderRadius: 14,
    padding: 12,
  },

  whoThem: {
    backgroundColor: "rgba(74,45,92,0.09)",
  },

  whoLabel: {
    fontSize: 12,
    color: T.label2,
  },

  whoValue: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 3,
  },

  tip: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.fill4,
  },

  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
  },

  languages: {
    padding: 16,
  },

  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
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
  },

  llLabel: {
    fontSize: 14,
    color: T.label,
    marginBottom: 6,
  },

  bars: {
    gap: 5,
  },

  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: T.fill4,
    overflow: "hidden",
  },

  bar: {
    height: 8,
    borderRadius: 4,
  },

  suggest: {
    padding: 16,
    backgroundColor: T.surface,
  },

  suggestKicker: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: T.accentText,
  },

  suggestTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: T.label,
    marginTop: 8,
  },

  suggestText: {
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    marginTop: 4,
  },

  suggestButton: {
    alignSelf: "flex-start",
    marginTop: 14,
  },
});
