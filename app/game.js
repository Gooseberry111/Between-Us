import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { useMyName } from "../lib/useMyName";
import { T } from "../lib/theme";
import {
  Avatar,
  Button,
  Card,
  GlassButton,
  GroupFooter,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
} from "../components/ui";
import Celebration from "../components/Celebration";
import ConnectFirst from "../components/ConnectFirst";

/*
 * ==========================================
 * FOUR IN A ROW
 * ==========================================
 *
 * The two of you, turn by turn, in your own time. Tap a
 * column to drop a counter; four in a line wins. Your
 * counters are rose, theirs plum, the same on both phones.
 *
 * While it is their move the board checks in every few
 * seconds, so a reply lands without pulling to refresh,
 * and they get a notification when it is theirs.
 */

const ROWS = 6;
const COLUMNS = 7;
const GAP = 6;
const WAIT_MS = 4000;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
}

function landingRow(board, column) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row][column]) return row;
  }

  return -1;
}

const tap = (style) => Haptics.impactAsync(style).catch(() => {});

export default function GameScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();
  const myName = useMyName();
  const { width } = useWindowDimensions();

  const cacheKey = userId ? `game:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [game, setGame] = useState(cached?.game ?? null);
  const [score, setScore] = useState(
    cached?.score ?? { you: 0, them: 0, draws: 0 },
  );
  const [partnerName, setPartnerName] = useState(cached?.partnerName ?? "");
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);

  /* The counter that just landed, for its drop. */
  const [dropping, setDropping] = useState(null);
  const fall = useRef(new Animated.Value(1)).current;

  const them = partnerName || "Them";

  /* The board as last drawn, to spot a move that just arrived. */
  const shownGame = useRef(game);

  useEffect(() => {
    shownGame.current = game;
  }, [game]);

  const apply = useCallback((data) => {
    if (!data) return;

    const before = shownGame.current;
    const next = data.game || null;

    /* Their move just arrived: drop it in and nudge. */
    if (
      before &&
      next &&
      before.id === next.id &&
      next.moves > before.moves &&
      Number.isInteger(next.last_move)
    ) {
      const row = Math.floor(next.last_move / COLUMNS);
      const column = next.last_move % COLUMNS;

      if (next.board[row][column] === "them") {
        setDropping({ row, column });
        tap(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    setGame(next);

    if (data.score) setScore(data.score);
  }, []);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;

    try {
      const [gameData, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/games`).then((r) =>
          r.ok ? r.json() : null,
        ),
        partnerName
          ? Promise.resolve(null)
          : apiFetch(`/users/${userId}/partner`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
      ]);

      apply(gameData);

      const name =
        partnerData?.partner?.nickname?.trim() ||
        partnerData?.partner?.first_name?.trim() ||
        partnerName;

      if (name) setPartnerName(name);

      if (cacheKey && gameData) {
        setCachedData(cacheKey, {
          game: gameData.game,
          score: gameData.score,
          partnerName: name,
        });
      }

      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load the game.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, cacheKey, partnerName, apply]);

  /* Load on arrival, then check in only while it is their
   * move -- never mid-way through sending yours. */
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useFocusEffect(
    useCallback(() => {
      load();

      const timer = setInterval(() => {
        const current = shownGame.current;

        if (
          !busyRef.current &&
          current?.status === "playing" &&
          current?.turn === "them"
        ) {
          load();
        }
      }, WAIT_MS);

      return () => clearInterval(timer);
    }, [load]),
  );

  /* The drop: from above the board to its row. */
  useEffect(() => {
    if (!dropping) return;

    fall.setValue(0);

    Animated.timing(fall, {
      toValue: 1,
      duration: 280 + dropping.row * 45,
      easing: Easing.bounce,
      useNativeDriver: true,
    }).start();
  }, [dropping, fall]);

  /* How it ended, felt as well as seen -- only when it ends
   * while you are here, not every time you open a finished one. */
  const lastStatus = useRef(game?.status ?? null);

  useEffect(() => {
    const before = lastStatus.current;

    lastStatus.current = game?.status ?? null;

    if (!game || before !== "playing" || game.status === "playing") return;

    if (game.winner === "you") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setCelebrating(true);
    } else if (game.winner === "them") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
    }
  }, [game]);

  const endCelebration = useCallback(() => setCelebrating(false), []);

  const start = async () => {
    if (busy) return;

    try {
      setBusy(true);
      setError("");

      const response = await apiFetch(`/users/${userId}/games`, {
        method: "POST",
        body: JSON.stringify({ clerk_id: userId }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unable to start.");

      apply(data);
    } catch (err) {
      setError(err?.message || "Unable to start a game.");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (column) => {
    if (!game || busy || game.status !== "playing" || game.turn !== "you") {
      if (game?.turn === "them") tap(Haptics.ImpactFeedbackStyle.Soft);
      return;
    }

    const row = landingRow(game.board, column);

    if (row === -1) {
      tap(Haptics.ImpactFeedbackStyle.Soft);
      return;
    }

    /* Show it at once; the server has the final say. */
    const before = game;
    const board = game.board.map((cells) => cells.slice());

    board[row][column] = "you";

    setGame({ ...game, board, turn: "them", moves: game.moves + 1 });
    setDropping({ row, column });
    tap(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setBusy(true);

      const response = await apiFetch(
        `/users/${userId}/games/${game.id}/move`,
        {
          method: "POST",
          body: JSON.stringify({ clerk_id: userId, column }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        if (data?.game) setGame(data.game);
        else setGame(before);

        setError(data?.error || "That move didn't go through.");
        return;
      }

      setGame(data.game);
      if (data.score) setScore(data.score);
      setError("");
    } catch (err) {
      setGame(before);
      setError(err?.message || "That move didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Four in a Row" />;
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  /* Cells fill the width, less the card's padding. */
  const boardWidth = Math.min(width - 32, 520) - 20;
  const cell = Math.floor((boardWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  const winning = new Set((game?.winning || []).map(([r, c]) => `${r}-${c}`));
  const board = game?.board || emptyBoard();

  const status = !game
    ? "Start a game and they'll get a nudge."
    : game.status === "won"
      ? game.winner === "you"
        ? "You won this one."
        : `${them} won this one.`
      : game.status === "draw"
        ? "A draw. The board is full."
        : game.turn === "you"
          ? "Your move. Tap a column."
          : `Waiting for ${them}…`;

  return (
    <>
      <Screen>
        <NavBar
          left={<GlassButton icon="back" label="Back" onPress={goBack} />}
        />

        <LargeTitle>Four in a Row</LargeTitle>

        {/* THE SCORE */}

        <Card style={styles.score}>
          <View style={styles.side}>
            <Avatar name={myName || "You"} who="you" size={40} />

            <Text style={styles.sideName}>You</Text>
          </View>

          <View style={styles.tally}>
            <Text style={styles.tallyText}>
              <Text style={{ color: T.you }}>{score.you}</Text>
              <Text style={styles.tallyDash}> – </Text>
              <Text style={{ color: T.accent }}>{score.them}</Text>
            </Text>

            {score.draws ? (
              <Text style={styles.draws}>
                {score.draws} {score.draws === 1 ? "draw" : "draws"}
              </Text>
            ) : null}
          </View>

          <View style={styles.side}>
            <Avatar name={them} who="them" size={40} />

            <Text style={styles.sideName} numberOfLines={1}>
              {them}
            </Text>
          </View>
        </Card>

        {/* WHOSE TURN */}

        <View style={styles.statusRow}>
          {game?.status === "playing" ? (
            <View
              style={[
                styles.turnDot,
                { backgroundColor: game.turn === "you" ? T.you : T.accent },
              ]}
            />
          ) : null}

          <Text style={styles.status}>{loading ? "Loading…" : status}</Text>
        </View>

        {/* THE BOARD */}

        <View style={styles.boardWrap}>
          <View style={[styles.board, { width: boardWidth + 20 }]}>
            <View style={styles.columns}>
              {Array.from({ length: COLUMNS }, (_, column) => (
                <Pressable
                  key={column}
                  onPress={() => drop(column)}
                  style={[styles.column, { width: cell }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Column ${column + 1}`}
                  disabled={!game || game.status !== "playing"}
                >
                  {board.map((cells, row) => {
                    const piece = cells[column];
                    const isDrop =
                      dropping &&
                      dropping.row === row &&
                      dropping.column === column;
                    const lit = winning.has(`${row}-${column}`);

                    return (
                      <View
                        key={row}
                        style={[
                          styles.hole,
                          { width: cell, height: cell, borderRadius: cell / 2 },
                        ]}
                      >
                        {piece ? (
                          <Animated.View
                            style={[
                              styles.piece,
                              {
                                width: cell,
                                height: cell,
                                borderRadius: cell / 2,
                                backgroundColor:
                                  piece === "you" ? T.you : T.accent,
                              },
                              lit && styles.pieceLit,
                              isDrop && {
                                transform: [
                                  {
                                    translateY: fall.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [
                                        -(row + 1) * (cell + GAP),
                                        0,
                                      ],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Notice>{error}</Notice>

        {!game || game.status !== "playing" ? (
          <Button
            title={game ? "Play Again" : "Start a Game"}
            icon="sparkle"
            onPress={start}
            busy={busy}
          />
        ) : null}

        <GroupFooter>
          Take turns dropping a counter. Four in a line, across, down or
          diagonally, wins. Whoever didn&apos;t start goes first next time.
        </GroupFooter>
      </Screen>

      <Celebration
        visible={celebrating}
        title="You won"
        message={`Four in a row against ${them}.`}
        onDone={endCelebration}
      />
    </>
  );
}

const styles = StyleSheet.create({
  score: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },

  side: {
    alignItems: "center",
    gap: 6,
    width: 86,
  },

  sideName: {
    fontSize: 13,
    fontWeight: "600",
    color: T.label2,
  },

  tally: {
    alignItems: "center",
  },

  tallyText: {
    fontFamily: "ui-rounded",
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "700",
  },

  tallyDash: {
    color: T.label3,
  },

  draws: {
    fontSize: 12,
    color: T.label2,
    marginTop: 2,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },

  turnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  status: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  boardWrap: {
    alignItems: "center",
  },

  board: {
    padding: 10,
    borderRadius: 24,
    backgroundColor: T.accentTint,
    overflow: "hidden",
  },

  columns: {
    flexDirection: "row",
    gap: GAP,
  },

  column: {
    gap: GAP,
  },

  hole: {
    backgroundColor: T.surface,
    overflow: "visible",
  },

  piece: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  pieceLit: {
    borderWidth: 4,
    borderColor: T.secondary,
  },
});
