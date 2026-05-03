# Soft Delete Migration - Manual Instructions

The PackageDetailsDisplay component now supports soft deletes with a delete button that marks records as deleted instead of removing them permanently.

## Required SQL Migration

To enable soft delete functionality, run the following SQL in your Supabase SQL Editor:

```sql
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
```

## Steps to Apply

1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Click "New Query"
4. Copy and paste the SQL above
5. Click "Run"
6. Verify both tables were updated successfully

## What Changed

- `src/components/PackageDetailsDisplay.jsx`: Added `handleDelete()` function that sets `is_deleted: true`
- `src/pages/Members.jsx`: Updated queries to filter with `.eq("is_deleted", false)`
- Package/Add-on rows now show both Edit (pencil) and Delete (trash) buttons in the Action column
- Delete button shows confirmation dialog before marking as deleted
- Table view is now the default display mode (changed from card view)

## Soft Delete Benefits

- Records are never permanently removed from database
- Full audit trail preserved
- Easy to restore if needed
- Business continuity maintained
