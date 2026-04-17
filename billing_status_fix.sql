-- 1. Add 'is_current' column to track active vs historical bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT TRUE;

-- 2. Update the Member Financials View to only sum current package bills
-- This fixes the "Green/Red" status inconsistency in the Member List
DROP VIEW IF EXISTS public.member_financials;
CREATE OR REPLACE VIEW public.member_financials AS
WITH bill_stats AS (
  SELECT 
    member_id,
    COALESCE(SUM(payable_amount), 0) as total_amount,
    COALESCE(MAX(due_date), NULL) as expiry_date
  FROM public.bills 
  WHERE is_current = true
  GROUP BY member_id
),
payment_stats AS (
  SELECT 
    b.member_id,
    COALESCE(SUM(p.amount_paid), 0) as total_paid
  FROM public.bills b
  JOIN public.payments p ON b.id = p.bill_id
  WHERE b.is_current = true 
    AND (LOWER(p.status) IN ('paid', 'completed', 'success', 'partial'))
  GROUP BY b.member_id
)
SELECT 
  m.id as member_id,
  COALESCE(bs.total_amount, 0) as total_amount,
  COALESCE(ps.total_paid, 0) as total_paid,
  GREATEST(COALESCE(bs.total_amount, 0) - COALESCE(ps.total_paid, 0), 0) as due_amount,
  bs.expiry_date,
  CASE WHEN bs.expiry_date <= (CURRENT_DATE + interval '7 days') THEN true ELSE false END as expiring_soon
FROM public.members m
LEFT JOIN bill_stats bs ON m.id = bs.member_id
LEFT JOIN payment_stats ps ON m.id = ps.member_id;

-- Ensure permissions are set
GRANT SELECT ON public.member_financials TO authenticated;
