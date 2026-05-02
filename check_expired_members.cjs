const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExpiredMembers() {
  try {
    // Query for members with expired memberships
    const { data: expiredMembers, error, count } = await supabase
      .from("members")
      .select("id, full_name, membership_valid_to, status", { count: "exact" })
      .eq("is_deleted", false)
      .lt("membership_valid_to", new Date("2026-05-01").toISOString().split("T")[0])
      .not("membership_valid_to", "is", null);

    if (error) {
      console.error("Error querying expired members:", error);
      return;
    }

    console.log("\n=== EXPIRED MEMBERS REPORT ===\n");
    console.log(`Total expired members: ${count || expiredMembers?.length || 0}`);
    
    if (expiredMembers && expiredMembers.length > 0) {
      console.log("\nExpired members list:");
      expiredMembers.slice(0, 10).forEach((member) => {
        console.log(
          `  - ${member.full_name} (ID: ${member.id}) - Expired on: ${member.membership_valid_to}`
        );
      });
      if (expiredMembers.length > 10) {
        console.log(`  ... and ${expiredMembers.length - 10} more`);
      }
    }

    // Also get active members
    const { data: activeMembers, error: activeError, count: activeCount } = await supabase
      .from("members")
      .select("id", { count: "exact" })
      .eq("is_deleted", false)
      .gte("membership_valid_to", new Date("2026-05-01").toISOString().split("T")[0])
      .not("membership_valid_to", "is", null);

    if (!activeError) {
      console.log(`\nTotal active members: ${activeCount || activeMembers?.length || 0}`);
    }

    // Members with no expiry date set
    const { data: noExpiry, error: noExpiryError, count: noExpiryCount } = await supabase
      .from("members")
      .select("id", { count: "exact" })
      .eq("is_deleted", false)
      .is("membership_valid_to", null);

    if (!noExpiryError) {
      console.log(`Members with no expiry date set: ${noExpiryCount || noExpiry?.length || 0}`);
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkExpiredMembers();
