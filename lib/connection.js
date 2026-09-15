import { useCallback, useState } from "react";
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

export function useIsConnected() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const key = connectionCacheKey(userId);

  const [connected, setConnected] = useState(() =>
    key ? getCachedData(key) : undefined,
  );

  useFocusEffect(
    useCallback(() => {
      if (!isLoaded || !isSignedIn || !userId) return;

      let cancelled = false;

      apiFetch(`/users/${userId}/connections`)
        .then((response) => response.json())
        .then((list) => {
          const isLinked =
            Array.isArray(list) &&
            list.some((item) => item?.status?.toLowerCase() === "accepted");

          if (!cancelled) {
            setConnected(isLinked);
            setCachedData(key, isLinked);
          }
        })
        .catch((error) => {
          console.log("CONNECTION STATUS ERROR:", error);
        });

      return () => {
        cancelled = true;
      };
    }, [isLoaded, isSignedIn, userId, key]),
  );

  return connected;
}
