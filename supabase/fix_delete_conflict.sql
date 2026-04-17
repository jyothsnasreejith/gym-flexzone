-- SQL Script: Fix Permanent Delete Conflict by adding CASCADE
-- Run this in your Supabase SQL Editor

-- 1. Identify and drop existing FK constraints on tables referencing 'members'
-- (Note: Constraint names might vary, so we attempt common names or use a safe approach)

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'members'
          AND ccu.column_name = 'id'
          AND kcu.column_name IN ('member_id', 'converted_member_id')
    ) LOOP
        EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
END $$;

-- 2. Re-create foreign keys with ON DELETE CASCADE

-- Bills
ALTER TABLE bills 
ADD CONSTRAINT bills_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Payments
ALTER TABLE payments 
ADD CONSTRAINT payments_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Member Health
ALTER TABLE member_health 
ADD CONSTRAINT member_health_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Member Add-ons
ALTER TABLE member_add_ons 
ADD CONSTRAINT member_add_ons_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Member Attendance
ALTER TABLE member_attendance 
ADD CONSTRAINT member_attendance_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Member Packages
ALTER TABLE member_packages 
ADD CONSTRAINT member_packages_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Member Dependents
ALTER TABLE member_dependents 
ADD CONSTRAINT member_dependents_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Attendance
ALTER TABLE attendance 
ADD CONSTRAINT attendance_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Trainer Tasks
ALTER TABLE trainer_tasks 
ADD CONSTRAINT trainer_tasks_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Invoice Links
ALTER TABLE invoice_links 
ADD CONSTRAINT invoice_links_member_id_fkey 
FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- Enquiries (Set NULL instead of Cascade to keep lead history)
ALTER TABLE enquiries 
ADD CONSTRAINT enquiries_converted_member_id_fkey 
FOREIGN KEY (converted_member_id) REFERENCES members(id) ON DELETE SET NULL;
