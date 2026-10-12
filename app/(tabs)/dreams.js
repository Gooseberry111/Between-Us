import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../../lib/api";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useIsConnected } from "../../lib/connection";
import { T } from "../../lib/theme";
import {
  Button,
  Card,
  Cell,
  Empty,
  GlassButton,
  Group,
  LargeTitle,
  NavBar,
  Press,
  Screen,
  SectionHeader,
} from "../../components/ui";
import ConnectFirst from "../../components/ConnectFirst";
import { SkeletonList } from "../../components/Skeleton";
import DateInput from "../../components/DateInput";

/*
 * ==========================================
 * DREAMS
 * ==========================================
 *
 * A board of things the two of you want to do, led by
 * the one in progress, with starters for when neither
 * of you can think of anything.
 *
 * Needs backend: steps within a dream, and the source
 * for the starter cards (these are local suggestions).
 */

const STARTERS = [
  {
    id: "zanzibar",
    title: "Weekend in Zanzibar",
    kind: "Travel",
    icon: "umbrella",
    colours: ["#7FD3FF", "#3A8DFF"],
  },
  {
    id: "cuisines",
    title: "Cook 10 cuisines",
    kind: "At home",
    icon: "restaurant",
    colours: ["#FFD36E", "#FF8A4C"],
  },
  {
    id: "salsa",
    title: "Learn salsa",
    kind: "Experience",
    icon: "musical-notes",
    colours: ["#C8B4FF", "#8456F5"],
  },
  {
    id: "home",
    title: "Our first home",
    kind: "Build",
    icon: "home",
    colours: ["#8FE9C5", "#1FB884"],
  },
];

/* Fitness-style ring. */
function Ring({ value, size = 54 }) {
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={T.accentTint}
          strokeWidth="6"
          fill="none"
        />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={T.accent}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.ringLabel}>
        <Text style={styles.ringText}>{Math.round(value * 100)}%</Text>
      </View>
    </View>
  );
}

