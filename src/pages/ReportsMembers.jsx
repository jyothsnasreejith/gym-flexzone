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

export default function ReportsMembers() {
  const navigate = useNavigate();
  const [range, setRange] = useState(createDefaultRange);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
        const [membersRes, financialsRes, addOnsRes, masterAddOnsRes, packagesRes, packageVariantsRes] = await Promise.all([
          supabase
            .from("members")
            .select("id, full_name, phone, joining_date, created_at, end_date, package_id, package_variant_id")
            .eq("is_deleted", false)
            .order("full_name", { ascending: true }),
          supabase.from("member_financials").select("member_id, expiry_date"),
          supabase.from("member_add_ons").select("member_id, add_on_id"),
          supabase.from("add_ons").select("id, name"),
          supabase.from("packages").select("id, title"),
          supabase.from("package_variants").select("id, pricing_type, duration_unit, duration_value, sessions_total, package_id"),
        ]);

        if (membersRes.error) throw membersRes.error;

        const membersData = membersRes.data || [];
        const financialsData = financialsRes.data || [];
        const maData = addOnsRes.data || [];
        const masterAddOns = masterAddOnsRes.data || [];
        const pkgData = packagesRes.data || [];
        const pkgVariantsData = packageVariantsRes.data || [];

        const expiryMap = new Map(
          (financialsData || []).map((f) => [f.member_id, f.expiry_date])
        );

        const addOnNamesMap = new Map(
          (masterAddOns || []).map((a) => [String(a.id), a.name])
        );
        const addOnMap = {};
        (maData || []).forEach((ma) => {
          if (!addOnMap[ma.member_id]) addOnMap[ma.member_id] = [];
          const name = addOnNamesMap.get(String(ma.add_on_id));
          if (name) {
            addOnMap[ma.member_id].push(name);
          }
        });

        const packageMap = new Map((pkgData || []).map((p) => [p.id, p.title]));
        const packageVariantMap = new Map((pkgVariantsData || []).map((pv) => [pv.id, pv]));

        const merged = (membersData || []).map((m) => {
          let packageName = "�";
          const variant = m.package_variant_id ? packageVariantMap.get(Number(m.package_variant_id)) : null;
          if (variant) {
            const title = packageMap.get(variant.package_id) || "";
            let details = "";
            if (variant.pricing_type === "duration") {
              details = ` (${variant.duration_value} ${variant.duration_unit === "month" ? "Months" : "Years"})`;
            } else {
              details = ` (${variant.sessions_total} Sessions)`;
            }
            packageName = `${title}${details}`.trim();
          }

          const addOnNames = addOnMap[m.id] || [];
          if (addOnNames.length > 0) {
            if (packageName && packageName !== "�") {
              packageName = `${packageName}, ${addOnNames.join(", ")}`;
            } else {
              packageName = addOnNames.join(", ");
            }
          }

          return {
            ...m,
            package_name: packageName,
            expiry_date: m.end_date || expiryMap.get(m.id) || null,
          };
        });

        setRows(merged);
      } catch (err) {
        console.error("Failed to load members", err);
        setRows([]);
        setError("Failed to load members. Please refresh.");
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
    const query = search.trim().toLowerCase();

    return rows.filter((m) => {
      const joined = parseDate(m.joining_date || m.created_at);
      if (!joined) return false;
      if (joined < from || joined > to) return false;
      if (!query) return true;
      return (m.full_name || "").toLowerCase().includes(query);
    });
  }, [rows, range, search]);

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Member List</h1>
          <p className="text-secondary">Members joined in selected range</p>
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
          <div className="flex flex-wrap items-center gap-4">
            <ReportDateRangeControls range={range} onChange={setRange} disabled={loading} />
            <label className="flex items-center gap-2 text-xs text-secondary w-full sm:w-auto">
              <span className="shrink-0">Search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by member name"
                className="rounded-md border px-2 py-1 text-xs text-gray-900 bg-white w-full"
                disabled={loading}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "member-list.csv",
                ["name", "phone", "package", "joining_date", "expiry_date"],
                filtered.map((m) => ({
                  name: m.full_name || "",
                  phone: m.phone || "",
                  package: m.package_name || "�",
                  joining_date: formatDateOnly(m.joining_date || m.created_at),
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
          <table className="w-full text-sm min-w-[800px] sm:min-w-0">
            <thead className="bg-slate-800/50 text-secondary sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">Member</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Package</th>
                <th className="px-6 py-3 text-left">Joining Date</th>
                <th className="px-6 py-3 text-left">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {error && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-secondary">
                    Loading members...
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-secondary">
                    {search.trim() ? "No matching members." : "No members found."}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => navigate(`/members/${m.id}`)}
                  >
                    <td className="px-6 py-3 font-medium">{m.full_name}</td>
                    <td className="px-6 py-3">{m.phone || "�"}</td>
                    <td className="px-6 py-3">{m.package_name}</td>
                    <td className="px-6 py-3">
                      {formatDate(m.joining_date || m.created_at)}
                    </td>
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
