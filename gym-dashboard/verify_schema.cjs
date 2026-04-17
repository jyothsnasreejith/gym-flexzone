const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qjkvvbuububgqgljsyjb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Verifying schema...");

  try {
    // 1. Check bills table
    const { data: bills, error: billsErr } = await supabase
      .from('bills')
      .select('bill_type')
      .limit(1);

    if (billsErr) {
      console.error("Error checking 'bills.bill_type':", billsErr.message);
    } else {
      console.log("SUCCESS: 'bills.bill_type' column exists.");
    }

    // 2. Check member_add_ons table
    const { data: ma, error: maErr } = await supabase
      .from('member_add_ons')
      .select('start_date, end_date')
      .limit(1);

    if (maErr) {
      console.error("Error checking 'member_add_ons' dates:", maErr.message);
    } else {
      console.log("SUCCESS: 'member_add_ons' date columns exist.");
    }

    // 3. Check packages table
    const { data: pkgs, error: pkgsErr } = await supabase
      .from('packages')
      .select('is_student_offer')
      .limit(1);

    if (pkgsErr) {
      console.error("Error checking 'packages.is_student_offer':", pkgsErr.message);
    } else {
      console.log("SUCCESS: 'packages.is_student_offer' column exists.");
    }
  } catch (e) {
    console.error("Unexpected error during verification:", e.message);
  }
}

verify();
