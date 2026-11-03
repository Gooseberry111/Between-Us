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
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { T, themedStyles, useTheme } from "../lib/theme";
import {
  Button,
  Cell,
  Chip,
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
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * LISTS
 * ==========================================
 *
 * Shared lists, ticked off by either of you: groceries,
 * the house, things to watch, and any you make. Each
 * shows how much is left; tap one to open it.
 */

const EMOJIS = ["🛒", "🏠", "🎬", "✈️", "🎁", "📚", "🍽️", "💡"];

export default function ListsScreen() {
  useTheme();

  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `lists:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [lists, setLists] = useState(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🛒");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/lists`);
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to load.");

      setLists(data.lists || []);

      if (cacheKey) setCachedData(cacheKey, data.lists || []);

      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load your lists.");
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

  const close = () => {
    setAdding(false);
    setTitle("");
    setEmoji("🛒");
  };

  const create = async () => {
    if (!title.trim() || saving) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/lists`, {
        method: "POST",
        body: JSON.stringify({ clerk_id: userId, title: title.trim(), emoji }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to make it.");

      close();
      router.push({ pathname: "/list", params: { id: data.list.id } });
    } catch (err) {
      Alert.alert("We couldn't make that list", err?.message);
    } finally {
      setSaving(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Lists" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
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
            label="New list"
            onPress={() => setAdding(true)}
          />
        </NavBar>

        <LargeTitle>Lists</LargeTitle>

        <SubTitle>Shared, and ticked off by either of you.</SubTitle>

        <Notice>{error}</Notice>

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={3} />
          </View>
        ) : (
          <Group inset={62}>
            {lists.map((list) => (
              <Cell
                key={list.id}
                leading={
                  <View style={styles.emoji}>
                    <Text style={styles.emojiText}>{list.emoji || "📝"}</Text>
                  </View>
                }
                title={list.title}
                subtitle={
                  list.total_count === 0
                    ? "Nothing on it yet"
                    : list.open_count === 0
                      ? "All done"
                      : `${list.open_count} to go`
                }
                chevron
                onPress={() =>
                  router.push({ pathname: "/list", params: { id: list.id } })
                }
              />
            ))}
          </Group>
        )}

        <GroupFooter>Changes show up on both phones.</GroupFooter>
      </Screen>

      <Sheet
        visible={adding}
        title="New List"
        onCancel={close}
        onSave={create}
        saveDisabled={!title.trim() || saving}
        dirty={Boolean(title.trim())}
      >
        <Group>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What's it for?"
            placeholderTextColor={T.label3}
            style={styles.field}
            autoFocus
          />
        </Group>

        <View style={styles.emojis}>
          {EMOJIS.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={emoji === option}
              onPress={() => setEmoji(option)}
            />
          ))}
        </View>

        <Button
          title="Make the List"
          onPress={create}
          busy={saving}
          disabled={!title.trim()}
        />
      </Sheet>
    </>
  );
}

const styles = themedStyles(() => ({
  loading: {
    paddingHorizontal: 16,
  },

  emoji: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: T.fill4,
    alignItems: "center",
    justifyContent: "center",
  },

  emojiText: {
    fontSize: 18,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },

  emojis: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
}));
