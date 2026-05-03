import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qjkvvbuububgqgljsyjb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDYyMzE0NzIsImV4cCI6MjAyMTgwNzQ3Mn0.Wj75i_0r9rPBKf9lKKKCYOr_6RI4RYi1zzlKXcC5Jkc'
);

async function testDelete() {
  try {
    console.log('Testing delete of package with ID from member 1241...');
    
    // First, get the third package ID from member 1241
    const { data: packages, error: fetchError } = await supabase
      .from('member_packages')
      .select('id')
      .eq('member_id', 1241)
      .order('start_date', { ascending: false })
      .limit(1, { foreignTable: 'member_packages' });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return;
    }

    console.log('Packages:', packages);

    if (packages && packages.length > 0) {
      const packageId = packages[0].id;
      console.log('Attempting to delete package ID:', packageId);

      // Try to update is_deleted column
      const { data, error } = await supabase
        .from('member_packages')
        .update({ is_deleted: true })
        .eq('id', packageId);

      if (error) {
        console.error('Delete error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
      } else {
        console.log('Delete successful:', data);
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testDelete();
