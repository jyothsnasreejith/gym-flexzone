-- Add is_deleted column for soft delete functionality
ALTER TABLE member_packages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

ALTER TABLE member_add_ons 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_member_packages_is_deleted 
ON member_packages(is_deleted) 
WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_member_add_ons_is_deleted 
ON member_add_ons(is_deleted) 
WHERE NOT is_deleted;
