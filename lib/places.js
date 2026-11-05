import { apiFetch } from "./api";
import { getCachedData, setCachedData } from "./dataCache";

/*
 * ==========================================
 * DATE SPOTS NEAR YOU
 * ==========================================
 *
 * Every place in your area comes down in one go, and the
 * Dates screen filters and searches it on the phone, so
 * changing a chip or typing a name is instant and asks
 * nobody anything.
 *
 * Only one look runs at a time, across the whole app. A
 * look asked for while another runs waits its turn, and a
 * newer one replaces it in the queue, so the map service
 * is never asked about two places at once.
 *
 * The first look at a new area is quick and partial (the
 * few km around you); `full` then fetches the whole
 * neighbourhood, which the server keeps for a week.
 *
 * Home warms this up when it opens, if location is already
 * allowed, so Dates usually has your area ready.
 */

let Location = null;

try {
  // eslint-disable-next-line global-require
  Location = require("expo-location");
  if (!Location?.getForegroundPermissionsAsync) Location = null;
} catch {
  Location = null;
}

export { Location };

const cacheKey = (point) =>
  `places-area:${point.lat.toFixed(2)}:${point.lon.toFixed(2)}`;

/* What this session already has for here, if anything. */
export function knownArea(point) {
  return point ? getCachedData(cacheKey(point)) : undefined;
}

/* Metres between two points, near enough for "has it moved". */
export function metresBetween(a, b) {
  if (!a || !b) return Infinity;

  const r = 6371000;
  const x =
    ((b.lon - a.lon) * Math.PI * Math.cos((a.lat * Math.PI) / 180)) / 180;
  const y = ((b.lat - a.lat) * Math.PI) / 180;

  return Math.sqrt(x * x + y * y) * r;
}

let running = null;
let queued = null;

function runNext() {
  running = null;

  if (!queued) return;

  const job = queued;
  queued = null;
  start(job);
}

function start(job) {
  running = job;

  job.run().then(job.resolve, job.reject).finally(runNext);
}

/* One at a time; the same look asked twice is shared. */
function single(key, run) {
  if (running?.key === key) return running.promise;
  if (queued?.key === key) return queued.promise;

  const job = { key, run };
  job.promise = new Promise((resolve, reject) => {
    job.resolve = resolve;
    job.reject = reject;
  });

  if (!running) {
    start(job);
  } else {
    /* An older wait is no longer wanted: it settles empty. */
    queued?.resolve(null);
    queued = job;
  }

  return job.promise;
}

/*
 * Resolves to { places, kinds, area, partial }, or null if
 * a newer look took its place in the queue.
 */
export function fetchArea(userId, point, { full = false } = {}) {
  const key = `${point.lat.toFixed(3)},${point.lon.toFixed(3)}:${full ? "full" : "quick"}`;

  return single(key, async () => {
    const params = new URLSearchParams({
      lat: String(point.lat),
      lon: String(point.lon),
      radius: "6000",
      all: "1",
    });

    if (full) params.set("full", "1");

    const response = await apiFetch(
      `/users/${userId}/places?${params.toString()}`,
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || "The map service is busy.");
    }

    const result = {
      places: Array.isArray(data.places) ? data.places : [],
      kinds: Array.isArray(data.kinds) ? data.kinds : [],
      area: data.area || null,
      partial: Boolean(data.partial),
    };

    /* A partial look never replaces a full one. */
    const before = knownArea(point);
    if (!before || before.partial || !result.partial) {
      setCachedData(cacheKey(point), result);
    }

    return result;
  });
}

/*
 * From Home: if location is already allowed (never asking
 * here), quietly fetch the area around where the phone
 * last was, so Dates opens with it ready.
 */
let warmed = false;

export async function warmPlaces(userId) {
  if (warmed || !userId || !Location) return;

  warmed = true;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== "granted") return;

    const last = await Location.getLastKnownPositionAsync();

    if (!last?.coords) return;

    const point = { lat: last.coords.latitude, lon: last.coords.longitude };

    if (knownArea(point) && !knownArea(point).partial) return;

    /* Quick first, so Dates opened meanwhile has something. */
    const quick = knownArea(point) || (await fetchArea(userId, point));

    if (quick?.partial) await fetchArea(userId, point, { full: true });
  } catch {
    /* Dates will look for itself */
  }
}
