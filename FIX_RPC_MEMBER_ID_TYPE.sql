-- IMMEDIATE FIX: Update RPC function to accept BIGINT member_id instead of UUID
-- Run this in Supabase SQL Editor to fix the "invalid input syntax for type uuid" error
-- Error Code 22P02 caused by members table using numeric IDs, not UUIDs

-- Step 1: Drop the old function with UUID parameter
DROP FUNCTION IF EXISTS public.update_member_images(UUID, TEXT, TEXT);

-- Step 2: Drop the new function with BIGINT parameter (if exists)
DROP FUNCTION IF EXISTS public.update_member_images(BIGINT, TEXT, TEXT);

-- Step 3: Create corrected function accepting BIGINT member_id
-- SECURITY DEFINER: Function runs with owner permissions, bypassing RLS policies
-- This allows anon users to update image URLs even though RLS blocks direct updates
CREATE OR REPLACE FUNCTION public.update_member_images(
  p_member_id BIGINT,
  p_profile_image_url TEXT DEFAULT NULL,
  p_id_proof_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  -- Update profile_image_url if provided
  IF p_profile_image_url IS NOT NULL THEN
    UPDATE public.members
    SET profile_image_url = p_profile_image_url
    WHERE id = p_member_id;
    v_updated_count := v_updated_count + FOUND::INT;
  END IF;

  -- Update id_proof_url if provided
  IF p_id_proof_url IS NOT NULL THEN
    UPDATE public.members
    SET id_proof_url = p_id_proof_url
    WHERE id = p_member_id;
    v_updated_count := v_updated_count + FOUND::INT;
  END IF;

  -- Return success
  RETURN QUERY SELECT 
    (v_updated_count > 0)::BOOLEAN,
    CASE 
      WHEN v_updated_count > 0 THEN 'Successfully updated ' || v_updated_count || ' field(s)'
      ELSE 'No updates made'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_member_images(BIGINT, TEXT, TEXT) TO anon, authenticated, service_role, public;

-- Step 5: Verify the function was created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_member_images';

-- Expected output: one row with routine_name='update_member_images' and routine_type='FUNCTION'
