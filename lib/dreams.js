/*
 * ==========================================
 * DREAMS
 * ==========================================
 *
 * The drawn covers, the kinds, and the starters -- the
 * dreams a couple can say yes to in one tap, each with a
 * cover and the first few steps already written.
 */

/*
 * Covers by key. The key is what the API stores, so a
 * cover can be redrawn later without migrating anything.
 * `art: "mountains"` is the prototype's sunset range.
 */
export const COVERS = {
  sunset: { colours: ["#FFD3B0", "#FFB0C4", "#B9A2FF"], art: "mountains" },
  ocean: { colours: ["#7FD3FF", "#3A8DFF"], icon: "beach" },
  citrus: { colours: ["#FFD36E", "#FF8A4C"], icon: "food" },
  violet: { colours: ["#C8B4FF", "#8456F5"], icon: "music" },
  mint: { colours: ["#8FE9C5", "#1FB884"], icon: "house" },
  night: { colours: ["#4A2D5C", "#2B2350"], icon: "moon" },
  rose: { colours: ["#FFC2D4", "#D9577A"], icon: "heart" },
  gold: { colours: ["#F6E3B4", "#C9973F"], icon: "savings" },
};

export const COVER_KEYS = Object.keys(COVERS);

export const KINDS = [
  "Travel",
  "At home",
  "Experience",
  "Build",
  "Health",
  "Other",
];

/* A kind's cover, for dreams saved before covers existed. */
const KIND_COVER = {
  Travel: "ocean",
  "At home": "citrus",
  Experience: "violet",
  Build: "mint",
  Health: "rose",
};

export function coverFor(dream) {
  if (dream?.cover && COVERS[dream.cover]) return dream.cover;

  return KIND_COVER[dream?.category] || "sunset";
}

function steps(...titles) {
  return titles.map((title, index) => ({
    id: `s${index + 1}`,
    title,
    done: false,
  }));
}

export const STARTERS = [
  {
    id: "obudu",
    title: "Road trip to Obudu Ranch",
    kind: "Travel",
    cover: "sunset",
    icon: "car",
    steps: steps(
      "Pick a long weekend",
      "Book the cable car",
      "Save for it together",
      "Make a road-trip playlist",
      "Find somewhere to stay",
    ),
  },
  {
    id: "zanzibar",
    title: "Weekend in Zanzibar",
    kind: "Travel",
    cover: "ocean",
    icon: "beach",
    steps: steps(
      "Agree on the dates",
      "Book the flights",
      "Find a place by the water",
      "Plan one day of doing nothing",
    ),
  },
  {
    id: "cuisines",
    title: "Cook 10 cuisines",
    kind: "At home",
    cover: "citrus",
    icon: "food",
    steps: steps(
      "Choose the ten",
      "Cook the first one",
      "Halfway: five down",
      "Cook the tenth",
    ),
  },
  {
    id: "salsa",
    title: "Learn salsa",
    kind: "Experience",
    cover: "violet",
    icon: "music",
    steps: steps(
      "Find a class",
      "Go to the first lesson",
      "Practise at home",
      "Dance it out somewhere",
    ),
  },
  {
    id: "home",
    title: "Our first home",
    kind: "Build",
    cover: "mint",
    icon: "house",
    steps: steps(
      "Agree on what matters",
      "Set a monthly saving",
      "Pick the area",
      "View five places",
    ),
  },
  {
    id: "lights",
    title: "See the northern lights",
    kind: "Travel",
    cover: "night",
    icon: "moon",
    steps: steps(
      "Choose where and when",
      "Start a trip fund",
      "Book it",
      "Pack for the cold",
    ),
  },
  {
    id: "10k",
    title: "Run a 10k together",
    kind: "Health",
    cover: "rose",
    icon: "run",
    steps: steps(
      "Sign up for a race",
      "Run 3k without stopping",
      "Run 5k",
      "Run 8k",
      "Cross the line together",
    ),
  },
  {
    id: "book",
    title: "Read the same book",
    kind: "At home",
    cover: "gold",
    icon: "book",
    steps: steps(
      "Pick the book",
      "Halfway check-in",
      "Finish it",
      "Talk it through over dinner",
    ),
  },
  {
    id: "volunteer",
    title: "Volunteer together",
    kind: "Experience",
    cover: "rose",
    icon: "hands",
    steps: steps(
      "Choose a cause",
      "Find a place that needs help",
      "Go the first time",
    ),
  },
  {
    id: "garden",
    title: "Grow something",
    kind: "At home",
    cover: "mint",
    icon: "leaf",
    steps: steps(
      "Pick what to grow",
      "Get pots and soil",
      "Plant it",
      "Eat or gift the first harvest",
    ),
  },
];

/* How far along a dream is: { done, total, value }. */
export function progressOf(dream) {
  const list = Array.isArray(dream?.steps) ? dream.steps : [];
  const done = list.filter((step) => step.done).length;

  return {
    done,
    total: list.length,
    value: list.length ? done / list.length : 0,
  };
}

/* A step id that will not clash with the others. */
export function newStepId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function hopingFor(date) {
  if (!date) return null;

  const parsed = new Date(String(date).slice(0, 10) + "T12:00:00");

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
