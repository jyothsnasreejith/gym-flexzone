import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { downloadCsv, formatDateOnly } from "../utils/reportUtils";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const dt = new Date(dateStr);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysSinceExpiry = (dateStr) => {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  if (expiry >= today) return null; // not expired
  const diff = Math.floor((today - expiry) / (1000 * 60 * 60 * 24));
  return diff;
};

const isExpired = (dateStr) => {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry < today;
};

export default function ReportsMemberExpiryBilling() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterExpired, setFilterExpired] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        // Fetch all members with their details
        const { data: membersData, error: membersErr } = await supabase
          .from("members")
          .select(
            `id, 
            full_name, 
            phone, 
            admission_no,
            joining_date, 
            end_date,
            is_deleted`
          )
          .eq("is_deleted", false)
          .order("full_name", { ascending: true });

        if (membersErr) throw membersErr;

        // Fetch all bills with package variant info
        const { data: billsData, error: billsErr } = await supabase
          .from("bills")
          .select(
            `id, 
            member_id, 
            billing_date, 
            due_date, 
            notes,
            package_variant_id`
          )
          .order("billing_date", { ascending: false });

        if (billsErr) throw billsErr;

        // Fetch member add-ons with add-ons info
        const { data: memberAddOnsData, error: addOnsErr } = await supabase
          .from("member_add_ons")
          .select(
            `id, 
            member_id, 
            add_on_id, 
            start_date, 
            end_date, 
            add_ons!inner(id, name, duration_unit, duration_value)`
          );

        if (addOnsErr) throw addOnsErr;

        // Fetch all package variants
        const { data: variantsData, error: variantsErr } = await supabase
          .from("package_variants")
          .select("id, package_id, duration_unit, duration_value");

        if (variantsErr) throw variantsErr;

        // Fetch all packages
        const { data: packagesData, error: packagesErr } = await supabase
          .from("packages")
          .select("id, title");

        if (packagesErr) throw packagesErr;

        // Build lookup maps
        const variantMap = new Map();
        (variantsData || []).forEach((v) => {
          variantMap.set(v.id, {
            package_id: v.package_id,
            duration_unit: v.duration_unit,
            duration_value: v.duration_value,
          });
        });

        const packageNameMap = new Map();
        (packagesData || []).forEach((p) => {
          packageNameMap.set(p.id, p.title);
        });

        // Create a map of latest bill date and package per member
        const latestBillMap = new Map();
        const packageMap = new Map();
        (billsData || []).forEach((bill) => {
          if (!latestBillMap.has(bill.member_id)) {
            latestBillMap.set(bill.member_id, bill.billing_date);
            
            // Get package info from package_variant_id
            if (bill.package_variant_id) {
              const variant = variantMap.get(bill.package_variant_id);
              if (variant) {
                const pkgName = packageNameMap.get(variant.package_id) || "—";
                packageMap.set(bill.member_id, {
                  name: pkgName,
                  duration_value: variant.duration_value,
                  duration_unit: variant.duration_unit,
                });
              }
            }
          }
        });

        // Create map of active add-ons per member
        const memberAddOnsMap = new Map();
        (memberAddOnsData || []).forEach((ao) => {
          if (!isExpired(ao.end_date)) {
            if (!memberAddOnsMap.has(ao.member_id)) {
              memberAddOnsMap.set(ao.member_id, []);
            }
            memberAddOnsMap.get(ao.member_id).push({
              name: ao.add_ons?.name || "—",
              duration_value: ao.add_ons?.duration_value || "—",
              duration_unit: ao.add_ons?.duration_unit || "—",
            });
          }
        });

        // Merge data
        const merged = (membersData || []).map((m) => {
          const pkgInfo = packageMap.get(m.id) || {
            name: "—",
            duration_value: "—",
            duration_unit: "—",
          };
          return {
            ...m,
            expiry_date: m.end_date,
            latest_bill_date: latestBillMap.get(m.id) || null,
            days_expired: daysSinceExpiry(m.end_date),
            package_name: pkgInfo.name,
            package_duration: {
              duration_value: pkgInfo.duration_value,
              duration_unit: pkgInfo.duration_unit,
            },
            active_addons: memberAddOnsMap.get(m.id) || [],
          };
        });

        setRows(merged);
      } catch (err) {
        console.error("Failed to load members expiry report", err);
        setError("Failed to load report. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((m) => {
      if (filterExpired && !isExpired(m.expiry_date)) {
        return false;
      }
      if (!query) return true;
      return (
        (m.full_name || "").toLowerCase().includes(query) ||
        (m.phone || "").includes(query) ||
        (m.admission_no || "").toLowerCase().includes(query)
      );
    });
  }, [rows, search, filterExpired]);

  const handleExport = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Admission No",
      "Member Name",
      "Phone",
      "Joining Date",
      "Expiry Date",
      "Days Expired",
      "Package",
      "Duration",
      "Active Add-ons",
      "Latest Bill Date",
      "Status",
    ];

    const csvData = filtered.map((m) => ({
      "Admission No": m.admission_no || "—",
      "Member Name": m.full_name || "—",
      Phone: m.phone || "—",
      "Joining Date": formatDate(m.joining_date),
      "Expiry Date": formatDate(m.expiry_date),
      "Days Expired": m.days_expired !== null ? m.days_expired : "—",
      Package: m.package_name || "—",
      Duration: m.package_duration && m.package_duration.duration_value !== "—" 
        ? `${m.package_duration.duration_value} ${m.package_duration.duration_unit}`
        : "—",
      "Active Add-ons": m.active_addons && m.active_addons.length > 0
        ? m.active_addons
            .map((ao) => `${ao.name} (${ao.duration_value} ${ao.duration_unit})`)
            .join("; ")
        : "—",
      "Latest Bill Date": formatDate(m.latest_bill_date),
      Status: isExpired(m.expiry_date) ? "Expired" : "Active",
    }));

    downloadCsv(
      `member-expiry-billing-report-${formatDateOnly(new Date().toISOString())}.csv`,
      headers,
      csvData
    );
  };

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy min-h-screen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Member Expiry & Billing Report</h1>
          <p className="text-secondary">Join date, expiry date, and latest bill date for all members</p>
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

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      <div className="bg-primary-blue rounded-xl p-6 space-y-4 border border-secondary-blue/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Search by name, phone, or admission number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-secondary-blue/30 border border-secondary-blue text-white placeholder-secondary/50 focus:outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        </div>

        <label className="flex items-center gap-2 text-secondary hover:text-white cursor-pointer">
          <input
            type="checkbox"
            checked={filterExpired}
            onChange={(e) => setFilterExpired(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Show only expired members</span>
        </label>
      </div>

      {loading ? (
        <div className="text-center text-secondary py-12">Loading...</div>
      ) : (
        <div className="bg-primary-blue rounded-xl overflow-hidden border border-secondary-blue/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary-blue/50 border-b border-secondary-blue">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Admission No
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Member Name
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Joining Date
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-right">
                    Days Expired
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Package
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Active Add-ons
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Latest Bill Date
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-blue/20">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-secondary">
                      {rows.length === 0 ? "No members found" : "No results matching filter"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((member, idx) => (
                    <tr key={`${member.id}-${idx}`} className="hover:bg-secondary-blue/10 transition">
                      <td className="px-6 py-4 text-white font-medium">{member.admission_no || "—"}</td>
                      <td className="px-6 py-4 text-white font-medium">{member.full_name || "—"}</td>
                      <td className="px-6 py-4 text-secondary">{member.phone || "—"}</td>
                      <td className="px-6 py-4 text-secondary">{formatDate(member.joining_date)}</td>
                      <td className="px-6 py-4 text-secondary">{formatDate(member.expiry_date)}</td>
                      <td className="px-6 py-4 text-right">
                        {member.days_expired !== null ? (
                          <span className={member.days_expired > 0 ? "text-rose-400 font-semibold" : "text-white"}>
                            {member.days_expired > 0 ? `${member.days_expired} days` : "0 days"}
                          </span>
                        ) : (
                          <span className="text-emerald-400">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-secondary">{member.package_name || "—"}</td>
                      <td className="px-6 py-4 text-secondary">
                        {member.package_duration && member.package_duration.duration_value !== "—"
                          ? `${member.package_duration.duration_value} ${member.package_duration.duration_unit}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-secondary text-xs">
                        {member.active_addons && member.active_addons.length > 0
                          ? member.active_addons
                              .map((ao) => `${ao.name} (${ao.duration_value} ${ao.duration_unit})`)
                              .join("; ")
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-secondary">{formatDate(member.latest_bill_date)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isExpired(member.expiry_date)
                              ? "bg-rose-900/30 text-rose-200 border border-rose-700/50"
                              : "bg-emerald-900/30 text-emerald-200 border border-emerald-700/50"
                          }`}
                        >
                          {isExpired(member.expiry_date) ? "Expired" : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-secondary-blue/20 border-t border-secondary-blue text-sm text-secondary">
            Showing {filtered.length} of {rows.length} members
          </div>
        </div>
      )}
    </main>
  );
}
