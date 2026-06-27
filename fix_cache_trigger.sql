CREATE OR REPLACE FUNCTION public.trg_invalidate_all_rule_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Global settings changed — nuke the entire cache
  DELETE FROM public.rule_inheritance_cache WHERE true;
  RETURN COALESCE(NEW, OLD);
END;
$$;
