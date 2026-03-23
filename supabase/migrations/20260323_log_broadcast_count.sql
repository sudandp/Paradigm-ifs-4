
-- Update broadcast_notification to be more robust and log counts
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
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO public.notifications (user_id, message, type, severity, metadata, link_to)
  SELECT id, p_message, p_type, p_severity, p_metadata, p_link_to
  FROM public.users;
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  -- We can't easily see RAISE NOTICE in the client, but it's good for PG logs
  RAISE NOTICE 'Broadcast notification inserted % rows', v_inserted_count;
END;
$$;
