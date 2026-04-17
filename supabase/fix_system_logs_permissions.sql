-- Migration: Fix permissions for system_logs table
-- This allows admins to insert logs and view edit history.

BEGIN;

-- 1. Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 2. Grant permissions
GRANT ALL ON TABLE public.system_logs TO authenticated;
GRANT ALL ON TABLE public.system_logs TO service_role;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Admin full access to system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.system_logs;

-- 4. Create Policies

-- Policy: Allow authenticated users (Admins) to read logs
-- We check against the profiles table for the 'admin' role
CREATE POLICY "Admin full access to system_logs" 
ON public.system_logs FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Optional: Allow direct inserts if needed for non-admins (commented out by default)
-- CREATE POLICY "Anyone can insert logs" ON public.system_logs FOR INSERT TO authenticated WITH CHECK (true);

COMMIT;
