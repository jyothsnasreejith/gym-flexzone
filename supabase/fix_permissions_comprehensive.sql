-- Migration: Comprehensive Permission Fix for Billing & Audit Logs
-- This ensures admins can Edit, Delete, and View History without 403 or duplicate data errors.

BEGIN;

-- 1. Enable RLS on tables if not already enabled
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Grant basic table permissions
GRANT ALL ON TABLE public.system_logs TO authenticated;
GRANT ALL ON TABLE public.bills TO authenticated;
GRANT ALL ON TABLE public.payments TO authenticated;

-- 3. Cleanup existing restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Admin full access to system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Admin full access to bills" ON public.bills;
DROP POLICY IF EXISTS "Admin full access to payments" ON public.payments;

-- 4. Create "Admin Full Access" policies using the standard profile role check

-- system_logs
CREATE POLICY "Admin full access to system_logs" 
ON public.system_logs FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- bills
CREATE POLICY "Admin full access to bills" 
ON public.bills FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- payments
CREATE POLICY "Admin full access to payments" 
ON public.payments FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

COMMIT;
