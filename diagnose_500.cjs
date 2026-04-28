const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qjkvvbuububgqgljsyjb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("Starting diagnostic...");

  // Test 1: Simple select from members
  console.log("\n1. Testing 'members' table (simple select)...");
  const { data: mData, error: mError } = await supabase
    .from('members')
    .select('id, full_name')
    .limit(1);
  if (mError) {
    console.error("FAILED - Members:", mError);
  } else {
    console.log("SUCCESS - Members:", mData);
  }

  // Test 2: Select from bills (check is_current)
  console.log("\n2. Testing 'bills' table (check is_current)...");
  const { data: bData, error: bError } = await supabase
    .from('bills')
    .select('id, is_current')
    .limit(1);
  if (bError) {
    console.error("FAILED - Bills (is_current):", bError);
  } else {
    console.log("SUCCESS - Bills (is_current):", bData);
  }

  // Test 3: Select from member_financials (view)
  console.log("\n3. Testing 'member_financials' view...");
  const { data: fData, error: fError } = await supabase
    .from('member_financials')
    .select('*')
    .limit(1);
  if (fError) {
    console.error("FAILED - Member Financials View:", fError);
  } else {
    console.log("SUCCESS - Member Financials View:", fData);
  }
}

diagnose();
