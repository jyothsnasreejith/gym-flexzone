-- Fix existing members who have future end dates but are still marked as Inactive, Expired, or New.
-- Run this once in the Supabase SQL Editor.

UPDATE members
SET status = 'Active'
WHERE end_date >= CURRENT_DATE
  AND status IN ('Inactive', 'Expired', 'New')
  AND is_deleted = false;
