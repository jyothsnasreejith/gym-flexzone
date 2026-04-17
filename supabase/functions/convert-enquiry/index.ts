import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("DB_URL");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response("Missing env", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { enquiryId } = await req.json();
    if (!enquiryId) {
      return new Response("Missing enquiryId", { status: 400 });
    }

    // 1. Load enquiry
    const { data: enquiry, error: e1 } = await supabase
      .from("enquiries")
      .select("*")
      .eq("id", enquiryId)
      .single();

    if (e1 || !enquiry) {
      return new Response("Enquiry not found", { status: 404 });
    }

    // 2. Create member
    const { error: e2 } = await supabase.from("members").insert([{
      full_name: enquiry.full_name,
      phone: enquiry.phone,
      gender: enquiry.gender,
      address: enquiry.area,
    }]);

    if (e2) throw e2;

    // 3. Mark enquiry converted
    const { error: e3 } = await supabase
      .from("enquiries")
      .update({ status: "Converted" })
      .eq("id", enquiryId);

    if (e3) throw e3;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
});
