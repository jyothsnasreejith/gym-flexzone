import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";


serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("DB_URL");
    const serviceRoleKey = Deno.env.get("DB_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- PARALLEL QUERIES (FAST, CLEAN) ----
    const [
      membersCount,
      trainersCount,
      recentPayments,
    ] = await Promise.all([
      supabase.from("members").select("*", { count: "exact", head: true }),
      supabase.from("trainers").select("*", { count: "exact", head: true }),
      supabase
        .from("payments")
        .select("id, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (
      membersCount.error ||
      trainersCount.error ||
      recentPayments.error
    ) {
      throw new Error("Database query failed");
    }

    return new Response(
      JSON.stringify({
        totalMembers: membersCount.count ?? 0,
        totalTrainers: trainersCount.count ?? 0,
        recentPayments: recentPayments.data ?? [],
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
});
