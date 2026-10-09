# Design changes

Rebuilding the presentation layer of Between Us against `prototype/between-us-design-system-prompt.md` and `prototype/between-us-playground.html`. Data models, endpoints, auth, routes and business logic are untouched.

## Audit

What exists today, and where it lands in the new design.

| Current screen | File | Becomes |
|---|---|---|
| Home | `app/(tabs)/home.js` | Home: bond hero, tonight's question, mood, quick actions, Coming up, From partner |
| Dates | `app/(tabs)/dates.js` | Stays a tab; restyle pending |
| Dreams | `app/(tabs)/dreams.js` | Dreams board: counter, featured dream, starters — pending |
| Insights | `app/(tabs)/insights.js` | Venn + comparison cards — pending |
| Profile | `app/(tabs)/profile.js` | Settings-style groups — pending |
| Memories | `app/(tabs)/memories.js` (off the tab bar) | Timeline: segmented filter, grouped by date — pending |
| Daily question | `app/daily-question.js` | Nightly ritual: answer, reveal, streak, plan — pending |
| Appreciations | `app/appreciations.js` | Reached as the Note quick action |
| Check-in | `app/check-in.js` | Folded into the Home mood check-in; screen stays reachable |
| Goals, special dates, trivia, connection, find person, notifications, onboarding, legal | various | Restyle pending; all stay reachable |

Shared: `lib/api.js`, `lib/dataCache.js`, `lib/connection.js`, `lib/profileProgress.js`, `lib/validation.js` — all unchanged.

## Added

- [Theme] Bubblegum tokens: accent `#F03FA9`, you `#9B6BFF`, app background `#F2ECF4`, iOS labels, fills, separators, status colours. Files: `lib/theme.js`
- [Shared] UI primitives: `Press` (dim 72% + scale 97% in 80ms), `Screen`, `NavBar`, `GlassButton`, `LargeTitle`, `SectionHeader`, `Card`, `Group`, `Cell`, `Button` (filled/tinted/gray/plain/destructive), `Chip`, `Segmented`, `Avatar`, `Empty`, `motionAllowed`. Files: `components/ui.js`
- [Home] Bond hero: day count in accent, names in serif italic, both avatars with you-dashed and partner-solid rings, live thread, hold-to-hug (1.2s) with a pulse travelling to the partner, streak chip. Component: `BondHero`. Files: `components/BondHero.js` · **Needs backend: hug delivery, partner presence dot**
- [Home] Mood check-in with the chosen mood as a badge on the user's avatar. Files: `app/(tabs)/home.js` · **Needs backend: shared mood (currently local state only, nothing is sent)**
- [Home] Tonight's question card with the partner's answer blurred until you reply. Files: `app/(tabs)/home.js`
- [Home] Contacts-style quick actions: Note, Date, Memory, Goals. Files: `app/(tabs)/home.js`
- [Home] Coming up list, from date plans and server-computed reminders. Files: `app/(tabs)/home.js`
- [Tooling] `scripts/check-references.js` — parses every file for components used but not imported, and `styles.x` that does not exist. Bundling does not catch either; both have crashed this app before.

## Changed

- [Tab bar] Now a floating frosted capsule inset from the edges, with a soft pill behind the active tab and the accent-filled icon. Files: `app/(tabs)/_layout.js`
- [Home] Rebuilt on the new primitives: flat white surfaces on the tinted ground, no borders or heavy shadows. Files: `app/(tabs)/home.js`
- [Home] Unlinked state is now one empty state with a first action instead of a welcome card plus locked tiles. Files: `app/(tabs)/home.js`
- [Home] "Finish your profile" is a grouped-list row rather than a large plum card. Files: `app/(tabs)/home.js`

## Removed

UI only. No endpoint or table was touched.

- [Home] Greeting "Good morning, {name}". Reason: replaced by the date line and the bond hero. Files: `app/(tabs)/home.js`
- [Home] Stat tiles (days together, memories, streak). Reason: the day count moves into the hero, the streak becomes a chip, and a "0 memories" tile is a bad first impression. Files: `app/(tabs)/home.js`
- [Home] The maroon partner card ("Dating / Keep choosing each other"). Reason: folded into the bond hero. Files: `app/(tabs)/home.js`
- [Home] The six-tile quick access grid. Reason: replaced by four contact-card actions; Insights and Timeline duplicated the tab bar. Files: `app/(tabs)/home.js`
- [Home] "Your week" summary card and the "Coming up" countdown card. Reason: Coming up is now a grouped list; the weekly numbers return on Insights. Files: `app/(tabs)/home.js` · the `/users/:id/week` endpoint is untouched and still serves them
- [Home] Today's prompt card and the closing quote card. Reason: the question card and quick actions carry the same intent without the filler. Files: `app/(tabs)/home.js`

## Moved

- [Home → Quick actions] Appreciations is now "Note"; Memories is now "Memory"; Dates and Goals keep their names. Files: `app/(tabs)/home.js`
- [Home → Insights] Weekly counts. Pending.

## Needs backend

- **Hug delivery** — holding the heart animates locally and calls `onHug`, which does nothing yet. Needs an endpoint and a push to the partner. Placeholder: `onHug` in `app/(tabs)/home.js`
- **Shared mood** — the partner must receive the mood for the avatar badge to mean anything. Placeholder: `mood` state in `app/(tabs)/home.js`
- **Partner presence** — the online dot is wired to `partnerOnline`, which nothing sets. Component: `BondHero`
- **Partner activity feed** — "From {partner}" currently shows the user's own notifications, which is close but not the same thing. Placeholder: `activity` in `app/(tabs)/home.js`
- **Dream starters** — suggested dreams with Add buttons need a source.

## Review

Kept and restyled rather than removed, pending your call:

- [Home] The notification bell. The design shows one; keeping it.
- [Memories] The screen is off the tab bar but still reachable from Profile and Connection. The design calls Timeline a tab — needs a decision on whether Timeline returns as a tab in place of something else.
