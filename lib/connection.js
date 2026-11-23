import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { apiFetch } from "./api";
import { getCachedData, setCachedData } from "./dataCache";

/*
 * ==========================================
 * CONNECTION STATUS
 * ==========================================
 *
 * Most of Between Us only makes sense with a partner,
 * so screens need to know whether one exists.
 *
 * Returns true / false, or undefined while unknown.
 * It re-checks every time a screen comes into focus,
 * because the tab screens stay mounted: without this,
 * unlinking in Profile left Home and Dreams still
 * showing the old partner until the app restarted.
 */

export function connectionCacheKey(userId) {
  return userId ? `connected:${userId}` : null;
}

/*
 * Your accepted link: the link itself, null when there is
 * none, or undefined when the server could not say (offline,
 * a slow reply, a token being refreshed). Undefined must
 * change nothing: reading a failed request as "no partner"
 * is what used to flash "Find Your Person" at linked couples.
 */
export async function fetchLink(userId) {
  try {
    const response = await apiFetch(`/users/${userId}/connections`);

    if (!response.ok) return undefined;

    const list = await response.json();

    if (!Array.isArray(list)) return undefined;

    return (
      list.find((item) => item?.status?.toLowerCase() === "accepted") || null
    );
  } catch {
    return undefined;
  }
}

/*
 * As fetchLink, but if you were linked a moment ago, "no
 * link" only counts once a second look, a moment later,
 * agrees. A real unlink still shows within a couple of
 * seconds; a one-off odd reply never hides your partner.
 */
export async function confirmLink(userId, wasLinked) {
  const first = await fetchLink(userId);

  if (first !== null || !wasLinked) return first;

  await new Promise((resolve) => setTimeout(resolve, 1500));

  return fetchLink(userId);
}

export function useIsConnected() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const key = connectionCacheKey(userId);

  const [connected, setConnected] = useState(() =>
    key ? getCachedData(key) : undefined,
  );

  const known = useRef(connected);
  known.current = connected;

  useFocusEffect(
    useCallback(() => {
      if (!isLoaded || !isSignedIn || !userId) return;

      let cancelled = false;

      confirmLink(userId, known.current === true).then((link) => {
        /* Could not tell: keep what we knew. */
        if (cancelled || link === undefined) return;

        const isLinked = Boolean(link);

        setConnected(isLinked);
        setCachedData(key, isLinked);
      });

      return () => {
        cancelled = true;
      };
    }, [isLoaded, isSignedIn, userId, key]),
  );

  return connected;
}
