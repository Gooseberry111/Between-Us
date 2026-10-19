import { useEffect, useState } from "react";
import { useAuth } from "@clerk/expo";

import { apiFetch } from "./api";
import { getCachedData, setCachedData } from "./dataCache";

/*
 * ==========================================
 * YOUR NAME
 * ==========================================
 *
 * What you are called -- your nickname, else your first
 * name -- for avatars that should show your initial
 * rather than a "Y" for "You". Fetched once, then cached.
 */
export function useMyName() {
  const { userId } = useAuth();

  const cacheKey = userId ? `me-name:${userId}` : null;

  const [name, setName] = useState((cacheKey && getCachedData(cacheKey)) || "");

  useEffect(() => {
    if (!userId || name) return undefined;

    let live = true;

    apiFetch(`/users/${userId}/profile`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const value =
          data?.profile?.nickname?.trim() ||
          data?.profile?.first_name?.trim() ||
          "";

        if (!live || !value) return;

        setName(value);
        setCachedData(cacheKey, value);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [userId, cacheKey, name]);

  return name;
}
