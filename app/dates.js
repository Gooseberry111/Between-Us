import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { chooseAction } from "../lib/actions";
import { getCachedData, setCachedData } from "../lib/dataCache";
import { useIsConnected } from "../lib/connection";
import { onLive } from "../lib/live";
import { Location, fetchArea, knownArea, metresBetween } from "../lib/places";
import { T, themedStyles, useTheme } from "../lib/theme";
import {
  Button,
  Card,
  Segmented,
  Cell,
  DateBlock,
  GlassButton,
  Group,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Press,
  Screen,
  SearchField,
  Sheet,
  SubTitle,
} from "../components/ui";
import ConnectFirst from "../components/ConnectFirst";
import PlaceMap, { mapAvailable } from "../components/PlaceMap";
import { SkeletonList } from "../components/Skeleton";

/*
 * ==========================================
 * DATES
 * ==========================================
 *
 * Find somewhere, ask them, make it happen.
 *
 *   waiting on you    a date they suggested: yes, another
 *                     time, or not this one
 *   waiting on them   one you suggested, until they say yes
 *   coming up         dates you have both agreed to
 *   find a spot       places near you on a map -- dinner,
 *                     coffee, outdoors, fun -- with photos
 *                     where there are any; search by name,
 *                     or look somewhere else entirely
 *   coming round      birthdays and anniversaries, soonest first
 *   you've been       the dates you have had
 *
 * Nothing is "planned" until both of you have agreed to it.
 */

const TIMES = [
  { value: "10:00", label: "Morning", hint: "10am" },
  { value: "13:00", label: "Lunch", hint: "1pm" },
  { value: "16:00", label: "Afternoon", hint: "4pm" },
  { value: "19:00", label: "Evening", hint: "7pm" },
  { value: "21:00", label: "Late", hint: "9pm" },
];

const SKIES = {
  dinner: ["#7A2E4C", "#D9577A"],
  coffee: ["#6B4A1F", "#C9973F"],
  drinks: ["#3B2F5A", "#6B4E8A"],
  outdoors: ["#2F5A2B", "#7A9A3E"],
  culture: ["#1F4E6B", "#3E8E9C"],
  fun: ["#4A2D5C", "#B5507A"],
  movies: ["#1E1B2E", "#4A2D5C"],
};

const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function nextDays(count) {
  const out = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const day = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + i,
    );

    out.push({
      value: isoDay(day),
      top:
        i === 0
          ? "Today"
          : i === 1
            ? "Tmrw"
            : day.toLocaleDateString(undefined, { weekday: "short" }),
      bottom: String(day.getDate()),
    });
  }

  return out;
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const target = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function whenText(date, time) {
  if (!date) return "No day yet";

  const days = daysUntil(date);
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : new Date(`${String(date).slice(0, 10)}T12:00:00`).toLocaleDateString(
            undefined,
            {
              weekday: "short",
              day: "numeric",
              month: "short",
            },
          );

  if (!time) return day;

  const [h, m] = time.split(":").map(Number);

  return `${day}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

const distanceText = (m) =>
  m === undefined || m === null
    ? ""
    : m < 1000
      ? `${Math.round(m / 10) * 10} m`
      : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;

function openDirections({ lat, lon, name }) {
  if (lat === null || lat === undefined) return;

  const label = encodeURIComponent(name || "Date");
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${lat},${lon}&q=${label}`
      : `geo:${lat},${lon}?q=${lat},${lon}(${label})`;

  Linking.openURL(url).catch(() =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    ),
  );
}

