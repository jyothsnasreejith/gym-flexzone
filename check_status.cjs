const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkMemberStatus() {
  try {
    const today = "2026-05-01";

    // Check all members to see what statuses exist
    console.log("=== MEMBER STATUS BREAKDOWN ===\n");
    
    const { data: allMembers, error } = await supabase
      .from("members")
      .select("id, status", { count: "exact" })
      .eq("is_deleted", false);

    if (error) {
      console.error("Error:", error);
      return;
    }

    // Count by status
    const statusMap = {};
    (allMembers || []).forEach(m => {
      statusMap[m.status] = (statusMap[m.status] || 0) + 1;
    });

    console.log("Members by status:");
    Object.entries(statusMap).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log(`\nTotal members: ${allMembers.length}`);

    // Check if there are members with status "Expired"
    const { data: expiredStatus, count: expiredCount } = await supabase
      .from("members")
      .select("id", { count: "exact" })
      .eq("is_deleted", false)
      .ilike("status", "%expired%");

    console.log(`\nMembers with "expired" in status: ${expiredCount || 0}`);

    // Check all different combinations
    console.log("\n=== POSSIBLE EXPIRED COUNTS ===");
    console.log(`1. Members with end_date < today: 22`);
    console.log(`2. Members with status containing "expired": ${expiredCount || 0}`);
    console.log(`3. Combined unique: should be checked`);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkMemberStatus();
