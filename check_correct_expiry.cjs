const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExpiredMembers() {
  try {
    const today = "2026-05-01";

    // First check what fields exist in members table
    console.log("=== Checking members table ===\n");
    
    const { data: membersData, error: membersError, count: membersCount } = await supabase
      .from("members")
      .select("id, full_name, end_date, membership_valid_to", { count: "exact" })
      .eq("is_deleted", false)
      .limit(5);

    if (membersError) {
      console.error("Error querying members:", membersError);
    } else {
      console.log("Sample members data:");
      console.log(JSON.stringify(membersData, null, 2));
    }

    // Check member_financials table
    console.log("\n=== Checking member_financials table ===\n");
    
    const { data: financialsData, error: financialsError } = await supabase
      .from("member_financials")
      .select("member_id, expiry_date")
      .limit(5);

    if (financialsError) {
      console.error("Error querying member_financials:", financialsError);
    } else {
      console.log("Sample member_financials data:");
      console.log(JSON.stringify(financialsData, null, 2));
    }

    // Now count expired using the correct fields
    console.log("\n=== EXPIRED MEMBERS COUNT (using correct fields) ===\n");
    
    const { data: membersWithEndDate, error: err1, count: expiredByEndDate } = await supabase
      .from("members")
      .select("id", { count: "exact" })
      .eq("is_deleted", false)
      .lt("end_date", today)
      .not("end_date", "is", null);

    if (!err1) {
      console.log(`Members with expired end_date: ${expiredByEndDate || 0}`);
    }

    const { data: membersWithFinancialExpiry, error: err2, count: expiredByFinancials } = await supabase
      .from("member_financials")
      .select("member_id", { count: "exact" })
      .lt("expiry_date", today)
      .not("expiry_date", "is", null);

    if (!err2) {
      console.log(`Members with expired expiry_date (via financials): ${expiredByFinancials || 0}`);
    }

    // Get actual data to see the discrepancy
    const { data: expiredEndDateData } = await supabase
      .from("members")
      .select("id, full_name, end_date")
      .eq("is_deleted", false)
      .lt("end_date", today)
      .not("end_date", "is", null)
      .order("end_date");

    console.log(`\nMembers with expired end_date (first 15):`);
    if (expiredEndDateData && expiredEndDateData.length > 0) {
      expiredEndDateData.slice(0, 15).forEach((m) => {
        console.log(`  - ${m.full_name} (ID: ${m.id}) - end_date: ${m.end_date}`);
      });
      if (expiredEndDateData.length > 15) {
        console.log(`  ... and ${expiredEndDateData.length - 15} more`);
      }
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkExpiredMembers();
