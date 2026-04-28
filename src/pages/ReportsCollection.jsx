import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { paidLikeStatuses } from "../utils/paymentStatus";
import ReportDateRangeControls from "../components/ReportDateRangeControls";
import {
  createDefaultRange,
  formatCurrency,
  formatDate,
  isRangeValid,
  toDateOnly,
  downloadCsv,
} from "../utils/reportUtils";

export default function ReportsCollection() {
  const navigate = useNavigate();
  const [range, setRange] = useState(createDefaultRange);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!isRangeValid(range)) {
        setError("Select a valid date range.");
        setPayments([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("payments")
          .select("amount_paid, remaining_amount, status, payment_date")
          .in("status", [...paidLikeStatuses, "partial"])
          .gte("payment_date", range.from)
          .lte("payment_date", range.to);

        if (fetchError) throw fetchError;

        setPayments(data || []);
      } catch (err) {
        console.error("Failed to load collection", err);
        setPayments([]);
        setError("Failed to load collection. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [range.from, range.to]);

  const daywiseRows = useMemo(() => {
    if (!isRangeValid(range)) return [];

    const totals = new Map();
    (payments || []).forEach((p) => {
      const dateKey = String(p.payment_date || "").slice(0, 10);
      if (!dateKey) return;
      const amount = Number(p.amount_paid || 0);
      totals.set(dateKey, (totals.get(dateKey) || 0) + amount);
    });

    const rows = [];
    const start = new Date(`${range.from}T00:00:00`);
    const end = new Date(`${range.to}T00:00:00`);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = toDateOnly(d);
      rows.push({ date: key, amount: totals.get(key) || 0 });
    }

    return rows;
  }, [payments, range]);

  const total = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0),
    [payments]
  );

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Collection Report</h1>
          <p className="text-secondary">Day-wise collections</p>
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
          <ReportDateRangeControls
            range={range}
            onChange={setRange}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "collection-report.csv",
                ["date", "collection"],
                daywiseRows.map((row) => ({
                  date: row.date,
                  collection: row.amount,
                }))
              )
            }
            disabled={loading || daywiseRows.length === 0}
            className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-700/20 text-secondary hover:bg-slate-800/50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm min-w-[300px] sm:min-w-0">
            <thead className="bg-slate-800/50 text-secondary sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Collection</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {error && !loading && (
                <tr>
                  <td colSpan={2} className="px-6 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={2} className="px-6 py-6 text-center text-secondary">
                    Loading collection...
                  </td>
                </tr>
              )}
              {!loading && !error && daywiseRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-6 text-center text-secondary">
                    No collections in selected range.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                daywiseRows.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-800/50">
                    <td className="px-6 py-3">
                      {formatDate(`${row.date}T00:00:00`)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
            {!loading && !error && (
              <tfoot className="bg-slate-800/50 sticky bottom-0">
                <tr>
                  <td className="px-6 py-3 font-semibold">Total</td>
                  <td className="px-6 py-3 text-right font-semibold">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </main>
  );
}


