import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qjkvvbuububgqgljsyjb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ4MzI1OTIsImV4cCI6MjA0MDQwODU5Mn0.0bN8KHlCBEj76mGf8L-Kcx1cKzBdGa-PEgKiZc0fD8w"
);

async function testData() {
  console.log("Checking bills data...");
  const { data: bills, error: billsErr } = await supabase
    .from("bills")
    .select("*")
    .limit(5);

  if (billsErr) {
    console.error("Bills error:", billsErr);
  } else {
    console.log("Sample bills:", JSON.stringify(bills, null, 2));
  }

  console.log("\nChecking member_add_ons with add_ons...");
  const { data: addOns, error: addOnsErr } = await supabase
    .from("member_add_ons")
    .select("id, member_id, add_on_id, start_date, end_date, add_ons(name, duration_unit, duration_value)")
    .limit(5);

  if (addOnsErr) {
    console.error("Add-ons error:", addOnsErr);
  } else {
    console.log("Sample member_add_ons:", JSON.stringify(addOns, null, 2));
  }
}

testData();
