import { apiFetch } from "./api";

/*
 * ==========================================
 * ACTIVITY
 * ==========================================
 *
 * What one of you did, as the other sees it on Home:
 * where each kind leads, how long ago it was, and the
 * two things the other person can do to a row -- open it
 * (which marks it read) and love it.
 */

/* Where tapping a row goes. A dream opens its own sheet. */
export function routeFor(item) {
  switch (item?.kind) {
    case "note":
      return "/appreciations";
    case "answered":
      return "/daily-question";
    case "dream_added":
      return item.target_id
        ? { pathname: "/(tabs)/dreams", params: { open: item.target_id } }
        : "/(tabs)/dreams";
    case "dream_done":
      return "/completed-dreams";
    case "memory":
      return "/(tabs)/memories";
    case "repair":
      return "/repair";
    case "trivia":
      return "/trivia-history";
    case "date":
      return "/dates";
    default:
      return null;
  }
}

export function timeAgo(iso) {
  const then = new Date(iso).getTime();

  if (Number.isNaN(then)) return "";

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);

  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export async function loadActivity(
  userId,
  { who = "partner", limit = 20 } = {},
) {
  const response = await apiFetch(
    `/users/${userId}/activity?who=${who}&limit=${limit}`,
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Unable to load activity.");
  }

  return { items: data?.items || [], unread: data?.unread || 0 };
}

/* { loved } and/or { read }. Resolves to the updated row. */
export async function updateActivity(userId, id, change) {
  const response = await apiFetch(`/users/${userId}/activity/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ clerk_id: userId, ...change }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "That didn't save.");
  }

  return data?.item;
}

/*
 * Opening and loving, shared by Home and the full list.
 * Both change the row at once and save behind it; a heart
 * that fails to save is taken back.
 */
export function activityHandlers({ userId, setItems, router }) {
  const patch = (id, change) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );

  const open = (item) => {
    if (!item.read) {
      patch(item.id, { read: true });

      updateActivity(userId, item.id, { read: true }).catch(() => {});
    }

    const route = routeFor(item);

    if (route) router.push(route);
  };

  const love = (item, loved) => {
    patch(item.id, { loved, read: true });

    updateActivity(userId, item.id, { loved }).catch(() =>
      patch(item.id, { loved: !loved }),
    );
  };

  return { open, love };
}
