const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExpiredMembers() {
  try {
    const today = "2026-05-01";

    // Query for members with expired memberships
    const { data: expiredMembers, error, count } = await supabase
      .from("members")
      .select("id, full_name, membership_valid_to, status", { count: "exact" })
      .eq("is_deleted", false)
      .lt("membership_valid_to", today)
      .not("membership_valid_to", "is", null);

    if (error) {
      console.error("Error querying expired members:", error);
      return;
    }

    console.log("\n=== MEMBERSHIP EXPIRY REPORT ===\n");
    console.log(`Members with expired MEMBERSHIP: ${count || expiredMembers?.length || 0}`);

    // Query for members with expired add-ons
    const { data: expiredAddOns, error: addOnError, count: addOnCount } = await supabase
      .from("member_add_ons")
      .select("id, member_id, add_on_id, start_date, end_date, members(full_name, id)", { count: "exact" })
      .lt("end_date", today)
      .not("end_date", "is", null);

    if (addOnError) {
      console.error("Error querying expired add-ons:", addOnError);
    } else {
      console.log(`Members with expired ADD-ONS: ${addOnCount || expiredAddOns?.length || 0}`);
    }

    // Get unique members with expired add-ons
    const uniqueAddOnMembers = new Set();
    if (expiredAddOns && expiredAddOns.length > 0) {
      expiredAddOns.forEach((addon) => {
        if (addon.members?.id) {
          uniqueAddOnMembers.add(addon.members.id);
        }
      });
      console.log(`\nUnique members with expired add-ons: ${uniqueAddOnMembers.size}`);
      console.log("\nSample expired add-ons:");
      expiredAddOns.slice(0, 10).forEach((addon) => {
        console.log(
          `  - ${addon.members?.full_name || "Unknown"} (Member ID: ${addon.member_id}) - Add-on expired on: ${addon.end_date}`
        );
      });
      if (expiredAddOns.length > 10) {
        console.log(`  ... and ${expiredAddOns.length - 10} more`);
      }
    }

    // Combined count - members with either expired membership OR expired add-on
    const memberIds = new Set();
    if (expiredMembers && expiredMembers.length > 0) {
      expiredMembers.forEach((m) => memberIds.add(m.id));
    }
    if (expiredAddOns && expiredAddOns.length > 0) {
      expiredAddOns.forEach((addon) => memberIds.add(addon.member_id));
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total unique members with expired membership/add-ons: ${memberIds.size}`);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkExpiredMembers();
