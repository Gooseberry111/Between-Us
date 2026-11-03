import { useEffect, useState } from "react";
import { useAuth } from "@clerk/expo";

import { apiFetch } from "./api";

/*
 * ==========================================
 * FEATURES
 * ==========================================
 *
 * The heart of the app is always there: Home, tonight's
 * questions, Timeline, Dreams, Insights, Notes, Dates,
 * Goals, Repair, hugs and moods. Everything else is an
 * extra you switch on in Features, so each couple's app
 * holds what their relationship actually needs.
 *
 * A few extras start on; the rest wait to be added, with
 * suggestions from what you told the app about yourselves.
 */

export const FEATURES = [
  {
    key: "games",
    title: "Games",
    text: "Four in a Row, This or That, Who's More Likely To and trivia",
    icon: "sparkle",
    route: "/games",
    on: true,
  },
  {
    key: "letters",
    title: "Letters",
    text: "Write one now, sealed until a day you choose",
    icon: "mail",
    route: "/letters",
    on: true,
  },
  {
    key: "recap",
    title: "Monthly recap",
    text: "Your month together, played back like a film",
    icon: "photos",
    route: "/recap",
    on: true,
  },
  {
    key: "taps",
    title: "Little somethings",
    text: "Tap their circle on Home to send a kiss, or that you miss them",
    icon: "heart",
    on: true,
  },
  {
    key: "challenge",
    title: "Love challenges",
    text: "One small thing a week, chosen for how they like to be loved",
    icon: "flame",
    on: false,
  },
  {
    key: "gifts",
    title: "Gift ideas",
    text: "A private list, with a nudge before birthdays and anniversaries",
    icon: "heartOutline",
    route: "/wishlist",
    on: false,
  },
  {
    key: "lists",
    title: "Shared lists",
    text: "Groceries, the house, things to watch, ticked off by either of you",
    icon: "list",
    route: "/lists",
    on: false,
  },
  {
    key: "distance",
    title: "Far apart",
    text: "Both your local times, and a countdown to when you next meet",
    icon: "globe",
    route: "/distance",
    on: false,
  },
];

/* Why a feature might suit this couple, from what they shared. */
export function suggestionFor(key, { status, type, focus = [] }) {
  const has = (word) =>
    focus.some((area) => String(area).toLowerCase().includes(word));

  const rel = `${status || ""} ${type || ""}`.toLowerCase();

  switch (key) {
    case "distance":
      return rel.includes("long distance")
        ? "You said you're long distance"
        : null;
    case "gifts":
      return has("gift")
        ? "You asked for help with gift ideas"
        : has("special dates")
          ? "Good for remembering special dates"
          : null;
    case "lists":
      return rel.includes("married") || rel.includes("engaged")
        ? "Handy when you share a home"
        : null;
    case "challenge":
      return has("growth") || has("understanding")
        ? "You wanted to grow together"
        : null;
    case "games":
      return has("quality time") ? "You asked for quality time" : null;
    case "letters":
      return has("communication") ? "Another way to say things" : null;
    default:
      return null;
  }
}

/*
 * Shared across screens: one fetch, every subscriber
 * updates when a feature is switched.
 */
let state = null;
const listeners = new Set();

function publish(next) {
  state = next;
  listeners.forEach((listener) => listener(next));
}

function resolve(saved) {
  const out = {};

  FEATURES.forEach((feature) => {
    out[feature.key] =
      saved && typeof saved[feature.key] === "boolean"
        ? saved[feature.key]
        : feature.on;
  });

  return out;
}

export function useFeatures() {
  const { userId } = useAuth();
  const [value, setValue] = useState(state);

  useEffect(() => {
    listeners.add(setValue);

    if (userId && !state) {
      apiFetch(`/users/${userId}/features`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;

          publish({
            on: resolve(data.features),
            context: {
              status: data.relationship_status,
              type: data.relationship_type,
              focus: data.focus_areas || [],
            },
          });
        })
        .catch(() => {});
    }

    return () => listeners.delete(setValue);
  }, [userId]);

  const enabled = (key) =>
    value
      ? Boolean(value.on[key])
      : Boolean(FEATURES.find((f) => f.key === key)?.on);

  const set = async (key, on) => {
    const previous = state;

    publish({
      on: { ...(state?.on || resolve(null)), [key]: on },
      context: state?.context || {},
    });

    try {
      const response = await apiFetch(`/users/${userId}/features`, {
        method: "PUT",
        body: JSON.stringify({ clerk_id: userId, features: { [key]: on } }),
      });

      if (!response.ok) throw new Error();
    } catch {
      publish(previous);
    }
  };

  return { ready: Boolean(value), enabled, set, context: value?.context || {} };
}
