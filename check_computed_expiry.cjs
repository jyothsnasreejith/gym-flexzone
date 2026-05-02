const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFilteredExpired() {
  try {
    const today = "2026-05-01";

    console.log("=== CHECKING FILTERED EXPIRED (Like Members List shows) ===\n");

    // Get all active members
    const { data: allMembers, count: totalCount } = await supabase
      .from("members")
      .select("id, full_name, status, end_date, joining_date, created_at, package_variant_id, package_variants(pricing_type, duration_value, duration_unit)", { count: "exact" })
      .eq("is_deleted", false);

    console.log(`Total members (not deleted): ${totalCount}`);

    // Simulate the computeExpiryDate logic from MembersList.jsx
    const computeExpiryDate = (member) => {
      const variant = member.package_variants;
      if (!variant || variant.pricing_type !== "duration") return null;

      const baseDate = member.joining_date || member.created_at;
      if (!baseDate) return null;

      const start = new Date(baseDate);
      const unit = variant.duration_unit?.toLowerCase();
      const value = Number(variant.duration_value || 0);
      if (!value || !unit) return null;

      const expiry = new Date(start);
      if (unit === "month") {
        expiry.setMonth(expiry.getMonth() + value);
      } else if (unit === "year") {
        expiry.setFullYear(expiry.getFullYear() + value);
      } else if (unit === "day" || unit === "days") {
        expiry.setDate(expiry.getDate() + value);
      } else {
        return null;
      }
      return expiry.toISOString().slice(0, 10);
    };

    let expiredCount = 0;
    const expiredMembers = [];

    (allMembers || []).forEach(m => {
      const expiryDate = computeExpiryDate(m);
      if (expiryDate) {
        const expDate = new Date(expiryDate);
        expDate.setHours(0, 0, 0, 0);
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        
        if (expDate < todayDate) {
          expiredCount++;
          expiredMembers.push({
            id: m.id,
            full_name: m.full_name,
            computed_expiry_date: expiryDate,
            stored_end_date: m.end_date
          });
        }
      }
    });

    console.log(`\nMembers with computed expired date: ${expiredCount}`);
    console.log("\nFirst 15 expired members (using computation logic):");
    expiredMembers.slice(0, 15).forEach(m => {
      console.log(`  - ${m.full_name} (ID: ${m.id}) - Computed: ${m.computed_expiry_date}, Stored: ${m.stored_end_date}`);
    });
    if (expiredMembers.length > 15) {
      console.log(`  ... and ${expiredMembers.length - 15} more`);
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkFilteredExpired();
