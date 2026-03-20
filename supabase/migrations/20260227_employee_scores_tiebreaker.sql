-- Add tiebreaker_score to employee_scores table for breaking overall score ties (e.g. tracking total clocked-in minutes)

ALTER TABLE public.employee_scores
ADD COLUMN IF NOT EXISTS tiebreaker_score INTEGER NOT NULL DEFAULT 0;

-- Optional: Re-index if performance requires, since sorting now depends on tiebreaker_score
-- DROP INDEX IF EXISTS idx_employee_scores_user_month;
-- CREATE INDEX idx_employee_scores_user_month ON public.employee_scores(user_id, month DESC, overall_score DESC, tiebreaker_score DESC);
