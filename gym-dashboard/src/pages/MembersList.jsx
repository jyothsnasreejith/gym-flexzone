import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import ActionButtons from "../components/ActionButtons";
import { formatBatch } from "../utils/style";
import { isCountable } from "../utils/paymentStatus";

import { useToast } from "../context/ToastContext";

const PAGE_SIZE = 25;

export default function MembersList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const getBillPayable = (bill) => {
    const base = Number(bill.base_amount ?? 0);
    const discount = Number(bill.discount_amount ?? 0);
    const amount = Number(bill.amount ?? 0);
    const payableAttr = Number(bill.payable_amount ?? 0);
    
    // Priority: payable_amount (if significant), then amount, then base - discount
    if (payableAttr > 0) return payableAttr;
    if (amount > 0) return amount;
    return Math.max(base - discount, 0);
  };

  const getPaidAmount = (bill) =>
    (bill.payments || [])
      .filter((p) => isCountable(p.status))
      .reduce((pSum, p) => pSum + (Number(p.amount_paid) || 0), 0);

  const getBillDateValue = (bill) => {
    const raw = bill.billing_date || bill.due_date || bill.created_at || 0;
    const value = new Date(raw).getTime();
    return Number.isNaN(value) ? 0 : value;
  };

  const getBillKey = (bill) => {
    // Use bill ID as the key for add-on bills so multiple add-on bills are never
    // collapsed into each other. Package bills dedup by variant.
    if (bill.bill_type === "add_on") return `add_on:${bill.id}`;
    return `${bill.bill_type || "package"}:${bill.package_variant_id || bill.package_id || "none"}`;
  };

  const dedupeBillsByKey = (bills) => {
    const map = new Map();
    bills.forEach((bill) => {
      if (!bill?.id) return;
      const key = getBillKey(bill);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, bill);
        return;
      }

      const existingDate = getBillDateValue(existing);
      const billDate = getBillDateValue(bill);
      const existingPaid = getPaidAmount(existing);
      const billPaid = getPaidAmount(bill);

      let keep = existing;
      if (billPaid > existingPaid) {
        keep = bill;
      } else if (billPaid < existingPaid) {
        keep = existing;
      } else if (billDate > existingDate) {
        keep = bill;
      }

      if (keep !== existing) {
        map.set(key, keep);
      }
    });
    return Array.from(map.values());
  };

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const [members, setMembers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    package_id: "",
    trainer_id: "",
    search: "",
  });

  const filtersActive = Boolean(
    filters.package_id || filters.trainer_id || filters.search
  );

  /* ================= LOAD FILTER OPTIONS ================= */
  useEffect(() => {
    const loadFilters = async () => {
      const [{ data: pkgData }, { data: trData }] = await Promise.all([
        supabase.from("packages").select("id, title, is_student_offer"),
        supabase.from("trainers").select("id, full_name"),
      ]);

      setPackages(pkgData || []);
      setTrainers(trData || []);
    };

    loadFilters();
  }, []);

  /* ================= LOAD BILLS SUMMARY (for current page only) ================= */
  const loadBillsSummary = async (ids) => {
    const summaryMap = new Map();
    if (!ids.length) return summaryMap;

    // Fetch ALL bills including archived (is_current=false) — Fees.jsx uses
    // archived originals for gross/base calculation
    const bills = [];
    for (const chunk of chunkArray(ids, 200)) {
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("bills")
          .select("id, member_id, bill_type, package_variant_id, package_id, base_amount, discount_amount, amount, payable_amount, billing_date, due_date, created_at, is_current, notes")
          .in("member_id", chunk)
          .range(offset, offset + PAGE - 1);
        if (error) {
          console.warn("Failed to load bills chunk:", error);
          break;
        }
        bills.push(...(data || []));
        if (!data || data.length < PAGE) break;
        offset += PAGE;
      }
    }

    const billIds = bills.map((b) => b.id).filter(Boolean);
    const paymentsMap = new Map();
    for (const chunk of chunkArray(billIds, 200)) {
      const { data, error } = await supabase
        .from("payments")
        .select("bill_id, amount_paid, status")
        .in("bill_id", chunk);
      if (error) {
        console.warn("Failed to load payments:", error);
        continue;
      }
      (data || []).forEach((p) => {
        if (!paymentsMap.has(p.bill_id)) paymentsMap.set(p.bill_id, []);
        paymentsMap.get(p.bill_id).push(p);
      });
    }

    const billsByMember = new Map();
    bills.forEach((bill) => {
      if (!bill?.member_id) return;
      bill.payments = paymentsMap.get(bill.id) || [];
      if (!billsByMember.has(bill.member_id)) {
        billsByMember.set(bill.member_id, []);
      }
      billsByMember.get(bill.member_id).push(bill);
    });

    billsByMember.forEach((allBills, memberId) => {
      // Mirror Fees.jsx exactly:
      // rootBills = non-balance-payment bills (includes archived is_current=false)
      const isBalancePmt = (b) => b.notes && String(b.notes).startsWith('Balance Payment for');
      const rootBills = allBills.filter(b => !isBalancePmt(b));

      // Gross from root bills — NO dedup, same as Fees.jsx
      const totalGross = rootBills.reduce((s, b) => s + Number(b.base_amount || 0), 0);
      const billedPkgBase = rootBills.filter(b => b.bill_type !== 'add_on').reduce((s, b) => s + Number(b.base_amount || 0), 0);
      const billedAoBase = rootBills.filter(b => b.bill_type === 'add_on').reduce((s, b) => s + Number(b.base_amount || 0), 0);

      // Discount from ALL bills (same as Fees.jsx)
      const totalDisc = allBills.reduce((s, b) => s + Number(b.discount_amount || 0), 0);

      // Paid from ALL bills (same as Fees.jsx)
      const totalPaid = allBills.reduce((s, b) => s + getPaidAmount(b), 0);

      // Net payable = gross - discount (same as Fees.jsx totalPayableNet)
      const totalPayable = Math.max(0, totalGross - totalDisc);
      const outstanding = Math.max(0, totalPayable - totalPaid);

      summaryMap.set(memberId, {
        totalPayable,
        totalPaid,
        outstanding,
        totalDisc,
        billedPkgBase,
        billedAoBase,
      });
    });

    return summaryMap;
  };

  /* ================= LOAD MEMBERS (server-side paginated) ================= */
  const loadMembers = useCallback(async () => {
    setLoading(true);

    try {
      /* --- resolve package filter to variant IDs (server-side) --- */
      let variantIds = [];
      if (filters.package_id) {
        const { data: variants } = await supabase
          .from("package_variants")
          .select("id")
          .eq("package_id", filters.package_id);
        variantIds = (variants || []).map((v) => v.id);
        if (variantIds.length === 0) {
          // No variants for this package → empty result
          setMembers([]);
          setLoading(false);
          return;
        }
      }

      /* --- build shared filter helper --- */
      const applySharedFilters = (query) => {
        if (filters.trainer_id) {
          query = query.eq("trainer_id", filters.trainer_id);
        }
        if (variantIds.length > 0) {
          query = query.in("package_variant_id", variantIds);
        }
        if (filters.search) {
          const term = filters.search.trim();
          query = query.or(
            `full_name.ilike.%${term}%,phone.ilike.%${term}%,admission_no.ilike.%${term}%`
          );
        }
        return query;
      };

      /* --- MAIN DATA query (no range - load all) --- */
      const dataQuery = applySharedFilters(
        supabase
          .from("members")
          .select(
            `
            id,
            admission_no,
            full_name,
            phone,
            area,
            batch,
            joining_date,
            created_at,
            end_date,
            profile_image_url,
            trainer_id,
            trainers ( full_name ),
            package_variants (
              id,
              pricing_type,
              duration_unit,
              duration_value,
              sessions_total,
              price,
              package_id,
              packages ( is_student_offer )
            )
          `
          )
          .eq("is_deleted", false)
          .order("joining_date", { ascending: false })
      );

      const { data: membersData, error: membersError } = await dataQuery;

      if (membersError) throw membersError;

      const memberIds = (membersData || []).map((m) => m.id).filter(Boolean);

      /* --- secondary data scoped to current page only --- */
      const safeIds = memberIds.length > 0 ? memberIds : [0];

      const [
        { data: financialsData, error: financialsError },
        { data: pivotData, error: pivotError },
        { data: packageHistoryData, error: packageHistoryError },
        billsSummary,
      ] = await Promise.all([
        supabase.from("member_financials").select("*").in("member_id", safeIds),
        supabase
          .from("member_add_ons")
          .select("member_id, add_on_id, start_date, end_date, add_ons ( id, name, amount )")
          .in("member_id", safeIds),
        supabase
          .from("member_packages")
          .select("member_id, start_date")
          .in("member_id", safeIds)
          .order("start_date", { ascending: false }),
        loadBillsSummary(memberIds),
      ]);

      if (financialsError) throw financialsError;
      if (pivotError) console.warn("Pivot load failed:", pivotError);
      if (packageHistoryError) console.warn("Package history load failed:", packageHistoryError);

      const financialsMap = new Map(
        (financialsData || []).map((f) => [f.member_id, f])
      );

      const packageHistoryMap = new Map();
      if (Array.isArray(packageHistoryData)) {
        for (const record of packageHistoryData) {
          if (!packageHistoryMap.has(record.member_id)) {
            packageHistoryMap.set(record.member_id, record.start_date);
          }
        }
      }

      const memberAddOnsMap = new Map();
      const rows = pivotData || [];
      rows.forEach((r) => {
        const mId = r.member_id;
        if (!memberAddOnsMap.has(mId)) memberAddOnsMap.set(mId, []);
        memberAddOnsMap.get(mId).push({
          name: r.add_ons?.name,
          amount: Number(r.add_ons?.amount || 0),
          end_date: r.end_date,
        });
      });

      const addOnMap = new Map();
      memberAddOnsMap.forEach((addons, mId) => {
        addOnMap.set(mId, addons.filter(a => a.name).map(a => ({ name: a.name, end_date: a.end_date })));
      });

      const computeExpiryDate = (member, historyMap) => {
        // Always calculate fresh from joining_date, ignoring stored member.end_date
        // (stored values were calculated from created_at instead of joining_date)
        // Only renewals will update member.end_date correctly going forward
        const variant = member.package_variants;
        if (!variant || variant.pricing_type !== "duration") return null;

        // Use joining_date as the base (when member actually joined), not package start_date
        const baseDate = member.joining_date || member.created_at;

        if (!baseDate) return null;

        const start = new Date(baseDate);
        const unit = variant.duration_unit?.toLowerCase();
        const value = Number(variant.duration_value || 0);
        if (!value || !unit) return null;

        const expiry = new Date(start);
        if (unit === "month") {
          expiry.setMonth(expiry.getMonth() + value);
        } else if (unit === "year") {
          expiry.setFullYear(expiry.getFullYear() + value);
        } else if (unit === "day" || unit === "days") {
          expiry.setDate(expiry.getDate() + value);
        } else {
          return null;
        }
        return expiry.toISOString().slice(0, 10);
      };

      const normalized = (membersData || []).map((m) => {
        const financials = financialsMap.get(m.id) || {};
        const summary = billsSummary.get(m.id) || { totalPayable: 0, totalPaid: 0, outstanding: 0, totalDisc: 0, billedPkgBase: 0, billedAoBase: 0 };
        const assignedAddOns = memberAddOnsMap.get(m.id) || [];

        // Calculate Unbilled — compare total config vs total billed base (not per-type)
        // This handles combined bills where package+add-ons share one bill_type='package' bill
        const pkgPrice = Number(m.package_variants?.price || 0);
        const aoTotalPrice = assignedAddOns.reduce((s, a) => s + a.amount, 0);
        const totalConfigPrice = pkgPrice + aoTotalPrice;
        const totalBilledBase = (summary.billedPkgBase || 0) + (summary.billedAoBase || 0);
        const totalUnbilled = Math.max(0, totalConfigPrice - totalBilledBase);

        const computedPaidAmount = summary.totalPaid;
        const billedOutstanding = summary.outstanding;
        const totalDisc = summary.totalDisc;

        // Include unbilled items in outstanding (matches Fees.jsx)
        const totalOutstanding = billedOutstanding + totalUnbilled;

        // Total Payable: Billed base + unbilled + discount (Gross)
        const computedTotalAmount = (summary.totalPayable + totalDisc) + totalUnbilled;

        let packageLabel = "—";
        if (m.package_variants) {
          const variant = m.package_variants;
          const pkg = packages.find((p) => p.id === variant.package_id);
          let details = "";
          if (variant.pricing_type === "duration") {
            details = ` (${variant.duration_value} ${variant.duration_unit === "month" ? "Months" : "Years"})`;
          } else {
            details = ` (${variant.sessions_total} Sessions)`;
          }
          packageLabel = `${pkg?.title || ""}${details}`;
        }

        const addOnItems = addOnMap.get(m.id) || [];

        return {
          ...m,
          ...financials,
          total_amount: computedTotalAmount,
          total_paid: computedPaidAmount,
          due_amount: totalOutstanding,
          trainer_name: m.trainers?.full_name || "—",
          package_id: m.package_variants?.package_id ?? null,
          is_student_offer: m.package_variants?.packages?.is_student_offer ?? false,
          package_label: packageLabel,
          add_on_items: addOnItems,
          area: m.area || "—",
          expiry_date:
            computeExpiryDate(m, packageHistoryMap) || null,
        };
      });

      setMembers(normalized);
    } catch (error) {
      console.error("Failed to load members:", error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [filters, packages]);

  /* ================= TRIGGER LOAD ON FILTER CHANGE ================= */
  useEffect(() => {
    if (packages.length === 0) return;
    loadMembers();
  }, [filters, packages]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================= REFRESH ON FOCUS ================= */
  useEffect(() => {
    const onFocus = () => loadMembers();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadMembers]);

  /* ================= DELETE ================= */
  const deleteMember = async (id) => {
    if (!window.confirm("Delete this member permanently?")) return;

    const { error } = await supabase
      .from("members")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_deleted", false);

    if (error) {
      showToast("Delete failed", "error");
      return;
    }

    showToast("Member deleted successfully", "success");
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 h-[calc(100vh-56px)] lg:h-screen flex flex-col overflow-hidden bg-navy">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/trash")}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-800/50 text-sm font-medium"
          >
            Trash
          </button>
          <button
            onClick={() => navigate("/members/new")}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-semibold text-sm"
          >
            + Add Member
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-card border rounded-xl p-3 mb-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          className="border rounded-lg px-3 h-10 text-sm w-full bg-card text-white"
        />

        <select
          value={filters.package_id}
          onChange={(e) =>
            setFilters((f) => ({ ...f, package_id: e.target.value }))
          }
          className="border rounded-lg px-3 h-10 text-sm w-full bg-card text-white"
        >
          <option value="">All Packages</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          value={filters.trainer_id}
          onChange={(e) =>
            setFilters((f) => ({ ...f, trainer_id: e.target.value }))
          }
          className="border rounded-lg px-3 h-10 text-sm w-full bg-card text-white"
        >
          <option value="">All Trainers</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            onClick={() => setFilters({ package_id: "", trainer_id: "", search: "" })}
            className="h-10 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-white font-semibold text-sm justify-self-start md:justify-self-auto"
          >
            Clear
          </button>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-card border rounded-xl flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-800/50 text-secondary sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold w-12 bg-slate-800/50">#</th>
                <th className="px-5 py-3 text-left font-semibold bg-slate-800/50">Member</th>
                <th className="px-5 py-3 text-left font-semibold bg-slate-800/50">
                  Outstanding
                </th>
                <th className="px-5 py-3 text-left font-semibold bg-slate-800/50">
                  Package &amp; Add-Ons
                </th>
                <th className="px-5 py-3 text-left font-semibold bg-slate-800/50">
                  Trainer
                </th>
                <th className="px-5 py-3 text-left font-semibold bg-slate-800/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!loading &&
                members.map((m, idx) => {
                  const totalAmount = Number(m.total_amount || 0);
                  const dueAmount = Number(m.due_amount || 0);
                  const hasBilling = totalAmount > 0;
                  const paymentDisplay =
                    dueAmount > 0 ? `\u20B9${dueAmount}` : "-";
                  const paymentClass = !hasBilling
                    ? "text-secondary"
                    : dueAmount > 0
                      ? "text-red-800 font-semibold"
                      : "text-green-600 font-semibold";
                  const rowClass = !hasBilling
                    ? "bg-gray-100 hover:bg-gray-200"
                    : dueAmount > 0
                      ? "bg-red-200 hover:bg-red-300"
                      : "bg-card hover:bg-card-hover text-white";

                  // Row number in the current list
                  const rowNum = idx + 1;

                  return (
                    <tr
                      key={m.id}
                      className={`${rowClass} cursor-pointer`}
                      onClick={() => navigate(`/members/${m.id}`)}
                    >
                      <td className="px-4 py-4 text-sm text-secondary font-semibold">
                        {rowNum}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center font-semibold flex-shrink-0">
                            {m.profile_image_url ? (
                              <img
                                src={`${m.profile_image_url}?t=${Date.now()}`}
                                alt={m.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              m.full_name?.charAt(0)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate flex items-center gap-1.5">
                              {m.full_name}
                              {m.is_student_offer && (
                                <span title="Student Offer" className="text-xs">🎓</span>
                              )}
                            </div>
                            <div className="text-xs text-secondary font-mono">
                              {m.admission_no}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className={paymentClass}>
                          {paymentDisplay}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          {m.package_label && m.package_label !== "—" ? (
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-white">{m.package_label}</span>
                              {m.expiry_date && (
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  · Exp: {fmtDate(m.expiry_date)}
                                </span>
                              )}
                            </div>
                          ) : (
                            m.add_on_items.length === 0 && <span className="text-sm text-gray-400">—</span>
                          )}
                          {m.add_on_items.map((ao, i) => (
                            <div key={i} className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-xs text-secondary">{ao.name}</span>
                              {ao.end_date ? (
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  · Exp: {fmtDate(ao.end_date)}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {m.trainer_name}
                      </td>
                      <td className="px-5 py-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <ActionButtons
                              size="sm"
                              onDelete={() => deleteMember(m.id)}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {/* Mobile Card View */}
          <div className="md:hidden">
            {!loading &&
              members.map((m, idx) => {
                const dueAmount = Number(m.due_amount || 0);
                const paymentClass = dueAmount > 0 ? "text-red-600 font-semibold" : "text-green-600";
                return (
                  <div
                    key={m.id}
                    className="border-b p-4 cursor-pointer"
                    onClick={() => navigate(`/members/${m.id}`)}
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center font-semibold flex-shrink-0">
                        {m.profile_image_url ? (
                          <img
                            src={`${m.profile_image_url}?t=${Date.now()}`}
                            alt={m.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          m.full_name?.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5">
                          {m.full_name}
                          {m.is_student_offer && (
                            <span className="text-xs">🎓</span>
                          )}
                        </div>
                        <div className="text-xs text-secondary font-mono">
                          {m.admission_no}
                        </div>
                        <div className={`text-sm mt-1 ${paymentClass}`}>
                          Pending: ₹{dueAmount}
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ActionButtons
                          size="sm"
                          onDelete={() => deleteMember(m.id)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          {loading && <p className="text-center py-8">Loading members...</p>}
          {!loading && members.length === 0 && (
            <p className="text-center py-8 text-secondary">No members found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
