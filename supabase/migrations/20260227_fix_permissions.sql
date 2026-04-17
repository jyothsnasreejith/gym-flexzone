-- Migration: Fix permissions for sequences and add-on related tables
-- This ensures that the web app can correctly insert into pivot tables that use sequences.

BEGIN;

-- 1. Grant USAGE and SELECT on ALL sequences in the public schema
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 2. Grant ALL on specific tables to roles
GRANT ALL ON public.member_add_ons TO authenticated;
GRANT ALL ON public.member_add_ons TO service_role;
GRANT ALL ON public.member_add_ons TO anon;

GRANT ALL ON public.member_dependents TO authenticated;
GRANT ALL ON public.member_dependents TO service_role;
GRANT ALL ON public.member_dependents TO anon;

GRANT ALL ON public.add_ons TO authenticated;
GRANT ALL ON public.add_ons TO service_role;
GRANT ALL ON public.add_ons TO anon;

-- 3. Explicitly allow the sequence usage if specific name is known
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'member_add_ons_id_seq') THEN
        GRANT USAGE, SELECT ON SEQUENCE public.member_add_ons_id_seq TO authenticated;
        GRANT USAGE, SELECT ON SEQUENCE public.member_add_ons_id_seq TO service_role;
    END IF;
END $$;

COMMIT;
