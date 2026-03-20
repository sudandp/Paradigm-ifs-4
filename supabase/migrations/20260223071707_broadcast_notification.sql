-- Create an RPC to broadcast a notification to all users
CREATE OR REPLACE FUNCTION broadcast_notification(
  p_message text,
  p_type text,
  p_severity text,
  p_metadata jsonb,
  p_link_to text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, message, type, severity, metadata, link_to)
  SELECT id, p_message, p_type, p_severity, p_metadata, p_link_to
  FROM users;
END;
$$;