function googlePhotos(place) {
  const query = encodeURIComponent(
    `${place.name} ${place.address || ""}`.trim(),
  );
  Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${query}&center=${place.lat},${place.lon}`,
  ).catch(() => {});
}

/* A photo if there is one, else the place's own colours. */
function Cover({ uri, kind, emoji, style, big }) {
  useTheme();

  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={style}
        onError={() => setFailed(true)}
        resizeMode="cover"
      />
    );
  }

  return (
    <LinearGradient
      colors={SKIES[kind] || SKIES.fun}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[style, styles.coverFallback]}
    >
      <Text style={big ? styles.coverEmojiBig : styles.coverEmoji}>
        {emoji || "📍"}
      </Text>
    </LinearGradient>
  );
}

export default function DatesScreen() {
  useTheme();

  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const connected = useIsConnected();
  const { width: screenW } = useWindowDimensions();

  const cacheKey = userId ? `dates:v2:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [plans, setPlans] = useState(cached?.plans ?? []);
  const [specialDates, setSpecialDates] = useState(cached?.specialDates ?? []);
  const [partnerName, setPartnerName] = useState(cached?.partnerName ?? "");
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  /* Where to look. */
  const [me, setMe] = useState(cached?.me ?? null);
  const [centre, setCentre] = useState(
    cached?.me ? { ...cached.me, fromMe: true } : null,
  );
  const [area, setArea] = useState("");
  const [locStatus, setLocStatus] = useState(cached?.me ? "ok" : "asking");

  /* What is there. */
  const [kinds, setKinds] = useState([]);
  const [kind, setKind] = useState(null);
  const [query, setQuery] = useState("");
  /* Every place in the area; the chips and search filter it here. */
  const [areaPlaces, setAreaPlaces] = useState([]);
  const [placesBusy, setPlacesBusy] = useState(false);
  /* The quick first look is in; the whole area is still coming. */
  const [filling, setFilling] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [showCount, setShowCount] = useState(8);
  const [selected, setSelected] = useState(null);

  /* Looking somewhere else. */
  const [elsewhere, setElsewhere] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaResults, setAreaResults] = useState([]);

  /* A place in full, and asking them. */
  const [viewing, setViewing] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [proposing, setProposing] = useState(null);
  const [day, setDay] = useState(null);
  const [time, setTime] = useState("19:00");
  const [planTitle, setPlanTitle] = useState("");
  const [planPlace, setPlanPlace] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const them = partnerName || "them";

  /* Our dates (what is planned) or Find a spot (the map). */
  const [tab, setTab] = useState("ours");
  const tabChosen = useRef(false);
  const days = useMemo(() => nextDays(21), []);

  /* ---------- the plans ---------- */

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    try {
      const [plansData, datesData, partnerData] = await Promise.all([
        apiFetch(`/users/${userId}/date-plans`).then((r) =>
          r.ok ? r.json() : null,
        ),
        apiFetch(`/users/${userId}/special-dates`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        apiFetch(`/users/${userId}/partner`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const nextPlans = Array.isArray(plansData?.plans) ? plansData.plans : [];
      const upcoming = Array.isArray(datesData)
        ? datesData
        : Array.isArray(datesData?.special_dates)
          ? datesData.special_dates
          : [];
      const name =
        partnerData?.partner?.nickname?.trim() ||
        partnerData?.partner?.first_name?.trim() ||
        partnerName;

      if (plansData) setPlans(nextPlans);
      setSpecialDates(upcoming);
      if (name) setPartnerName(name);
    } catch {
      /* the cached view stays */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoaded, isSignedIn, userId, partnerName]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(
    () =>
      onLive((type) => {
        if (String(type).startsWith("date_")) load();
      }),
    [load],
  );

  useEffect(() => {
    if (cacheKey)
      setCachedData(cacheKey, { plans, specialDates, partnerName, me });
  }, [cacheKey, plans, specialDates, partnerName, me]);

  /* ---------- where you are ---------- */

  const locate = useCallback(async () => {
    if (!Location) {
      setLocStatus("unavailable");
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocStatus("denied");
        return;
      }

      const last = await Location.getLastKnownPositionAsync().catch(() => null);

      if (last?.coords) {
        const point = { lat: last.coords.latitude, lon: last.coords.longitude };
        setMe((current) => current || point);
        setCentre((current) => current || { ...point, fromMe: true });
        setLocStatus("ok");
      }

      const now = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy?.Balanced ?? 3,
      });
      const point = { lat: now.coords.latitude, lon: now.coords.longitude };

      /* A fix a few hundred metres off is the same place: no new look. */
      setMe((current) =>
        metresBetween(current, point) < 400 ? current : point,
      );
      setCentre((current) =>
        !current
          ? { ...point, fromMe: true }
          : current.fromMe && metresBetween(current, point) >= 400
            ? { ...point, fromMe: true }
            : current,
      );
      setLocStatus("ok");
    } catch {
      setLocStatus((current) => (current === "ok" ? "ok" : "denied"));
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  /* ---------- what is near ---------- */

  const centreRef = useRef(centre);
  centreRef.current = centre;

  const stillHere = (point) =>
    centreRef.current &&
    centreRef.current.lat === point.lat &&
    centreRef.current.lon === point.lon;

  const showArea = useCallback((point, data) => {
    if (!data) return;

    setAreaPlaces(data.places);
    if (data.kinds.length) setKinds(data.kinds);
    if (data.area && !point.label) setArea(data.area);
  }, []);

  /*
   * One look per place: what this session already has shows
   * at once; otherwise a quick look, then quietly the whole
   * area. lib/places makes sure only one runs at a time.
   */
  const lookAround = useCallback(
    async (point) => {
      if (!userId || !point) return;

      const known = knownArea(point);

      setPlacesError("");

      if (known) {
        showArea(point, known);
        if (!known.partial) return;
      } else {
        setAreaPlaces([]);
        setPlacesBusy(true);
      }

      try {
        const quick = known || (await fetchArea(userId, point));

        if (!stillHere(point)) return;

        showArea(point, quick);
        setPlacesBusy(false);

        if (quick?.partial) {
          setFilling(true);

          const full = await fetchArea(userId, point, { full: true }).catch(
            () => null,
          );

          if (stillHere(point)) showArea(point, full);
        }
      } catch (err) {
        if (stillHere(point))
          setPlacesError(err?.message || "The map service is busy.");
      } finally {
        if (stillHere(point)) {
          setPlacesBusy(false);
          setFilling(false);
        }
      }
    },
    [userId, showArea],
  );

  useEffect(() => {
    if (centre) lookAround(centre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre?.lat, centre?.lon, lookAround]);

  /* The chips and the search box, on what is already here. */
  const places = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return areaPlaces.filter((place) => {
      if (kind && place.kind !== kind) return false;
      if (!needle) return true;

      return (
        place.name.toLowerCase().includes(needle) ||
        (place.cuisine || []).some((c) => c.toLowerCase().includes(needle)) ||
        (place.address || "").toLowerCase().includes(needle) ||
        (kinds.find((k) => k.key === place.kind)?.label || "")
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [areaPlaces, kind, query, kinds]);

  useEffect(() => {
    setShowCount(8);
  }, [kind, query, centre?.lat, centre?.lon]);

  useEffect(() => {
    if (!elsewhere || areaQuery.trim().length < 2) {
      setAreaResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(
          `/users/${userId}/geocode?q=${encodeURIComponent(areaQuery.trim())}` +
            (me ? `&lat=${me.lat}&lon=${me.lon}` : ""),
        );
        const data = await response.json().catch(() => ({}));
        setAreaResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        setAreaResults([]);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [areaQuery, elsewhere, userId, me]);

  /* ---------- a place in full ---------- */

  const openPlace = async (place) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(place);
    setViewing(place);
    setPhotos(place.image ? [place.image] : []);

    try {
      const params = new URLSearchParams({
        lat: String(place.lat),
        lon: String(place.lon),
      });
      if (place.image) params.set("image", place.image);

      const response = await apiFetch(
        `/users/${userId}/places/photos?${params.toString()}`,
      );
      const data = await response.json().catch(() => ({}));

      if (Array.isArray(data.photos) && data.photos.length)
        setPhotos(data.photos);
    } catch {
      /* the cover stays */
    }
  };

  const startProposal = (place, plan) => {
    setViewing(null);
    setProposing({ place, plan });
    setDay(plan?.plan_date || null);
    setTime(plan?.plan_time || "19:00");
    setPlanTitle(
      place
        ? `${place.kind === "dinner" ? "Dinner" : place.kind === "coffee" ? "Coffee" : place.kind === "drinks" ? "Drinks" : "Date"} at ${place.name}`
        : "",
    );
    setPlanPlace(place?.name || "");
    setNote("");
  };

  const closeProposal = () => {
    setProposing(null);
    setDay(null);
    setNote("");
  };

  const sendProposal = async () => {
    if (!proposing || !day || sending) return;

    const { place, plan } = proposing;

    try {
      setSending(true);

      const response = plan
        ? await apiFetch(`/users/${userId}/date-plans/${plan.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              action: "reschedule",
              plan_date: day,
              plan_time: time,
            }),
          })
        : await apiFetch(`/users/${userId}/date-plans`, {
            method: "POST",
            body: JSON.stringify({
              title: planTitle.trim() || (place ? place.name : "A date"),
              place: place?.name || planPlace.trim() || null,
              address: place?.address || null,
              lat: place?.lat ?? null,
              lon: place?.lon ?? null,
              photo_url: place ? place.image || photos[0] || null : null,
              place_kind: place?.kind || null,
              plan_date: day,
              plan_time: time,
              notes: note.trim() || null,
            }),
          });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.error || "That didn't send.");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      closeProposal();
      await load();

      Alert.alert(
        plan ? "New time sent" : "Asked! 💌",
        `It's saved as soon as ${them} says yes.`,
      );
    } catch (err) {
      Alert.alert("We couldn't send that", err?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  };

  /* ---------- answering, and the rest ---------- */

  const answer = async (plan, action) => {
    try {
      const response = await apiFetch(
        `/users/${userId}/date-plans/${plan.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.error || "That didn't go.");

      Haptics.notificationAsync(
        action === "accept"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});

      await load();
    } catch (err) {
      Alert.alert("We couldn't do that", err?.message || "Please try again.");
    }
  };

  const setStatus = async (plan, status) => {
    try {
      await apiFetch(`/users/${userId}/date-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch {
      /* the list stays as it was */
    }
  };

  const removePlan = (plan) =>
    Alert.alert(
      "Remove this date?",
      `"${plan.title}" will be deleted for both of you.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/users/${userId}/date-plans/${plan.id}`, {
                method: "DELETE",
              });
              await load();
            } catch {
              /* nothing changes */
            }
          },
        },
      ],
    );

  const planActions = (plan) =>
    chooseAction({
      title: plan.title,
      options: [
        ...(plan.lat !== null && plan.lat !== undefined
          ? [
              {
                label: "Directions",
                onPress: () =>
                  openDirections({
                    lat: plan.lat,
                    lon: plan.lon,
                    name: plan.place || plan.title,
                  }),
              },
            ]
          : []),
        { label: "We did this 🎉", onPress: () => setStatus(plan, "done") },
        { label: "Remove", destructive: true, onPress: () => removePlan(plan) },
      ],
    });

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const toYou = plans.filter(
    (plan) => plan.status === "proposed" && plan.awaiting_you,
  );
  const toThem = plans.filter(
    (plan) => plan.status === "proposed" && !plan.awaiting_you,
  );
  const planned = plans.filter((plan) => plan.status === "planned");
  const past = plans.filter((plan) => plan.status === "done").slice(0, 6);

  const active = toYou.length + toThem.length + planned.length;
  const oursLabel = active ? `Our dates · ${active}` : "Our dates";

  const comingRound = specialDates
    .map((item) => ({
      ...item,
      days: daysUntil(item.next_occurrence || item.event_date),
    }))
    .filter((item) => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  const kindLabel = (key) => kinds.find((k) => k.key === key)?.label || "";

  useEffect(() => {
    if (!loading && !tabChosen.current) setTab(active ? "ours" : "find");
  }, [loading, active]);

  /* ---------- pieces ---------- */

  const planCard = (plan, children) => (
    <Card key={plan.id} padded={false} style={styles.planCard}>
      <Cover
        uri={plan.photo_url}
        kind={plan.place_kind}
        emoji={plan.place_kind ? undefined : "💕"}
        style={styles.planCover}
      />

      <View style={styles.planBody}>
        <Text style={styles.planTitle}>{plan.title}</Text>

        <Text style={styles.planMeta} numberOfLines={2}>
          {whenText(plan.plan_date, plan.plan_time)}
          {plan.address || plan.place ? ` · ${plan.address || plan.place}` : ""}
        </Text>

        {plan.notes ? (
          <Text style={styles.planNote} numberOfLines={3}>
            “{plan.notes}”
          </Text>
        ) : null}

        {children}
      </View>
    </Card>
  );

  if (connected === false) {
    return <ConnectFirst feature="Dates" />;
  }

  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              if (centre) lookAround(centre);
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
            label="Your own idea"
            onPress={() => startProposal(null, null)}
          />
        </NavBar>

        <LargeTitle>Dates</LargeTitle>

        <SubTitle>Find somewhere, ask {them}, make it happen.</SubTitle>

        {loading && plans.length === 0 ? (
          <View style={styles.pad}>
            <SkeletonList count={2} />
          </View>
        ) : null}

        <Segmented
          options={[oursLabel, "Find a spot"]}
          value={tab === "ours" ? oursLabel : "Find a spot"}
          onChange={(label) => {
            Haptics.selectionAsync().catch(() => {});
            tabChosen.current = true;
            setTab(label === "Find a spot" ? "find" : "ours");
          }}
          style={styles.tabs}
        />

        {tab === "ours" ? (
          <>
            {/* WAITING ON YOU */}
            {toYou.length > 0 ? (
              <View style={styles.section}>
                <GroupHeader>{them} asked you out</GroupHeader>

                {toYou.map((plan) =>
                  planCard(
                    plan,
                    <View style={styles.answerRow}>
                      <Button
                        title="Yes, let's go"
                        icon="heart"
                        onPress={() => answer(plan, "accept")}
                      />

                      <View style={styles.answerSmall}>
                        <View style={styles.flex}>
                          <Button
                            title="Another time"
                            kind="gray"
                            size="small"
                            onPress={() => startProposal(null, plan)}
                          />
                        </View>

                        <View style={styles.flex}>
                          <Button
                            title="Not this one"
                            kind="plain"
                            size="small"
                            onPress={() => answer(plan, "decline")}
                          />
                        </View>
                      </View>
                    </View>,
                  ),
                )}
              </View>
            ) : null}

            {/* WAITING ON THEM */}
            {toThem.length > 0 ? (
              <View style={styles.section}>
                <GroupHeader>Waiting for {them}</GroupHeader>

                {toThem.map((plan) =>
                  planCard(
                    plan,
                    <View style={styles.waitingRow}>
                      <ActivityIndicator size="small" color={T.accent} />

                      <Text style={styles.waitingText}>
                        Saved once {them} says yes
                      </Text>

                      <Pressable
                        onPress={() => removePlan(plan)}
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </Pressable>
                    </View>,
                  ),
                )}
              </View>
            ) : null}

            {/* COMING UP */}
            {planned.length > 0 ? (
              <View style={styles.section}>
                <GroupHeader>Planned · {planned.length}</GroupHeader>

                {planned.map((plan) => (
                  <Press key={plan.id} onPress={() => planActions(plan)}>
                    {planCard(
                      plan,
                      <View style={styles.confirmed}>
                        <Icon name="checkCircle" size={15} color={T.green} />
                        <Text style={styles.confirmedText}>You're both in</Text>
                      </View>,
                    )}
                  </Press>
                ))}
              </View>
            ) : null}

            {/* NOTHING PLANNED YET */}
            {!loading && active === 0 ? (
              <View style={styles.section}>
                <Card style={styles.askCard}>
                  <Text style={styles.askEmoji}>🗓️</Text>

                  <Text style={styles.askTitle}>No dates planned yet</Text>

                  <Text style={styles.askText}>
                    Find a spot near you and ask {them}, or suggest your own
                    idea. Once you've both said yes, it's saved here.
                  </Text>

                  <View style={styles.askButtons}>
                    <Button
                      title="Your own idea"
                      kind="gray"
                      onPress={() => startProposal(null, null)}
                    />

                    <Button
                      title="Find a spot"
                      icon="map"
                      onPress={() => {
                        tabChosen.current = true;
                        setTab("find");
                      }}
                    />
                  </View>
                </Card>
              </View>
            ) : null}

            {/* COMING ROUND */}
            {comingRound.length > 0 ? (
              <View style={styles.section}>
                <GroupHeader>Coming round</GroupHeader>

                <Group inset={70}>
                  {comingRound.map((item) => (
                    <Cell
                      key={item.id}
                      leading={
                        <DateBlock
                          date={item.next_occurrence || item.event_date}
                          tone="you"
                        />
                      }
                      title={item.title}
                      subtitle={
                        item.days === 0
                          ? "Today"
                          : item.days === 1
                            ? "Tomorrow"
                            : `In ${item.days} days`
                      }
                      chevron
                      onPress={() => router.push("/special-dates")}
                    />
                  ))}
                </Group>
              </View>
            ) : null}

            {/* YOU'VE BEEN */}
            {past.length > 0 ? (
              <View style={styles.section}>
                <GroupHeader>You've been</GroupHeader>

                <Group inset={16}>
                  {past.map((plan) => (
                    <Cell
                      key={plan.id}
                      title={plan.title}
                      subtitle={[
                        plan.place,
                        plan.plan_date ? whenText(plan.plan_date) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </Group>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {/* FIND A SPOT */}
            <View style={styles.section}>
              <GroupHeader>Find a spot</GroupHeader>

              <View style={styles.whereRow}>
                <Icon name="pin" size={16} color={T.accent} />

                <Text style={styles.whereText} numberOfLines={1}>
                  {centre
                    ? centre.label || (area ? `Near ${area}` : "Near you")
                    : locStatus === "asking"
                      ? "Finding where you are…"
                      : "Choose an area to look in"}
                </Text>

                <Pressable
                  onPress={() => setElsewhere((open) => !open)}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>
                    {elsewhere ? "Done" : "Somewhere else"}
                  </Text>
                </Pressable>
              </View>

              {elsewhere ? (
                <View style={styles.pad}>
                  <SearchField
                    value={areaQuery}
                    onChangeText={setAreaQuery}
                    placeholder="A town, an area, a street"
                    autoFocus
                  />

                  {me ? (
                    <Cell
                      leading={
                        <Icon name="navigate" size={18} color={T.accent} />
                      }
                      title="Back to where I am"
                      onPress={() => {
                        setCentre({ ...me, fromMe: true });
                        setArea("");
                        setElsewhere(false);
                      }}
                    />
                  ) : null}

                  {areaResults.map((result) => (
                    <Cell
                      key={`${result.lat},${result.lon}`}
                      leading={<Icon name="pin" size={18} color={T.label2} />}
                      title={result.name}
                      onPress={() => {
                        setCentre({
                          lat: result.lat,
                          lon: result.lon,
                          label: `Around ${result.name.split(",")[0]}`,
                        });
                        setElsewhere(false);
                        setAreaQuery("");
                      }}
                    />
                  ))}
                </View>
              ) : null}

              {!centre && !elsewhere ? (
                <Card style={styles.askCard}>
                  <Text style={styles.askEmoji}>📍</Text>

                  <Text style={styles.askTitle}>
                    {locStatus === "unavailable"
                      ? "Look anywhere"
                      : "Where are you?"}
                  </Text>

                  <Text style={styles.askText}>
                    {locStatus === "denied"
                      ? "Location is off for Between Us. Turn it on in Settings, or pick an area to look in."
                      : locStatus === "unavailable"
                        ? "Type an area to find date spots there. The latest version of the app can also use where you are."
                        : "Allow location to see date spots around you."}
                  </Text>

                  <View style={styles.askButtons}>
                    {locStatus === "denied" ? (
                      <Button
                        title="Open Settings"
                        kind="gray"
                        onPress={() => Linking.openSettings().catch(() => {})}
                      />
                    ) : null}

                    <Button
                      title="Choose an area"
                      onPress={() => setElsewhere(true)}
                    />
                  </View>
                </Card>
              ) : null}

              {centre ? (
                <>
                  <View style={styles.pad}>
                    <SearchField
                      value={query}
                      onChangeText={setQuery}
                      placeholder={`Search near ${area || "you"}: sushi, a name…`}
                    />
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                  >
                    {[{ key: null, label: "All", emoji: "✨" }, ...kinds].map(
                      (item) => {
                        const on = kind === item.key;

                        return (
                          <Pressable
                            key={item.key || "all"}
                            onPress={() => {
                              Haptics.selectionAsync().catch(() => {});
                              setKind(item.key);
                            }}
                            style={[styles.chip, on && styles.chipOn]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                          >
                            <Text style={styles.chipEmoji}>{item.emoji}</Text>
                            <Text
                              style={[styles.chipText, on && styles.chipTextOn]}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </ScrollView>

                  {mapAvailable ? (
                    <View style={styles.pad}>
                      <PlaceMap
                        places={places.slice(0, 60)}
                        me={me}
                        centre={centre}
                        selected={selected}
                        onPick={(id) => {
                          const place = places.find((p) => p.id === id);
                          if (place) openPlace(place);
                        }}
                      />
                    </View>
                  ) : null}

                  {placesBusy && places.length === 0 ? (
                    <View style={styles.lookingRow}>
                      <ActivityIndicator color={T.accent} />
                      <Text style={styles.lookingText}>
                        Finding spots near you…
                      </Text>
                    </View>
                  ) : null}

                  {filling && places.length > 0 ? (
                    <View style={styles.fillingRow}>
                      <ActivityIndicator size="small" color={T.label3} />
                      <Text style={styles.fillingText}>
                        Finding more around {area || "you"}…
                      </Text>
                    </View>
                  ) : null}

                  <Notice>{placesError}</Notice>

                  {!placesBusy &&
                  !filling &&
                  !placesError &&
                  places.length === 0 ? (
                    <Text style={styles.noneText}>
                      {query
                        ? `Nothing called “${query}” near ${area || "you"}.`
                        : "Nothing found here yet. Try another kind, or somewhere else."}
                    </Text>
                  ) : null}

                  <View style={styles.placeList}>
                    {places.slice(0, showCount).map((place) => (
                      <Press key={place.id} onPress={() => openPlace(place)}>
                        <Card
                          padded={false}
                          style={[
                            styles.placeCard,
                            selected?.id === place.id && styles.placeCardOn,
                          ]}
                        >
                          <Cover
                            uri={place.image}
                            kind={place.kind}
                            emoji={place.emoji}
                            style={styles.placeThumb}
                          />

                          <View style={styles.placeBody}>
                            <Text style={styles.placeName} numberOfLines={1}>
                              {place.name}
                            </Text>

                            <Text style={styles.placeMeta} numberOfLines={1}>
                              {[
                                kindLabel(place.kind),
                                place.cuisine?.[0],
                                distanceText(place.distance_m),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>

                            {place.address ? (
                              <Text
                                style={styles.placeAddress}
                                numberOfLines={1}
                              >
                                {place.address}
                              </Text>
                            ) : null}
                          </View>

                          <Icon name="chevron" size={16} color={T.label3} />
                        </Card>
                      </Press>
                    ))}
                  </View>

                  {places.length > showCount ? (
                    <View style={styles.pad}>
                      <Button
                        title={`Show more (${places.length - showCount})`}
                        kind="gray"
                        onPress={() => setShowCount((n) => n + 10)}
                      />
                    </View>
                  ) : null}

                  {places.length > 0 ? (
                    <Text style={styles.credit}>
                      Places from OpenStreetMap · photos from Wikimedia Commons
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          </>
        )}
      </Screen>

      {/* A PLACE IN FULL */}
      <Sheet
        visible={Boolean(viewing)}
        title={viewing?.name || ""}
        onCancel={() => setViewing(null)}
      >
        {viewing ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.gallery}
            >
              {(photos.length ? photos : [null]).map((uri, index) => (
                <Cover
                  key={uri || index}
                  uri={uri}
                  kind={viewing.kind}
                  emoji={viewing.emoji}
                  big
                  style={[styles.galleryPhoto, { width: screenW - 32 }]}
                />
              ))}
            </ScrollView>

            {photos.length > 1 ? (
              <Text style={styles.galleryCount}>
                {photos.length} photos · swipe
              </Text>
            ) : null}

            <Card padded={false}>
              <Cell
                leading={<Text style={styles.cellEmoji}>{viewing.emoji}</Text>}
                title={kindLabel(viewing.kind) || "Place"}
                subtitle={
                  [
                    viewing.cuisine?.join(", "),
                    distanceText(viewing.distance_m),
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />

              {viewing.address ? (
                <Cell
                  leading={<Icon name="pin" size={18} color={T.accent} />}
                  title={viewing.address}
                />
              ) : null}

              {viewing.hours ? (
                <Cell
                  leading={<Icon name="clock" size={18} color={T.accent} />}
                  title="Opening hours"
                  subtitle={viewing.hours}
                />
              ) : null}

              {viewing.phone ? (
                <Cell
                  leading={<Icon name="phone" size={18} color={T.accent} />}
                  title={viewing.phone}
                  chevron
                  onPress={() =>
                    Linking.openURL(
                      `tel:${viewing.phone.replace(/[^+\d]/g, "")}`,
                    ).catch(() => {})
                  }
                />
              ) : null}

              {viewing.website ? (
                <Cell
                  leading={<Icon name="globe" size={18} color={T.accent} />}
                  title="Website"
                  subtitle={viewing.website
                    .replace(/^https?:\/\//, "")
                    .replace(/\/$/, "")}
                  chevron
                  onPress={() =>
                    Linking.openURL(viewing.website).catch(() => {})
                  }
                />
              ) : null}

              <Cell
                leading={<Icon name="photos" size={18} color={T.accent} />}
                title="More photos and reviews"
                subtitle="Opens Google Maps"
                chevron
                onPress={() => googlePhotos(viewing)}
              />

              <Cell
                leading={<Icon name="navigate" size={18} color={T.accent} />}
                title="Directions"
                chevron
                onPress={() => openDirections(viewing)}
              />
            </Card>

            <Button
              title={`Ask ${them} to go`}
              icon="heart"
              onPress={() => startProposal(viewing, null)}
            />
          </>
        ) : null}
      </Sheet>

      {/* ASKING THEM */}
      <Sheet
        visible={Boolean(proposing)}
        title={proposing?.plan ? "Another time" : "Ask them out"}
        subtitle={
          proposing?.plan ? proposing.plan.title : proposing?.place?.name
        }
        onCancel={closeProposal}
        onSave={sendProposal}
        saveLabel="Send"
        saveDisabled={
          !day ||
          sending ||
          (!proposing?.plan && !proposing?.place && !planTitle.trim())
        }
        dirty={Boolean(day || note.trim())}
      >
        {!proposing?.plan ? (
          <Card padded={false}>
            <TextInput
              value={planTitle}
              onChangeText={setPlanTitle}
              placeholder="What's the plan? (Dinner, a walk…)"
              placeholderTextColor={T.label3}
              style={styles.field}
            />

            {!proposing?.place ? (
              <>
                <View style={styles.fieldLine} />
                <TextInput
                  value={planPlace}
                  onChangeText={setPlanPlace}
                  placeholder="Where? (optional)"
                  placeholderTextColor={T.label3}
                  style={styles.field}
                />
              </>
            ) : null}
          </Card>
        ) : null}

        <Text style={styles.pickLabel}>Which day?</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRow}
        >
          {days.map((item) => {
            const on = day === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setDay(item.value);
                }}
                style={[styles.dayChip, on && styles.dayChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.dayTop, on && styles.dayTextOn]}>
                  {item.top}
                </Text>
                <Text style={[styles.dayBottom, on && styles.dayTextOn]}>
                  {item.bottom}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.pickLabel}>What time?</Text>

        <View style={styles.timeRow}>
          {TIMES.map((item) => {
            const on = time === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTime(item.value);
                }}
                style={[styles.timeChip, on && styles.dayChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.timeLabel, on && styles.dayTextOn]}>
                  {item.label}
                </Text>
                <Text style={[styles.timeHint, on && styles.dayTextOn]}>
                  {item.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!proposing?.plan ? (
          <Card padded={false}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={`A note for ${them} (optional)`}
              placeholderTextColor={T.label3}
              style={[styles.field, styles.fieldTall]}
              multiline
              textAlignVertical="top"
            />
          </Card>
        ) : null}

        <Text style={styles.sendNote}>
          {them} gets it straight away. It's saved for you both once they say
          yes.
        </Text>

        <Button
          title={proposing?.plan ? "Send the new time" : `Ask ${them}`}
          icon="send"
          onPress={sendProposal}
          busy={sending}
          disabled={!day}
        />
      </Sheet>
    </>
  );
}

const styles = themedStyles(() => ({
  pad: {
    paddingHorizontal: 16,
    gap: 10,
  },

  flex: {
    flex: 1,
  },

  section: {
    gap: 12,
  },

  tabs: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },

  planCard: {
    marginHorizontal: 16,
    overflow: "hidden",
  },

  planCover: {
    height: 120,
    width: "100%",
  },

  planBody: {
    padding: 16,
    gap: 6,
  },

  planTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: T.label,
  },

  planMeta: {
    fontSize: 14,
    color: T.label2,
  },

  planNote: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label,
    fontStyle: "italic",
  },

  answerRow: {
    gap: 10,
    marginTop: 8,
  },

  answerSmall: {
    flexDirection: "row",
    gap: 10,
  },

  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },

  waitingText: {
    flex: 1,
    fontSize: 14,
    color: T.label2,
  },

  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: T.red,
  },

  confirmed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  confirmedText: {
    fontSize: 13,
    fontWeight: "600",
    color: T.green,
  },

  whereRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
  },

  whereText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: T.label,
  },

  link: {
    fontSize: 15,
    fontWeight: "600",
    color: T.accent,
  },

  askCard: {
    marginHorizontal: 16,
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },

  askEmoji: {
    fontSize: 40,
  },

  askTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: T.label,
  },

  askText: {
    fontSize: 15,
    lineHeight: 21,
    color: T.label2,
    textAlign: "center",
  },

  askButtons: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 8,
  },

  chips: {
    paddingHorizontal: 16,
    gap: 8,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.surface,
  },

  chipOn: {
    backgroundColor: T.accent,
  },

  chipEmoji: {
    fontSize: 15,
  },

  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: T.label,
  },

  chipTextOn: {
    color: "#FFFFFF",
  },

  lookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },

  lookingText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: T.label2,
  },

  fillingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: -4,
  },

  fillingText: {
    fontSize: 13,
    color: T.label3,
  },

  noneText: {
    fontSize: 15,
    color: T.label2,
    textAlign: "center",
    paddingHorizontal: 24,
  },

  placeList: {
    gap: 10,
  },

  placeCard: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    paddingRight: 14,
  },

  placeCardOn: {
    borderWidth: 2,
    borderColor: T.accent,
  },

  placeThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
  },

  coverFallback: {
    alignItems: "center",
    justifyContent: "center",
  },

  coverEmoji: {
    fontSize: 28,
  },

  coverEmojiBig: {
    fontSize: 64,
  },

  placeBody: {
    flex: 1,
    gap: 2,
  },

  placeName: {
    fontSize: 16,
    fontWeight: "700",
    color: T.label,
  },

  placeMeta: {
    fontSize: 13,
    color: T.label2,
  },

  placeAddress: {
    fontSize: 13,
    color: T.label3,
  },

  credit: {
    fontSize: 11,
    color: T.label3,
    textAlign: "center",
  },

  gallery: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    flexGrow: 0,
  },

  galleryPhoto: {
    height: 210,
  },

  galleryCount: {
    fontSize: 12,
    color: T.label2,
    textAlign: "center",
    marginTop: -6,
  },

  cellEmoji: {
    fontSize: 20,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  fieldTall: {
    minHeight: 84,
  },

  fieldLine: {
    height: 0.5,
    marginLeft: 16,
    backgroundColor: T.separator,
  },

  pickLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: T.label,
    marginBottom: -4,
  },

  dayRow: {
    gap: 8,
  },

  dayChip: {
    width: 56,
    height: 64,
    borderRadius: 16,
    backgroundColor: T.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  dayChipOn: {
    backgroundColor: T.accent,
  },

  dayTop: {
    fontSize: 12,
    fontWeight: "600",
    color: T.label2,
  },

  dayBottom: {
    fontSize: 20,
    fontWeight: "700",
    color: T.label,
  },

  dayTextOn: {
    color: "#FFFFFF",
  },

  timeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: T.surface,
    alignItems: "center",
  },

  timeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: T.label,
  },

  timeHint: {
    fontSize: 12,
    color: T.label2,
  },

  sendNote: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    textAlign: "center",
  },
}));
