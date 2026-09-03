-- Between Us: schema for scheduled (cron-driven) notifications.
--
-- Run this once in the Neon SQL console before deploying the
-- updated Worker. Everything here is written to be safe to
-- re-run (IF NOT EXISTS / IF EXISTS), so it won't error if part
-- of it has already been applied.

-- ==========================================
-- 1. TRIVIA: drop the unused duplicate table
-- ==========================================
--
-- trivia_sessions and trivia_results were both created but never
-- wired into the API. trivia_sessions is the one going forward
-- (its defaults: score 0, total_questions 2, match how trivia
-- actually works today).

DROP TABLE IF EXISTS trivia_results;

-- ==========================================
-- 2. INACTIVITY: track when a user last used the app
-- ==========================================

ALTER TABLE users
	ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ==========================================
-- 3. GOALS: relationship goals with due dates
-- ==========================================
--
-- relationship_insights.goals is a flat text[] captured once at
-- onboarding, with no due date or status. This table is what the
-- "goals" notification actually reads from.

CREATE TABLE IF NOT EXISTS relationship_goals (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
	created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT,
	target_date DATE,
	status TEXT NOT NULL DEFAULT 'active',
	completed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationship_goals_connection_id_idx
	ON relationship_goals (connection_id);

-- ==========================================
-- 4. NOTIFICATIONS: dedupe key
-- ==========================================
--
-- The hourly cron re-evaluates the same events (e.g. "dream
-- overdue") every run. dedupe_key lets it INSERT ... ON CONFLICT
-- DO NOTHING instead of hand-rolling duplicate checks. NULL is
-- allowed and unconstrained, so existing rows (connection_request,
-- connection_unlinked) are unaffected.

ALTER TABLE notifications
	ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_idx
	ON notifications (user_id, dedupe_key)
	WHERE dedupe_key IS NOT NULL;
