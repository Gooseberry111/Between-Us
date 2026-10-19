import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { activityHandlers, loadActivity, routeFor } from "../lib/activity";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T } from "../lib/theme";
import { useMyName } from "../lib/useMyName";
import {
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  LargeTitle,
  NavBar,
  Screen,
  Segmented,
} from "../components/ui";
import ActivityRow from "../components/ActivityRow";
import ConnectFirst from "../components/ConnectFirst";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * ACTIVITY
 * ==========================================
 *
 * Everything the two of you have done for each other,
 * from either side.
 *
 *   theirs   what they did; open it, heart it
 *   yours    what you did, and which ones they loved
 */

export default function ActivityScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();
  const myName = useMyName();

  const cacheKey = userId ? `activity:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [theirs, setTheirs] = useState(cached?.theirs ?? []);
  const [mine, setMine] = useState(cached?.mine ?? []);
  const [partnerName, setPartnerName] = useState(cached?.partnerName ?? "");
  const [side, setSide] = useState("theirs");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const [theirData, myData, partnerData] = await Promise.all([
        loadActivity(userId, { who: "partner", limit: 50 }),
        loadActivity(userId, { who: "me", limit: 50 }),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const name =
        partnerData?.partner?.nickname?.trim() ||
        partnerData?.partner?.first_name?.trim() ||
        "Them";

      setTheirs(theirData.items);
      setMine(myData.items);
      setPartnerName(name);

      if (cacheKey) {
        setCachedData(cacheKey, {
          theirs: theirData.items,
          mine: myData.items,
          partnerName: name,
        });
      }
    } catch (err) {
      console.log("ACTIVITY LOAD ERROR:", err);
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
    return <ConnectFirst feature="Activity" showBack />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const them = partnerName || "Them";
  const feed = activityHandlers({
    userId,
    setItems: setTheirs,
    router,
    partnerName: them,
  });

  /* Your own rows open what they refer to, and nothing else. */
  const openOwn = (item) => {
    const route = routeFor(item);

    if (route) router.push(route);
  };

  const options = [them, "You"];
  const showing = side === "theirs" ? theirs : mine;
  const lovedCount = mine.filter((item) => item.loved).length;

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
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Activity</LargeTitle>

      <Segmented
        options={options}
        value={side === "theirs" ? them : "You"}
        onChange={(value) => setSide(value === "You" ? "mine" : "theirs")}
      />

      {loading ? (
        <View style={styles.loading}>
          <SkeletonList count={4} />
        </View>
      ) : showing.length === 0 ? (
        <Empty
          icon="heartOutline"
          title={
            side === "theirs"
              ? `Nothing from ${them} yet`
              : "Nothing from you yet"
          }
          text={
            side === "theirs"
              ? `When ${them} sends a note, adds a dream or answers tonight's questions, it shows here.`
              : "Send a note, add a dream or a memory, and it shows up for them."
          }
          action={
            side === "mine"
              ? {
                  title: "Send a Note",
                  icon: "heart",
                  onPress: () => router.push("/appreciations"),
                }
              : undefined
          }
        />
      ) : (
        <>
          <Group inset={68}>
            {showing.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                name={side === "theirs" ? them : myName || "You"}
                mine={side === "mine"}
                onPress={() =>
                  side === "theirs" ? feed.open(item) : openOwn(item)
                }
                onLove={(value) => feed.love(item, value)}
              />
            ))}
          </Group>

          <GroupFooter>
            {side === "theirs"
              ? `A heart tells ${them} you loved it.`
              : lovedCount > 0
                ? `${them} loved ${lovedCount} of these.`
                : `When ${them} loves one, a heart appears beside it.`}
          </GroupFooter>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingHorizontal: 16,
  },
});
