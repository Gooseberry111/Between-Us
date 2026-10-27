-- Between Us: Four in a Row
--
-- One game at a time per couple, played turn by turn.
-- The board is 42 characters, top row first: '.' empty,
-- 'a' the player who started, 'b' the other. `moves` is
-- also the version a move must match, so two taps that
-- race each other cannot both land.
--
-- The Worker creates this on demand (ensureSchema); this
-- file records the shape. Safe to re-run.

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'four',
  board TEXT NOT NULL,
  player_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turn UUID,
  status TEXT NOT NULL DEFAULT 'playing',
  winner UUID,
  winning TEXT,
  last_move INTEGER,
  moves INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_connection_idx
  ON games (connection_id, created_at DESC);
