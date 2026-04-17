
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  createDefaultRange,
  isRangeValid,
  formatDate,
  formatCurrency,
  downloadCsv,
} from "../utils/reportUtils";
import ReportDateRangeControls from "../components/ReportDateRangeControls";

const ReportsMemberCollection = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState(createDefaultRange());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isRangeValid(range)) {
        setData([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select(`
            id,
            bill_id,
            amount_paid,
            payment_date,
            method,
            status,
            bills (
              id,
              member_id,
              discount_amount,
              notes,
              package_variant_id,
              payment_mode,
              members ( full_name ),
              package_variants (
                id,
                pricing_type,
                duration_value,
                duration_unit,
                packages ( title )
              )
            )
          `)
          .in("status", ["paid", "partial", "completed", "success"])
          .gte("payment_date", range.from)
          .lte("payment_date", range.to)
          .order("payment_date", { ascending: false });

        if (paymentsError) throw paymentsError;

        const memberIds = [...new Set(payments.map(p => p.bills?.member_id).filter(Boolean))];

        const { data: addonsPivot, error: addonsError } = await supabase
          .from("member_add_ons")
          .select("member_id, add_on_id")
          .in("member_id", memberIds);

        if (addonsError) throw addonsError;

        const { data: masterAddOns, error: masterError } = await supabase
          .from("add_ons")
          .select("id, name")
          .in("id", [...new Set((addonsPivot || []).map(a => a.add_on_id))]);

        if (masterError) throw masterError;

        const addOnNamesMap = new Map((masterAddOns || []).map(a => [a.id, a.name]));

        const addonsMap = (addonsPivot || []).reduce((acc, item) => {
          if (!acc[item.member_id]) {
            acc[item.member_id] = [];
          }
          const name = addOnNamesMap.get(item.add_on_id);
          if (name) {
            acc[item.member_id].push(name);
          }
          return acc;
        }, {});

        const combinedData = payments.map(p => {
          const bill = p.bills;
          const memberId = bill?.member_id;
          const memberAddons = memberId ? addonsMap[memberId] || [] : [];
          const packageVariant = bill?.package_variants;
          const packageInfo = packageVariant ?
            `${packageVariant.packages.title} (${packageVariant.duration_value} ${packageVariant.duration_unit})` :
            "—";

          let packageName = packageInfo;
          if (memberAddons.length > 0) {
            if (packageName && packageName !== "—") {
              packageName = `${packageName}, ${memberAddons.join(", ")}`;
            } else {
              packageName = memberAddons.join(", ");
            }
          }

          return {
            payment_mode: p.method || bill?.payment_mode || "—",
            member_name: bill?.members?.full_name || "—",
            payment_date: formatDate(p.payment_date),
            amount_paid: p.amount_paid,
            remark: bill?.notes || "—",
            discount: bill?.discount_amount || 0,
            package: packageName,
          };
        });

        setData(combinedData);
      } catch (err) {
        setError("Failed to fetch collections data. " + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range]);

  const handleExport = () => {
    const headers = [
      "Payment Mode",
      "Member",
      "Date",
      "Amount",
      "Remark",
      "Discount",
      "Package",
    ];
    downloadCsv("member-collection-report.csv", headers, data.map(row => ({
      "Payment Mode": row.payment_mode,
      "Member": row.member_name,
      "Date": row.payment_date,
      "Amount": row.amount_paid,
      "Remark": row.remark,
      "Discount": row.discount,
      "Package": row.package,
    })));
  };

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Member Collection</h1>
          <p className="text-secondary">Payment-wise member collections</p>
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
            onClick={handleExport}
            disabled={loading || data.length === 0}
            className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-700/20 text-secondary hover:bg-slate-800/50 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-[1000px] sm:min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-800/50 text-secondary sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Payment Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Remark</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider bg-slate-800/50">Package</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8">Loading...</td></tr>
              ) : error ? (
                <tr><td colSpan="8" className="text-center py-8 text-red-500">{error}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-secondary">No collections in selected range.</td></tr>
              ) : (
                data.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{row.payment_mode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{row.member_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">{row.payment_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatCurrency(row.amount_paid)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">{row.remark}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatCurrency(row.discount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">{row.package}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default ReportsMemberCollection;
