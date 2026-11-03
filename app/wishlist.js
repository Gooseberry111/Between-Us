import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
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
  Card,
  Cell,
  Check,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
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
 * GIFT IDEAS
 * ==========================================
 *
 * When they mention something they would love, put it
 * here. Only you can see this list. Two weeks before their
 * birthday or your anniversary, you get a reminder that
 * the ideas are waiting. Tick one off once it is bought.
 */

function countdown(days, what) {
  if (days === null || days === undefined) return null;
  if (days === 0) return `${what} is today`;
  if (days === 1) return `${what} is tomorrow`;

  return `${what} in ${days} days`;
}

export default function WishlistScreen() {
  useTheme();

  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `wishlist:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [items, setItems] = useState(cached?.items ?? []);
  const [birthdayIn, setBirthdayIn] = useState(cached?.birthday_in ?? null);
  const [anniversaryIn, setAnniversaryIn] = useState(
    cached?.anniversary_in ?? null,
  );
  const [partnerName, setPartnerName] = useState(cached?.partnerName ?? "");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* The idea in the sheet: {} for new, an item to edit. */
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const [listData, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/wishlist`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Unable to load.")),
        ),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const name =
        partnerData?.partner?.nickname?.trim() ||
        partnerData?.partner?.first_name?.trim() ||
        "";

      setItems(listData.items || []);
      setBirthdayIn(listData.birthday_in);
      setAnniversaryIn(listData.anniversary_in);
      setPartnerName(name);

      if (cacheKey) setCachedData(cacheKey, { ...listData, partnerName: name });

      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load your ideas.");
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

  const open = (item) => {
    setEditing(item || {});
    setTitle(item?.title || "");
    setNote(item?.note || "");
    setLink(item?.link || "");
  };

  const close = () => setEditing(null);

  const save = async () => {
    if (!title.trim() || saving) return;

    try {
      setSaving(true);

      const isNew = !editing?.id;

      const response = await apiFetch(
        isNew
          ? `/users/${userId}/wishlist`
          : `/users/${userId}/wishlist/${editing.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify({
            clerk_id: userId,
            title: title.trim(),
            note: note.trim(),
            link: link.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to save it.");

      close();
      await load();
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBought = async (item) => {
    const bought = !item.bought;

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, bought } : entry,
      ),
    );

    try {
      const response = await apiFetch(`/users/${userId}/wishlist/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ clerk_id: userId, bought }),
      });

      if (!response.ok) throw new Error();
    } catch {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, bought: !bought } : entry,
        ),
      );
    }
  };

  const remove = () => {
    const item = editing;

    Alert.alert("Delete this idea?", `“${item.title}”`, [
      { text: "Keep It", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/users/${userId}/wishlist/${item.id}`, {
              method: "DELETE",
            });

            close();
            await load();
          } catch (err) {
            Alert.alert("We couldn't delete that", err?.message);
          }
        },
      },
    ]);
  };

  if (connected === false) {
    return <ConnectFirst feature="Gift ideas" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const them = partnerName || "Their";
  const open_ = items.filter((item) => !item.bought);
  const bought = items.filter((item) => item.bought);

  const soon = [
    countdown(
      birthdayIn,
      `${partnerName ? `${partnerName}'s` : "Their"} birthday`,
    ),
    countdown(anniversaryIn, "Your anniversary"),
  ].filter(Boolean);

  const row = (item) => (
    <View key={item.id} style={styles.row}>
      <Check
        on={item.bought}
        onPress={() => toggleBought(item)}
        label={item.bought ? "Mark not bought" : "Mark bought"}
      />

      <View style={styles.rowBody}>
        <Cell
          title={item.title}
          subtitle={[item.note, item.link ? "Has a link" : null]
            .filter(Boolean)
            .join(" · ")}
          chevron
          onPress={() => open(item)}
        />
      </View>
    </View>
  );

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
          <GlassButton icon="add" label="Add an idea" onPress={() => open()} />
        </NavBar>

        <LargeTitle>Gift ideas</LargeTitle>

        <SubTitle>Only you can see this list.</SubTitle>

        <Notice>{error}</Notice>

        {soon.length > 0 ? (
          <Card style={styles.soon}>
            <Icon name="calendar" size={20} color={T.you} />

            <View style={styles.soonText}>
              {soon.map((line) => (
                <Text key={line} style={styles.soonLine}>
                  {line}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <SkeletonList count={3} />
          </View>
        ) : items.length === 0 ? (
          <Empty
            icon="heart"
            title="Nothing saved yet"
            text={`Next time ${partnerName || "they"} mention something they'd love, put it here. You'll get a nudge before the day.`}
            action={{
              title: "Add an Idea",
              icon: "add",
              onPress: () => open(),
            }}
          />
        ) : (
          <>
            {open_.length > 0 ? (
              <Group inset={50}>{open_.map(row)}</Group>
            ) : null}

            {bought.length > 0 ? (
              <>
                <GroupHeader>Bought</GroupHeader>

                <Group inset={50}>{bought.map(row)}</Group>
              </>
            ) : null}

            <GroupFooter>
              Tick one once it's bought. You'll get a reminder two weeks before{" "}
              {them === "Their" ? "their" : `${them}'s`} birthday and your
              anniversary.
            </GroupFooter>
          </>
        )}
      </Screen>

      <Sheet
        visible={Boolean(editing)}
        title={editing?.id ? "Gift Idea" : "New Gift Idea"}
        onCancel={close}
        onSave={save}
        saveDisabled={!title.trim() || saving}
        dirty={
          editing?.id
            ? title !== (editing.title || "") ||
              note !== (editing.note || "") ||
              link !== (editing.link || "")
            : Boolean(title.trim() || note.trim() || link.trim())
        }
      >
        <Group>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What would they love?"
            placeholderTextColor={T.label3}
            style={styles.field}
          />

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Size, colour, where they saw it (optional)"
            placeholderTextColor={T.label3}
            style={[styles.field, styles.fieldTall]}
            multiline
            textAlignVertical="top"
          />

          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="A link (optional)"
            placeholderTextColor={T.label3}
            style={styles.field}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Group>

        <Button
          title={editing?.id ? "Save" : "Add Idea"}
          onPress={save}
          busy={saving}
          disabled={!title.trim()}
        />

        {editing?.id && editing.link ? (
          <Button
            title="Open the Link"
            kind="plain"
            icon="link"
            onPress={() => Linking.openURL(editing.link).catch(() => {})}
          />
        ) : null}

        {editing?.id ? (
          <Button title="Delete Idea" kind="destructive" onPress={remove} />
        ) : null}
      </Sheet>
    </>
  );
}

const styles = themedStyles(() => ({
  loading: {
    paddingHorizontal: 16,
  },

  soon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  soonText: {
    flex: 1,
    gap: 2,
  },

  soonLine: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
  },

  rowBody: {
    flex: 1,
    marginLeft: -4,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },

  fieldTall: {
    minHeight: 80,
  },
}));
