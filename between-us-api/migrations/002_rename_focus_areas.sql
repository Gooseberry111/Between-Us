-- Between Us: rename relationship_insights.goals -> focus_areas
--
-- The onboarding question this column stores answers to is
-- "What would you like Between Us to help with?" (Communication,
-- Date Ideas, Quality Time, etc.) -- a set of app-usage focus
-- areas, not goals with due dates. It shared a name with the
-- new relationship_goals table/feature, which IS about tracked
-- goals with due dates and status. Renaming this column so the
-- two concepts stop colliding.
--
-- Safe to re-run.

ALTER TABLE relationship_insights
	RENAME COLUMN goals TO focus_areas;
