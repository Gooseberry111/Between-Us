import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useIsConnected } from "../lib/connection";
import { T, useTheme } from "../lib/theme";
import {
  Cell,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Screen,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";

/*
 * ==========================================
 * GAMES
 * ==========================================
 *
 * Everything the two of you can play, in one place.
 *
 *   against each other   Four in a Row, turn by turn
 *   how alike are you    This or That, Who's More Likely To
 *   how well you know    trivia about each other
 */

const GAMES = [
  {
    section: "Against each other",
    items: [
      {
        icon: "flag",
        tint: "you",
        title: "Four in a Row",
        text: "Turn by turn, in your own time",
        route: "/game",
      },
    ],
  },
  {
    section: "How alike are you?",
    items: [
      {
        icon: "sparkle",
        tint: "accent",
        title: "This or That",
        text: "Ten quick picks each, then see where you match",
        route: "/rounds?kind=this_or_that",
      },
      {
        icon: "person",
        tint: "secondary",
        title: "Who's More Likely To",
        text: "Point at each other, then see if you agree",
        route: "/rounds?kind=likely",
      },
    ],
  },
  {
    section: "How well do you know them?",
    items: [
      {
        icon: "bulb",
        tint: "green",
        title: "Couple trivia",
        text: "Questions from what they told the app",
        route: "/trivia",
      },
    ],
  },
];

export default function GamesScreen() {
  useTheme();

  const router = useRouter();
  const connected = useIsConnected();

  if (connected === false) {
    return <ConnectFirst feature="Games" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  return (
    <Screen>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>Games</LargeTitle>

      <SubTitle>For the two of you, whenever you like.</SubTitle>

      {GAMES.map((group) => (
        <View key={group.section} style={styles.section}>
          <GroupHeader>{group.section}</GroupHeader>

          <Group inset={62}>
            {group.items.map((game) => (
              <Cell
                key={game.title}
                leading={
                  <View
                    style={[styles.badge, { backgroundColor: T[game.tint] }]}
                  >
                    <Icon name={game.icon} size={17} color="#FFFFFF" filled />
                  </View>
                }
                title={game.title}
                subtitle={game.text}
                chevron
                onPress={() => router.push(game.route)}
              />
            ))}
          </Group>
        </View>
      ))}

      <GroupFooter>
        <Text>
          They hear when it's their turn. Answers stay hidden until you have
          both played.
        </Text>
      </GroupFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },

  badge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
