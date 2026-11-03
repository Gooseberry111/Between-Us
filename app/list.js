import { useCallback, useRef, useState } from "react";
import {
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { chooseAction } from "../lib/actions";
import { T } from "../lib/theme";
import {
  Check,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
} from "../components/ui";

/*
 * ==========================================
 * ONE LIST
 * ==========================================
 *
 * Reminders-style: a field at the top to add to it, round
 * checks to tick things off, and what is done drops to
 * the bottom. Hold an item to delete it. While open it
 * checks in now and then, so the other phone's ticks show.
 */

const REFRESH_MS = 6000;

export default function ListScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const input = useRef(null);
  const busy = useRef(false);

  const apply = (data) => {
    if (data?.list) setList(data.list);
    if (Array.isArray(data?.items)) setItems(data.items);
  };

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId || !id || busy.current) return;

    try {
      const response = await apiFetch(`/users/${userId}/lists/${id}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to load.");

      apply(data);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load this list.");
    } finally {
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, id]);

  useFocusEffect(
    useCallback(() => {
      load();

      const timer = setInterval(load, REFRESH_MS);

      return () => clearInterval(timer);
    }, [load]),
  );

  const send = async (path, method, body) => {
    busy.current = true;

    try {
      const response = await apiFetch(`/users/${userId}/lists/${id}${path}`, {
        method,
        body: body ? JSON.stringify({ clerk_id: userId, ...body }) : undefined,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "That didn't save.");

      apply(data);
      setError("");
    } catch (err) {
      setError(err?.message || "That didn't save.");
      load();
    } finally {
      busy.current = false;
    }
  };

  const add = () => {
    const value = text.trim();

    if (!value) return;

    setText("");
    setItems((current) => [
      ...current.filter((item) => !item.done),
      { id: `new-${Date.now()}`, text: value, done: false },
      ...current.filter((item) => item.done),
    ]);

    send("/items", "POST", { text: value });

    requestAnimationFrame(() => input.current?.focus());
  };

  const toggle = (item) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, done: !entry.done } : entry,
      ),
    );

    send(`/items/${item.id}`, "PATCH", { done: !item.done });
  };

  const remove = (item) =>
    chooseAction({
      title: item.text,
      options: [
        {
          label: "Delete",
          destructive: true,
          onPress: () => {
            setItems((current) =>
              current.filter((entry) => entry.id !== item.id),
            );
            send(`/items/${item.id}`, "DELETE");
          },
        },
      ],
    });

  const removeList = () =>
    Alert.alert(
      `Delete “${list?.title}”?`,
      "It goes for both of you, with everything on it.",
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await apiFetch(`/users/${userId}/lists/${id}`, {
              method: "DELETE",
            });
            router.back();
          },
        },
      ],
    );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/lists");
  };

  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  const row = (item) => (
    <View key={item.id} style={styles.row}>
      <Check on={item.done} onPress={() => toggle(item)} label={item.text} />

      <Text
        style={[styles.text, item.done && styles.textDone]}
        onLongPress={() => remove(item)}
        suppressHighlighting
      >
        {item.text}
      </Text>
    </View>
  );

  return (
    <Screen
      keyboard
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
      <NavBar left={<GlassButton icon="back" label="Back" onPress={goBack} />}>
        <GlassButton
          icon="more"
          label="List options"
          onPress={() =>
            chooseAction({
              title: list?.title,
              options: [
                {
                  label: "Delete List",
                  destructive: true,
                  onPress: removeList,
                },
              ],
            })
          }
        />
      </NavBar>

      <LargeTitle>
        {list?.emoji ? `${list.emoji} ` : ""}
        {list?.title || "List"}
      </LargeTitle>

      <Notice>{error}</Notice>

      <Group inset={50}>
        {[
          <View key="add" style={styles.row}>
            <View style={styles.addMark}>
              <Icon name="add" size={14} color={T.accent} />
            </View>

            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              onSubmitEditing={add}
              submitBehavior="submit"
              placeholder="Add to the list"
              placeholderTextColor={T.label3}
              returnKeyType="done"
              style={styles.input}
            />
          </View>,
          ...open.map(row),
        ]}
      </Group>

      {done.length > 0 ? (
        <>
          <GroupHeader>Done</GroupHeader>

          <Group inset={50}>{done.map(row)}</Group>
        </>
      ) : null}

      <GroupFooter>Hold an item to delete it.</GroupFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },

  addMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 12,
  },

  text: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 12,
  },

  textDone: {
    color: T.label2,
    textDecorationLine: "line-through",
  },
});
