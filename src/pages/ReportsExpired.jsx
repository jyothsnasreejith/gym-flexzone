import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import ReportDateRangeControls from "../components/ReportDateRangeControls";
import {
  createDefaultRange,
  formatDate,
  formatDateOnly,
  isRangeValid,
  parseDate,
  downloadCsv,
} from "../utils/reportUtils";

export default function ReportsExpired() {
  const navigate = useNavigate();
  const [range, setRange] = useState(createDefaultRange);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!isRangeValid(range)) {
        setError("Select a valid date range.");
        setRows([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [membersRes, financialsRes] = await Promise.all([
          supabase
            .from("members")
            .select("id, full_name, phone, end_date")
            .eq("is_deleted", false)
            .order("full_name", { ascending: true }),
          supabase.from("member_financials").select("member_id, expiry_date"),
        ]);

        if (membersRes.error || financialsRes.error) {
          throw membersRes.error || financialsRes.error;
        }

        const expiryMap = new Map(
          (financialsRes.data || []).map((f) => [f.member_id, f.expiry_date])
        );

        const merged = (membersRes.data || []).map((m) => ({
          ...m,
          expiry_date: m.end_date || expiryMap.get(m.id) || null,
        }));

        setRows(merged);
      } catch (err) {
        console.error("Failed to load expired members", err);
        setRows([]);
        setError("Failed to load expired members. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [range.from, range.to]);

  const filtered = useMemo(() => {
    if (!isRangeValid(range)) return [];

    const from = new Date(`${range.from}T00:00:00`);
    const to = new Date(`${range.to}T23:59:59`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rows
      .filter((m) => {
        const exp = parseDate(m.expiry_date);
        if (!exp) return false;
        if (exp >= today) return false;
        if (exp < from || exp > to) return false;
        return true;
      })
      .sort((a, b) => {
        const aDate = parseDate(a.expiry_date);
        const bDate = parseDate(b.expiry_date);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      });
  }, [rows, range]);

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Expired Members</h1>
          <p className="text-secondary">Members expired before today</p>
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
              downloadCsv(
                "expired-members.csv",
                ["name", "phone", "expiry_date"],
                filtered.map((m) => ({
                  name: m.full_name || "",
                  phone: m.phone || "",
                  expiry_date: formatDateOnly(m.expiry_date),
                }))
              )
            }
            disabled={loading || filtered.length === 0}
            className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-700/20 text-secondary hover:bg-slate-800/50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm min-w-[500px] sm:min-w-0">
            <thead className="bg-slate-800/50 text-secondary sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">Member</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {error && !loading && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-secondary">
                    Loading expired members...
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-secondary">
                    No expired members.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-3 font-medium">{m.full_name}</td>
                    <td className="px-6 py-3">{m.phone || "�"}</td>
                    <td className="px-6 py-3">{formatDate(m.expiry_date)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}


