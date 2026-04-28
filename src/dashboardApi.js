import { supabase } from "./supabaseClient";
const withRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export async function fetchDashboard() {
  /* ======================
     TOTAL MEMBERS
  ====================== */
  const { count: members, error: membersError } = await withRetry(() =>
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("is_deleted", false)
  );

  if (membersError) throw membersError;

  /* ======================
     TRAINERS
  ====================== */
  const { count: trainers, error: trainersError } = await withRetry(() =>
    supabase
      .from("trainers")
      .select("*", { count: "exact", head: true })
  );

  if (trainersError) throw trainersError;

  /* ======================
     REVENUE (FROM PAYMENTS)
  ====================== */
  const { data: paidPayments, error: paymentsError } = await withRetry(() =>
    supabase
      .from("payments")
      .select("amount_paid")
      .eq("status", "paid")
  );

  if (paymentsError) throw paymentsError;

  const revenue = (paidPayments || []).reduce(
    (sum, p) => sum + Number(p.amount_paid || 0),
    0
  );

  return {
    members: members ?? 0,
    activeMembers: members ?? 0,
    trainers: trainers ?? 0,
    revenue,
  };
}
