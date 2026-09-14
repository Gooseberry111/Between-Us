-- Between Us: appreciation notes and the weekly check-in
--
-- The Worker also creates these on demand (see ensureSchema),
-- because applying migrations needs database access the deploy
-- pipeline does not have. This file stays the canonical
-- definition for setting a database up from scratch.
--
-- Note both unique indexes are NOT partial, so a plain
-- ON CONFLICT can infer them.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS appreciations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
	from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	message TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appreciations_connection_idx
	ON appreciations (connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS checkins (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	week_key TEXT NOT NULL,
	rating INTEGER NOT NULL,
	note TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_week_idx
	ON checkins (user_id, week_key);

CREATE INDEX IF NOT EXISTS checkins_connection_idx
	ON checkins (connection_id, week_key DESC);
