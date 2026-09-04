-- Between Us: per-user notification opt-outs
--
-- Stores only the types someone has explicitly turned OFF, e.g.
-- {"inactivity": false, "quote_of_day": false}. A missing key
-- means the notification is enabled, so the default '{}' means
-- "everything on" and no backfill is needed for existing users.
--
-- Connection requests and connection-ended notices deliberately
-- aren't opt-outable -- they're core account events, and they
-- don't go through the preference check at all.
--
-- Safe to re-run.

ALTER TABLE users
	ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
