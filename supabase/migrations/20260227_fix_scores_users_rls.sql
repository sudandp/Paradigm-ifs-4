-- Create a database view or RPC that securely bypasses RLS for the users table when fetching scores

-- Safest approach: create a view that joins the tables and applies a policy, or a security-definer function
CREATE OR REPLACE FUNCTION get_employee_scores_with_users(p_month DATE)
RETURNS TABLE (
  score_id UUID,
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  user_photo_url TEXT,
  performance_score INTEGER,
  attendance_score INTEGER,
  response_score INTEGER,
  overall_score INTEGER,
  tiebreaker_score INTEGER,
  role_category TEXT,
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id as score_id,
    s.user_id,
    u.name as user_name,
    u.role_id as user_role,
    u.photo_url as user_photo_url,
    s.performance_score,
    s.attendance_score,
    s.response_score,
    s.overall_score,
    COALESCE(s.tiebreaker_score, 0) as tiebreaker_score,
    s.role_category,
    s.calculated_at,
    s.created_at
  FROM employee_scores s
  JOIN users u ON u.id = s.user_id
  WHERE s.month = p_month
  ORDER BY s.overall_score DESC, s.tiebreaker_score DESC;
$$;
