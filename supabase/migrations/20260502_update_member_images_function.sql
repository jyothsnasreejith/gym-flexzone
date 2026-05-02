-- Migration: Create RPC function to allow anon users to update member image URLs
-- This function is called from the public join flow to update profile and ID proof URLs
-- after the files are successfully uploaded to Supabase storage
-- FIXED: Accept BIGINT member_id instead of UUID (members table uses numeric IDs)

BEGIN;

-- Drop existing function if it exists (both old UUID and new BIGINT versions)
DROP FUNCTION IF EXISTS public.update_member_images(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_member_images(BIGINT, TEXT, TEXT);

-- Create function to update member image URLs
-- This allows anon role to update image URLs after successful upload
-- Updated to accept BIGINT member ID (not UUID)
-- SECURITY DEFINER: Function runs with owner permissions, bypassing RLS policies
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

-- Grant execution permission to anon role
GRANT EXECUTE ON FUNCTION public.update_member_images(BIGINT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Grant EXECUTE on the function to public (for testing)
GRANT EXECUTE ON FUNCTION public.update_member_images(BIGINT, TEXT, TEXT) TO public;

COMMIT;
