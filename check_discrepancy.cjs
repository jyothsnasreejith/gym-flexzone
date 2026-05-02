const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExpiredMembers() {
  try {
    const today = "2026-05-01";

    // Count members with expired end_date
    const { data: expiredEndDate, count: count1 } = await supabase
      .from("members")
      .select("id, full_name, end_date", { count: "exact" })
      .eq("is_deleted", false)
      .lt("end_date", today)
      .not("end_date", "is", null);

    console.log(`=== BREAKDOWN ===`);
    console.log(`\n1. Members with expired end_date: ${count1 || 0}`);

    // Count members with expired add-ons
    const { data: expiredAddOns, count: count2 } = await supabase
      .from("member_add_ons")
      .select("member_id", { count: "exact" })
      .lt("end_date", today)
      .not("end_date", "is", null);

    console.log(`2. Total expired add-on records: ${count2 || 0}`);

    // Get unique members with expired add-ons
    const uniqueAddOnMemberIds = new Set();
    if (expiredAddOns && expiredAddOns.length > 0) {
      expiredAddOns.forEach((addon) => {
        uniqueAddOnMemberIds.add(addon.member_id);
      });
    }
    console.log(`3. Unique members with expired add-ons: ${uniqueAddOnMemberIds.size}`);

    // Check if there's overlap
    const expiredMemberIds = new Set((expiredEndDate || []).map((m) => m.id));
    const overlapping = Array.from(uniqueAddOnMemberIds).filter((id) => expiredMemberIds.has(id));
    console.log(`4. Members with both expired membership AND add-ons: ${overlapping.length}`);

    // Combined unique members
    const allExpiredIds = new Set([...expiredMemberIds, ...uniqueAddOnMemberIds]);
    console.log(`\n5. TOTAL UNIQUE MEMBERS with expired membership/add-ons: ${allExpiredIds.size}`);

    // Check if there's an "expiring soon" filter being applied
    console.log(`\n=== CHECKING IF 34 INCLUDES "EXPIRING SOON" ===`);
    
    const expiringLater = new Date(today);
    expiringLater.setDate(expiringLater.getDate() + 30); // 30 days from now
    
    const { data: expiringSoon, count: count3 } = await supabase
      .from("members")
      .select("id", { count: "exact" })
      .eq("is_deleted", false)
      .gte("end_date", today)
      .lt("end_date", expiringLater.toISOString().split('T')[0])
      .not("end_date", "is", null);

    console.log(`Members expiring in next 30 days: ${count3 || 0}`);
    console.log(`Total if we add expired + expiring soon: ${(count1 || 0) + (count3 || 0)}`);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkExpiredMembers();
