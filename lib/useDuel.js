import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@clerk/expo";
import { useFocusEffect } from "expo-router";

import { apiFetch } from "./api";
import { getCachedData, setCachedData } from "./dataCache";
import { onLive } from "./live";

/*
 * ==========================================
 * A DUEL, KEPT LIVE
 * ==========================================
 *
 * Paintball Standoff and Tank Duel both run through this.
 * While the screen is open it checks in every couple of
 * seconds when it is waiting on them (and now and then
 * otherwise, in case they start a rematch), at once when
 * their push lands, and when you come back to the app --
 * so both phones always show the same match.
 *
 * Every move is checked on the server; a move that lands
 * on a stale board is turned away and the real one shown.
 */

const TICK_MS = 2000;

export function useDuel(kind, { waitingOnThem }) {
  const { isLoaded, isSignedIn, userId } = useAuth();

  const cacheKey = userId ? `duel:${kind}:${userId}` : null;
  const cached = cacheKey ? getCachedData(cacheKey) : undefined;

  const [duel, setDuel] = useState(cached?.duel ?? null);
  const [score, setScore] = useState(
    cached?.score ?? { you: 0, them: 0, draws: 0 },
  );
  const [partnerName, setPartnerName] = useState(cached?.partnerName ?? "");
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = useRef(duel);
  const busyRef = useRef(false);

  const apply = useCallback(
    (data, name) => {
      if (!data) return;

      /* Only ever move forward: an older answer never wins. */
      const next = data.duel || null;
      const before = shown.current;

      if (
        before &&
        next &&
        before.id === next.id &&
        next.version < before.version
      ) {
        return;
      }

      shown.current = next;
      setDuel(next);

      if (data.score) setScore(data.score);

      if (cacheKey) {
        setCachedData(cacheKey, {
          duel: next,
          score: data.score,
          partnerName: name,
        });
      }
    },
    [cacheKey],
  );

  const nameRef = useRef(partnerName);
  nameRef.current = partnerName;

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;

    try {
      const [data, partner] = await Promise.all([
        apiFetch(`/users/${userId}/duels/${kind}`).then((r) =>
          r.ok ? r.json() : null,
        ),
        nameRef.current
          ? Promise.resolve(null)
          : apiFetch(`/users/${userId}/partner`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
      ]);

      const name =
        partner?.partner?.nickname?.trim() ||
        partner?.partner?.first_name?.trim() ||
        nameRef.current;

      if (name && name !== nameRef.current) setPartnerName(name);

      if (!busyRef.current) apply(data, name);

      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load the match.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, kind, apply]);

  const loadRef = useRef(load);
  loadRef.current = load;

  const waitingRef = useRef(waitingOnThem);
  waitingRef.current = waitingOnThem;

  useFocusEffect(
    useCallback(() => {
      loadRef.current();

      let ticks = 0;

      const timer = setInterval(() => {
        ticks += 1;

        if (busyRef.current || AppState.currentState !== "active") return;

        const current = shown.current;
        const waiting =
          !current ||
          current.status !== "playing" ||
          waitingRef.current(current);

        if (waiting || ticks % 3 === 0) loadRef.current();
      }, TICK_MS);

      const live = onLive((type, data) => {
        if (
          (type === "duel_turn" || type === "duel_over") &&
          (!data?.kind || data.kind === kind)
        ) {
          loadRef.current();
        }
      });

      const state = AppState.addEventListener("change", (next) => {
        if (next === "active") loadRef.current();
      });

      return () => {
        clearInterval(timer);
        live();
        state.remove();
      };
    }, [kind]),
  );

  const send = useCallback(
    async (path, body) => {
      if (!userId || busyRef.current) return null;

      busyRef.current = true;
      setBusy(true);
      setError("");

      try {
        const response = await apiFetch(
          `/users/${userId}/duels/${kind}${path}`,
          {
            method: "POST",
            body: JSON.stringify(body || {}),
          },
        );

        const data = await response.json().catch(() => ({}));

        /* Even a refusal carries the real match. */
        if (data?.duel) apply(data, nameRef.current);

        if (!response.ok) throw new Error(data?.error || "That didn't go.");

        return data.duel;
      } catch (err) {
        setError(err?.message || "That didn't go.");
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [userId, kind, apply],
  );

  const start = useCallback(() => send("", {}), [send]);

  const move = useCallback(
    (body) => (duel ? send(`/${duel.id}/move`, body) : null),
    [send, duel],
  );

  useEffect(() => {
    shown.current = duel;
  }, [duel]);

  return {
    duel,
    score,
    partnerName: partnerName || "Them",
    loading,
    busy,
    error,
    setError,
    start,
    move,
    reload: load,
  };
}
