-- Migration: Create replace_member_add_ons RPC
-- This RPC allows atomic replacement of a member's add-ons.

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_member_add_ons(
  p_member_id BIGINT,
  p_add_on_ids JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Ensures it runs with elevated privileges if needed
AS $$
BEGIN
  -- 1. Delete existing add-ons for this member
  DELETE FROM public.member_add_ons WHERE member_id = p_member_id;

  -- 2. If no new add-ons, we are done
  IF p_add_on_ids IS NULL OR jsonb_array_length(p_add_on_ids) = 0 THEN
    RETURN;
  END IF;

  -- 3. Insert new add-ons
  INSERT INTO public.member_add_ons (member_id, add_on_id)
  SELECT p_member_id, (id_val::TEXT)::UUID
  FROM jsonb_array_elements_text(p_add_on_ids) AS id_val;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.replace_member_add_ons(BIGINT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_member_add_ons(BIGINT, JSONB) TO service_role;

COMMIT;
