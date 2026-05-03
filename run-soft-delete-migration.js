const { createClient } = require('@supabase/supabase-js');

// Get credentials from environment or use defaults
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qjkvvbuububgqgljsyjb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('VITE_SUPABASE_ANON_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Adding is_deleted column to member_packages table...');
    
    // Add is_deleted column to member_packages
    const { error: mpError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE member_packages 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
      `
    });

    if (mpError) {
      console.warn('Note: member_packages.is_deleted might already exist or requires elevated permissions');
      console.log('Error details:', mpError);
    } else {
      console.log('✓ Added is_deleted to member_packages');
    }

    console.log('Adding is_deleted column to member_add_ons table...');
    
    // Add is_deleted column to member_add_ons
    const { error: maoError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE member_add_ons 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
      `
    });

    if (maoError) {
      console.warn('Note: member_add_ons.is_deleted might already exist or requires elevated permissions');
      console.log('Error details:', maoError);
    } else {
      console.log('✓ Added is_deleted to member_add_ons');
    }

    console.log('Migration complete!');
    console.log('\nIMPORTANT: If the above shows errors, you need to manually run this SQL in Supabase:');
    console.log(`
ALTER TABLE member_packages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE member_add_ons ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_member_packages_is_deleted 
ON member_packages(is_deleted) WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_member_add_ons_is_deleted 
ON member_add_ons(is_deleted) WHERE NOT is_deleted;
    `);

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

runMigration();