export default function DreamsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();

  const cacheKey = userId ? `dreams:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [dreams, setDreams] = useState(cached?.dreams ?? []);
  const [done, setDone] = useState(cached?.done ?? 0);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/users/${userId}/dreams`);
      const data = await response.json();

      const all = Array.isArray(data) ? data : data?.dreams || [];

      const open = all.filter((dream) => !dream.is_completed);
      const closed = all.length - open.length;

      setDreams(open);
      setDone(closed);

      if (cacheKey) setCachedData(cacheKey, { dreams: open, done: closed });
    } catch (err) {
      console.log("DREAMS LOAD ERROR:", err);
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

  const saveDream = async (preset) => {
    const name = (preset || title).trim();

    if (!name || saving) return;

    try {
      setSaving(true);

      const response = await apiFetch(`/users/${userId}/dreams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_id: userId,
          title: name,
          description: preset ? null : description.trim() || null,
          target_date: preset ? null : targetDate.trim() || null,
          category: "Other",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this dream.");
      }

      setTitle("");
      setDescription("");
      setTargetDate("");
      setSheetOpen(false);

      await load();
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (connected === false) {
    return <ConnectFirst feature="Dreams" showBack={false} />;
  }

  const featured = dreams[0];
  const rest = dreams.slice(1);

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
        <NavBar>
          <GlassButton
            icon="add"
            label="Add a dream"
            onPress={() => setSheetOpen(true)}
          />
        </NavBar>

        <LargeTitle>Dreams</LargeTitle>

        {/* THE BOARD */}

        <Card style={styles.board}>
          <Text style={styles.boardNumber}>{dreams.length}</Text>

          <View style={styles.boardText}>
            <Text style={styles.boardTitle}>
              {dreams.length === 1
                ? "dream on your board"
                : "dreams on your board"}
            </Text>

            <Text style={styles.boardSub}>
              Add a starter and watch this go up
            </Text>
          </View>

          <Ionicons name="sparkles" size={20} color={T.accent} />
        </Card>

        {loading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <SkeletonList count={2} />
          </View>
        ) : featured ? (
          <Card style={styles.dream} padded={false}>
            <LinearGradient
              colors={["#FFC2E4", "#4A2D5C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cover}
            >
              <View style={styles.coverChip}>
                <Text style={styles.coverChipText}>In progress</Text>
              </View>
            </LinearGradient>

            <View style={styles.dreamHead}>
              <View style={styles.dreamText}>
                <Text style={styles.dreamTitle}>{featured.title}</Text>

                <Text style={styles.dreamSub}>
                  {featured.target_date
                    ? `Hoping for ${new Date(featured.target_date).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
                    : "No date on it yet"}
                </Text>
              </View>

              <Ring
                value={dreams.length ? 1 / (dreams.length + done || 1) : 0}
              />
            </View>

            {featured.description ? (
              <Text style={styles.dreamNote}>{featured.description}</Text>
            ) : null}
          </Card>
        ) : (
          <Empty
            icon="sparkles-outline"
            title="What are you two dreaming of?"
            text="Put one thing on the board. It can be small."
            action={{
              title: "Add a Dream",
              icon: "add",
              onPress: () => setSheetOpen(true),
            }}
          />
        )}

        {rest.length > 0 ? (
          <Group inset={16}>
            {rest.map((dream) => (
              <Cell
                key={dream.id}
                title={dream.title}
                subtitle={dream.description}
                leading={
                  <Ionicons name="ellipse-outline" size={22} color={T.accent} />
                }
                chevron
                onPress={() => router.push("/(tabs)/dreams")}
              />
            ))}
          </Group>
        ) : null}

        {/* STARTERS */}

        <SectionHeader>Dream starters</SectionHeader>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.starters}
        >
          {STARTERS.map((starter) => (
            <Card key={starter.id} style={styles.starter} padded={false}>
              <LinearGradient
                colors={starter.colours}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.starterCover}
              >
                <Ionicons name={starter.icon} size={26} color="#FFFFFF" />
              </LinearGradient>

              <View style={styles.starterBody}>
                <Text style={styles.starterTitle} numberOfLines={2}>
                  {starter.title}
                </Text>

                <Text style={styles.starterKind}>{starter.kind}</Text>

                <Press
                  onPress={() => saveDream(starter.title)}
                  scaleTo={0.92}
                  style={styles.starterAdd}
                >
                  <Text style={styles.starterAddText}>ADD</Text>
                </Press>
              </View>
            </Card>
          ))}
        </ScrollView>

        <Group inset={52}>
          <Cell
            title="Completed together"
            subtitle={
              done > 0
                ? "Opens the ones you have finished"
                : "Your first finished dream gets a celebration here"
            }
            leading={<Ionicons name="trophy" size={22} color={T.accent} />}
            trailing={<Text style={styles.value}>{done}</Text>}
            chevron
            onPress={() => router.push("/completed-dreams")}
          />
        </Group>
      </Screen>

      {/* NEW DREAM SHEET */}

      <Modal
        visible={sheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSheetOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheetNav}>
            <Text
              style={styles.sheetCancel}
              onPress={() => setSheetOpen(false)}
            >
              Cancel
            </Text>

            <Text style={styles.sheetTitle}>New Dream</Text>

            <Text
              style={[styles.sheetSave, !title.trim() && styles.sheetSaveOff]}
              onPress={() => saveDream()}
            >
              Save
            </Text>
          </View>

          <View style={styles.sheetBody}>
            <Card padded={false}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What do you want to do together?"
                placeholderTextColor={T.label3}
                style={styles.field}
              />

              <View style={styles.fieldLine} />

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Why it matters (optional)"
                placeholderTextColor={T.label3}
                style={[styles.field, styles.fieldTall]}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.fieldLine} />

              <DateInput
                value={targetDate}
                onChangeText={setTargetDate}
                placeholder="By when? YYYY-MM-DD (optional)"
                style={styles.field}
              />
            </Card>

            <Button
              title="Add to the Board"
              onPress={() => saveDream()}
              busy={saving}
              disabled={!title.trim()}
              style={styles.sheetButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },

  boardNumber: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "700",
    letterSpacing: -1.6,
    color: T.accent,
    minWidth: 46,
  },

  boardText: {
    flex: 1,
  },

  boardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: T.label,
  },

  boardSub: {
    fontSize: 13,
    color: T.label2,
    marginTop: 1,
  },

  dream: {
    overflow: "hidden",
  },

  cover: {
    height: 130,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 12,
  },

  coverChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.82)",
  },

  coverChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: T.accentText,
  },

  dreamHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },

  dreamText: {
    flex: 1,
  },

  dreamTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: T.label,
  },

  dreamSub: {
    fontSize: 13,
    color: T.label2,
    marginTop: 2,
  },

  dreamNote: {
    fontSize: 14,
    lineHeight: 20,
    color: T.label2,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -6,
  },

  ringLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  ringText: {
    fontSize: 12,
    fontWeight: "700",
    color: T.accentText,
  },

  starters: {
    paddingHorizontal: 16,
    gap: 12,
  },

  starter: {
    width: 180,
    marginHorizontal: 0,
    overflow: "hidden",
  },

  starterCover: {
    height: 92,
    alignItems: "center",
    justifyContent: "center",
  },

  starterBody: {
    padding: 12,
  },

  starterTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  starterKind: {
    fontSize: 13,
    color: T.label2,
    marginTop: 2,
  },

  starterAdd: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.fill3,
  },

  starterAddText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: T.accentText,
  },

  value: {
    fontSize: 16,
    color: T.label2,
  },

  sheet: {
    flex: 1,
    backgroundColor: T.appBackground,
  },

  sheetNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  sheetCancel: {
    fontSize: 17,
    color: T.accent,
    width: 70,
  },

  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: T.label,
  },

  sheetSave: {
    fontSize: 17,
    fontWeight: "600",
    color: T.accent,
    width: 70,
    textAlign: "right",
  },

  sheetSaveOff: {
    color: T.label3,
  },

  sheetBody: {
    gap: 16,
  },

  field: {
    fontSize: 16,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  fieldTall: {
    minHeight: 92,
  },

  fieldLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.separator,
    marginLeft: 16,
  },

  sheetButton: {
    marginHorizontal: 16,
  },
});
