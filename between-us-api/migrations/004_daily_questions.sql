-- Between Us: daily question for couples
--
-- One shared question per day. Each person answers for
-- themselves, and a partner's answer only unlocks once
-- you've written your own -- that reciprocity is the
-- whole point, and it's what gives someone a reason to
-- open the app on a day when nothing else happened.
--
-- The questions themselves live in the Worker as a
-- rotating list, so there's no catalogue table to seed.
-- question_key is stored per answer so history stays
-- readable even if that list is reordered later.
--
-- Note: the unique index below is deliberately NOT
-- partial, so a plain ON CONFLICT (user_id, question_date)
-- can infer it. A partial index needs its predicate
-- restated in the ON CONFLICT clause, which is exactly
-- what silently broke every scheduled notification.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS daily_answers (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	question_date DATE NOT NULL,
	question_key TEXT NOT NULL,
	answer TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_answers_user_date_idx
	ON daily_answers (user_id, question_date);

CREATE INDEX IF NOT EXISTS daily_answers_connection_date_idx
	ON daily_answers (connection_id, question_date DESC);
0