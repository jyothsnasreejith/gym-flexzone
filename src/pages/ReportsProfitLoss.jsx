import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { paidLikeStatuses } from "../utils/paymentStatus";
import ReportDateRangeControls from "../components/ReportDateRangeControls";
import {
  createDefaultRange,
  formatSignedCurrency,
  isRangeValid,
  downloadCsv,
} from "../utils/reportUtils";

export default function ReportsProfitLoss() {
  const navigate = useNavigate();
  const [range, setRange] = useState(createDefaultRange);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    const load = async () => {
      if (!isRangeValid(range)) {
        setError("Select a valid date range.");
        setTotals({ income: 0, expense: 0 });
        return;
      }

      setLoading(true);
      setError("");

      try {
        const fromIso = new Date(`${range.from}T00:00:00`).toISOString();
        const toIso = new Date(`${range.to}T23:59:59`).toISOString();

        const [paymentsRes, expensesRes] = await Promise.all([
          supabase
            .from("payments")
            .select("amount_paid, status, payment_date")
            .in("status", paidLikeStatuses)
            .gte("payment_date", range.from)
            .lte("payment_date", range.to),
          supabase
            .from("expenses")
            .select("amount, expense_at")
            .gte("expense_at", fromIso)
            .lte("expense_at", toIso),
        ]);

        if (paymentsRes.error || expensesRes.error) {
          throw paymentsRes.error || expensesRes.error;
        }

        const income = (paymentsRes.data || []).reduce(
          (sum, p) => sum + Number(p.amount_paid || 0),
          0
        );
        const expense = (expensesRes.data || []).reduce(
          (sum, e) => sum + Number(e.amount || 0),
          0
        );

        setTotals({ income, expense });
      } catch (err) {
        console.error("Failed to load P&L", err);
        setTotals({ income: 0, expense: 0 });
        setError("Failed to load P&L. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [range.from, range.to]);

  const net = totals.income - totals.expense;
  const sign = net > 0 ? "+" : net < 0 ? "-" : "�";
  const tone = net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-white";

  const csvRows = useMemo(
    () => [
      {
        income: totals.income,
        expense: totals.expense,
        net,
      },
    ],
    [totals.income, totals.expense, net]
  );

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Profit &amp; Loss</h1>
          <p className="text-secondary">Income vs expense</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/reports")}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-700/20 text-secondary hover:bg-slate-800/50 text-sm font-semibold"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Reports
        </button>
      </div>

      <section className="bg-card border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ReportDateRangeControls range={range} onChange={setRange} disabled={loading} />
          <button
            type="button"
            onClick={() =>
              downloadCsv("profit-loss.csv", ["income", "expense", "net"], csvRows)
            }
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-700/20 text-secondary hover:bg-slate-800/50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="p-6">
          {error && !loading && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          {loading && (
            <div className="text-sm text-secondary">Loading P&amp;L...</div>
          )}
          {!loading && !error && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-secondary">Income</div>
                <div className="text-base font-semibold text-green-700 break-words">
                  {formatSignedCurrency(totals.income, "+")}
                </div>
              </div>
              <div>
                <div className="text-xs text-secondary">Expense</div>
                <div className="text-base font-semibold text-red-700 break-words">
                  {formatSignedCurrency(totals.expense, "-")}
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="text-xs text-secondary">Net</div>
                <div className={`text-base font-semibold ${tone} break-words`}>
                  {formatSignedCurrency(Math.abs(net), sign)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


