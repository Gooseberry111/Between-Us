import { StyleSheet, View } from "react-native";

import { timeAgo } from "../lib/activity";
import { T } from "../lib/theme";
import { Avatar, Cell, Icon, LoveButton } from "./ui";

/*
 * ==========================================
 * ACTIVITY ROW
 * ==========================================
 *
 * One thing one of you did: their avatar, what it was,
 * a line of detail and how long ago.
 *
 *   theirs   a dot until you have opened it, and a heart
 *            you can give
 *   yours    a filled heart once they have given one
 */

function clip(text, length = 70) {
  const value = String(text || "").trim();

  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export default function ActivityRow({ item, name, mine, onPress, onLove }) {
  return (
    <Cell
      leading={
        <View>
          <Avatar name={name} who={mine ? "you" : "them"} size={40} />

          {!mine && !item.read ? <View style={styles.unread} /> : null}
        </View>
      }
      title={item.title}
      subtitle={[clip(item.detail), timeAgo(item.created_at)]
        .filter(Boolean)
        .join(" · ")}
      onPress={onPress}
      trailing={
        mine ? (
          item.loved ? (
            <View style={styles.lovedMark} accessibilityLabel="They loved this">
              <Icon name="heart" size={20} color={T.you} filled />
            </View>
          ) : null
        ) : (
          <LoveButton value={item.loved} onChange={onLove} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  unread: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.you,
    borderWidth: 2,
    borderColor: T.surface,
  },

  lovedMark: {
    paddingHorizontal: 4,
  },
});
