import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import {
  Card,
  GlassButton,
  Glow,
  GroupFooter,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import { RemotePhoto } from "../components/Photo";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * YOUR MONTH TOGETHER
 * ==========================================
 *
 * The month the two of you had: a photo if there was
 * one, then what you did, as big friendly numbers. The
 * arrows step back and forward through the months.
 */

function lastMonth() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shift(month, by) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + by, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(month) {
  const [year, number] = month.split("-").map(Number);

  return new Date(year, number - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

const TILES = [
  {
    key: "answers",
    icon: "lock",
    one: "question answered",
    many: "questions answered",
    tint: T.accent,
  },
  { key: "hugs", icon: "heart", one: "hug", many: "hugs", tint: T.you },
  { key: "notes", icon: "mail", one: "note", many: "notes", tint: T.secondary },
  {
    key: "memories",
    icon: "camera",
    one: "memory saved",
    many: "memories saved",
    tint: T.accent,
  },
  { key: "dates", icon: "calendar", one: "date", many: "dates", tint: T.you },
  {
    key: "taps",
    icon: "sparkle",
    one: "little something",
    many: "little somethings",
    tint: T.secondary,
  },
  {
    key: "letters",
    icon: "envelopeOpen",
    one: "letter written",
    many: "letters written",
    tint: T.accent,
  },
  {
    key: "dreams",
    icon: "trophy",
    one: "dream come true",
    many: "dreams come true",
    tint: T.green,
  },
];

export default function RecapScreen() {
  const router = useRouter();
  const { month: monthParam } = useLocalSearchParams();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const [month, setMonth] = useState(
    /^\d{4}-\d{2}$/.test(monthParam || "") ? monthParam : lastMonth(),
  );
  const [recap, setRecap] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;

    try {
      setLoading(true);

      const [data, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/recap?month=${month}`).then((r) => r.json()),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      setRecap(data);
      setPartnerName(
        partnerData?.partner?.nickname?.trim() ||
          partnerData?.partner?.first_name?.trim() ||
          "",
      );
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load the recap.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (connected === false) {
    return <ConnectFirst feature="Monthly recap" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const them = partnerName || "Them";
  const stats = recap?.stats || {};
  const tiles = TILES.filter((tile) => stats[tile.key] > 0);
  const games = (stats.my_wins || 0) + (stats.their_wins || 0);
  const quiet = tiles.length === 0 && games === 0 && !recap?.photo;
  const thisMonth = shift(lastMonth(), 1);

  return (
    <Screen>
      <Glow height={420} />

      <NavBar left={<GlassButton icon="back" label="Back" onPress={goBack} />}>
        <GlassButton
          icon="back"
          label="Previous month"
          onPress={() => setMonth((current) => shift(current, -1))}
        />

        {month < thisMonth ? (
          <GlassButton
            icon="chevron"
            label="Next month"
            onPress={() => setMonth((current) => shift(current, 1))}
          />
        ) : null}
      </NavBar>

      <LargeTitle>{monthName(month)}</LargeTitle>

      <SubTitle>Your month together, you and {them}.</SubTitle>

      <Notice>{error}</Notice>

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={3} />
        </View>
      ) : quiet ? (
        <Card style={styles.quiet}>
          <Icon name="moon" size={26} color={T.accent} />

          <Text style={styles.quietTitle}>A quiet month</Text>

          <Text style={styles.quietText}>
            Nothing saved this time. Plenty of room to make the next one count.
          </Text>
        </Card>
      ) : (
        <>
          {recap?.photo ? (
            <Card padded={false} style={styles.photoCard}>
              <RemotePhoto
                id={recap.photo.id}
                url={recap.photo.url}
                style={styles.photo}
              />

              <Text style={styles.photoTitle}>{recap.photo.title}</Text>
            </Card>
          ) : null}

          <View style={styles.grid}>
            {tiles.map((tile) => (
              <Card key={tile.key} style={styles.tile}>
                <Icon name={tile.icon} size={18} color={tile.tint} filled />

                <Text style={[styles.tileNumber, { color: tile.tint }]}>
                  {stats[tile.key]}
                </Text>

                <Text style={styles.tileLabel}>
                  {stats[tile.key] === 1 ? tile.one : tile.many}
                </Text>
              </Card>
            ))}
          </View>

          {games > 0 ? (
            <Card style={styles.games}>
              <Text style={styles.gamesTitle}>Four in a Row</Text>

              <Text style={styles.gamesScore}>
                <Text style={{ color: T.you }}>You {stats.my_wins}</Text>
                <Text style={{ color: T.label3 }}> – </Text>
                <Text style={{ color: T.accent }}>
                  {stats.their_wins} {them}
                </Text>
              </Text>
            </Card>
          ) : null}
        </>
      )}

      <GroupFooter>
        A new recap arrives on the first of every month.
      </GroupFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },

  quiet: {
    alignItems: "center",
    paddingVertical: 28,
  },

  quietTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: T.label,
    marginTop: 10,
  },

  quietText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    textAlign: "center",
    marginTop: 6,
  },

  photoCard: {
    overflow: "hidden",
  },

  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
  },

  photoTitle: {
    fontFamily: "ui-serif",
    fontSize: 18,
    fontWeight: "600",
    color: T.label,
    padding: 16,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
  },

  tile: {
    width: "47%",
    flexGrow: 1,
    marginHorizontal: 0,
    gap: 2,
  },

  tileNumber: {
    fontFamily: "ui-rounded",
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: 6,
  },

  tileLabel: {
    fontSize: 14,
    color: T.label2,
  },

  games: {
    alignItems: "center",
    gap: 4,
  },

  gamesTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: T.label2,
  },

  gamesScore: {
    fontFamily: "ui-rounded",
    fontSize: 26,
    fontWeight: "700",
  },
});
