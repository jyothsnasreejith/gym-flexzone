const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qjkvvbuububgqgljsyjb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDates() {
  console.log("Checking bill dates for member 1108...");
  const { data, error } = await supabase
    .from('bills')
    .select('id, billing_date, due_date, amount')
    .eq('member_id', 1108)
    .order('due_date', { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Bills for 1108:");
  console.table(data);
}

checkDates();
