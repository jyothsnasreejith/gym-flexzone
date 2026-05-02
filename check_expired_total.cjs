const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qjkvvbuububgqgljsyjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkExpiredWithAddOns() {
  try {
    const today = "2026-05-01";
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);

    console.log("=== CHECKING EXPIRED (Package + Add-on) ===\n");

    const { data: allMembers } = await supabase
      .from("members")
      .select("id, full_name, status, end_date, joining_date, created_at, package_variant_id, package_variants(pricing_type, duration_value, duration_unit)")
      .eq("is_deleted", false);

    const { data: memberAddOns } = await supabase
      .from("member_add_ons")
      .select("member_id, end_date");

    const addOnExpiryMap = new Map();
    (memberAddOns || []).forEach(addon => {
      if (!addOnExpiryMap.has(addon.member_id)) {
        addOnExpiryMap.set(addon.member_id, []);
      }
      addOnExpiryMap.get(addon.member_id).push(addon.end_date);
    });

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

    const expiredByPackage = new Set();
    const expiredByAddOn = new Set();
    const allExpired = new Set();

    (allMembers || []).forEach(m => {
      const packageExpiry = computeExpiryDate(m);
      if (packageExpiry) {
        const expDate = new Date(packageExpiry);
        expDate.setHours(0, 0, 0, 0);
        if (expDate < todayDate) {
          expiredByPackage.add(m.id);
          allExpired.add(m.id);
        }
      }
    });

    addOnExpiryMap.forEach((addOnDates, memberId) => {
      addOnDates.forEach(endDate => {
        const expDate = new Date(endDate);
        expDate.setHours(0, 0, 0, 0);
        if (expDate < todayDate) {
          expiredByAddOn.add(memberId);
          allExpired.add(memberId);
        }
      });
    });

    console.log(`Members with expired PACKAGE: ${expiredByPackage.size}`);
    console.log(`Members with expired ADD-ON: ${expiredByAddOn.size}`);
    console.log(`Total UNIQUE members with expired package or add-on: ${allExpired.size}`);

    // Check overlap
    const overlap = Array.from(expiredByPackage).filter(id => expiredByAddOn.has(id));
    console.log(`Members with BOTH expired package and add-on: ${overlap.length}`);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkExpiredWithAddOns();
