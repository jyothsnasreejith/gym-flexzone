import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PageHeader from "../components/PageHeader";
import { formatBatch } from "../utils/style";
import { generateInvoice } from "../utils/generateInvoice";
import { shareInvoice } from "../utils/communicationHelpers";
import AssignPackageAndAddOnsModal from "../modals/AssignPackageAndAddOnsModal";
import ProfilePhotoModal from "../modals/ProfilePhotoModal";
import { useModal } from "../context/ModalContext";
import { isCountable } from "../utils/paymentStatus";

/* =========================
   VALUE FORMATTERS (UNCHANGED)
 ========================= */
const val = (v, suffix = "") =>
  v !== null && v !== undefined && v !== "" ? `${v}${suffix}` : "—";

const formatDiscount = (type, value) =>
  type === "percent" ? `${value}%` : `₹${value}`;

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = String(dt.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const formatTime = (t) =>
  t ? String(t).slice(0, 5) : "-";

const formatAddOnDuration = (addon) => {
  const value = addon?.duration_value;
  const unit = addon?.duration_unit;
  if (!value || !unit) return "-";
  return `${value} ${unit}`;
};

const isWithinOrPastDays = (dateStr, daysBefore) => {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diffDays <= daysBefore;
};

const computeExpiryDate = (member, packageHistory) => {
  // Always calculate fresh from joining_date, ignoring stored member.end_date
  // (stored values were calculated from created_at instead of joining_date)
  // Only renewals will update member.end_date correctly going forward
  const variant = member?.package_variants;
  if (!variant || variant.pricing_type !== "duration") return null;

  // Use joining_date as the base, not package start_date (which is creation time, not membership start)
  const baseDate = member.joining_date || member.created_at;

  if (!baseDate) return null;

  const start = new Date(baseDate);
  const unit = variant.duration_unit;
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

const getBillingStatus = (fin, calculatedExpiry = null) => {
  if (!fin || !fin.total_amount) {
    return {
      label: "No Bill",
      tone: "neutral",
      sub: "No billing record found",
    };
  }

  // Use calculated expiry from joining_date, not database value
  const expiryToUse = calculatedExpiry || fin.expiry_date;

  if (fin.due_amount > 0) {
    return {
      label: fin.expiring_soon ? "Payment Due · Expiring Soon" : "Payment Due",
      tone: fin.expiring_soon ? "warning" : "danger",
      sub: expiryToUse
        ? `Expires on ${formatDate(expiryToUse)}`
        : "Expiry date missing",
    };
  }

  if (fin.expiring_soon) {
    return {
      label: "Expiring Soon",
      tone: "warning",
      sub: `Valid till ${formatDate(expiryToUse)}`,
    };
  }

  return {
    label: "Fully Paid",
    tone: "success",
    sub: `Valid till ${formatDate(expiryToUse)}`,
  };
};

export default function Members() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { openModal } = useModal();

  const [member, setMember] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [assignedOffers, setAssignedOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberPackage, setMemberPackage] = useState(null);
  const [latestBill, setLatestBill] = useState(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [packageHistory, setPackageHistory] = useState([]);
  const [memberAddOns, setMemberAddOns] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [dependentsOpen, setDependentsOpen] = useState({});
  const [bills, setBills] = useState([]);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  /* =========================
     FETCH DATA
  ========================= */
  const loadMember = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("members")
        .select(
          `
            id,
            admission_no,
            full_name,
            phone,
            email,
            status,
            gender,
            dob,
            joining_date,
            created_at,
            end_date,
            address,
            area,
            district,
            pin_code,
            emergency_contact,
            emergency_relation,
            height_cm,
            weight_kg,
            bmi,
            heart_rate,
            blood_pressure,
            sugar_level,
            profile_image_url,
            batch,
            batch_start_time,
            batch_end_time,
            medical_issues,
            medical_other,
            id_proof_type,
            id_proof_url,
            payment_mode,
            payment_reference,
            discount_amount,
            final_amount,
            package_variant_id,
            package_variants (
              id,
              pricing_type,
              duration_value,
              duration_unit,
              price,
              packages (
                title,
                is_student_offer
              )
            )
          `
        )
        .eq("id", id)
        .eq("is_deleted", false)
        .single();

      if (error) throw error;
      setMember(data);

      // Extract package info
      if (data?.package_variants) {
        setMemberPackage({
          packageTitle: data.package_variants.packages?.title || "Unknown Package",
          price: data.package_variants.price,
          duration:
            data.package_variants.pricing_type === "duration"
              ? `${data.package_variants.duration_value} ${data.package_variants.duration_unit}`
              : "Session based",
        });
      } else {
        setMemberPackage(null);
      }

      const { data: fin, error: finError } = await supabase
        .from("member_financials")
        .select(
          "total_amount, total_paid, due_amount, expiry_date, expiring_soon"
        )
        .eq("member_id", id)
        .maybeSingle();

      setFinancials(fin ?? null);

      // Fetch latest bill for invoice generation
      const { data: billData } = await supabase
        .from("bills")
        .select(`
            id,
            billing_date,
            due_date,
            amount,
            base_amount,
            discount_amount,
            bill_type,
            package_variant_id,
            payment_mode,
            payment_status,
            payments (
              id,
              amount_paid,
              payment_date,
              method,
              status
            )
          `)
        .eq("member_id", id)
        .order("due_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestBill(billData);

      // Fetch ALL bills with payments for Payment History section
      const { data: allBillsData } = await supabase
        .from("bills")
        .select(`
            *,
            packages:packages!bills_package_id_fkey(title),
            package_variants(duration_value, duration_unit),
            payments(amount_paid, status)
          `)
        .eq("member_id", id)
        .order("billing_date", { ascending: false });
      setBills(allBillsData || []);

      const { data: oa } = await supabase
        .from("offer_assignments")
        .select(
          `
            offers (
              id,
              title,
              discount_type,
              discount_value,
              start_date,
              end_date,
              is_active
            )
          `
        )
        .eq("target_type", "member")
        .eq("target_id", id);

      setAssignedOffers((oa || []).map((x) => x.offers));

      const { data: ma, error: maError } = await supabase
        .from("member_add_ons")
        .select("add_on_id, start_date, end_date")
        .eq("member_id", id);

      if (maError) {
        setMemberAddOns([]);
      } else {
        const rows = ma || [];
        const ids = rows.map((r) => String(r.add_on_id));

        if (ids.length > 0) {
          const { data: addOnRows, error: addOnErr } = await supabase
            .from("add_ons")
            .select("id, name, duration_value, duration_unit, amount")
            .in("id", ids);

          if (!addOnErr && Array.isArray(addOnRows)) {
            const addOnMap = new Map(addOnRows.map((row) => [String(row.id), row]));
            setMemberAddOns(
              rows.map((row) => ({
                ...row,
                add_ons: addOnMap.get(String(row.add_on_id)) || null,
              }))
            );
          } else {
            setMemberAddOns(rows.map(r => ({ ...r, add_ons: null })));
          }
        } else {
          setMemberAddOns([]);
        }
      }

      // Load referrals made by this member
      const { data: refData } = await supabase
        .from("referrals")
        .select(`
          id,
          reward_amount,
          reward_applied,
          created_at,
          referee:referee_id (
            id,
            full_name,
            phone,
            package_variant_id,
            package_variants:package_variant_id (
              id,
              price,
              package_id,
              packages:package_id (
                title,
                is_student_offer
              )
            )
          )
        `)
        .eq("referrer_id", id);
      setReferrals(refData || []);


    } catch (err) {
      console.error(err);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  useEffect(() => {
    if (!id) return;

    const loadPackageHistory = async () => {
      const { data, error } = await supabase
        .from("member_packages")
        .select(
          `
        id,
        start_date,
        end_date,
        status,
        packages:packages!member_packages_package_id_fkey (
          title,
          category
        )
      `
        )
        .eq("member_id", id)
        .order("start_date", { ascending: false });

      if (error) {
        console.error("Package history load error:", error);
      } else {
        setPackageHistory(data || []);
      }
    };

    loadPackageHistory();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const loadDependents = async () => {
      const { data, error } = await supabase
        .from("member_dependents")
        .select(
          "id, full_name, email, phone, gender, dob, joining_date, relation, address, area, district, pin_code, emergency_contact, emergency_relation, batch_slot_id, batch_start_time, batch_end_time, height_cm, weight_kg, bmi, heart_rate, blood_pressure, sugar_level, medical_issues, medical_other, profile_image_url, id_proof_type, id_proof_url"
        )
        .eq("member_id", id)
        .order("id", { ascending: true });

      if (!error) {
        setDependents(data || []);
      } else {
        console.error("LOAD DEPENDENTS ERROR:", error);
        setDependents([]);
      }
    };

    loadDependents();
  }, [id]);

  /* =========================
     SEND INVOICE VIA WHATSAPP
  ========================= */
  const sendInvoiceReminder = async () => {
    if (!latestBill || !memberPackage) {
      alert("Unable to share invoice. Missing bill or package information.");
      return;
    }

    setSendingInvoice(true);
    try {
      await shareInvoice({
        member,
        packageInfo: memberPackage,
        bill: latestBill,
        financials
      });
    } catch (error) {
      console.error("Error sharing invoice:", error);
      alert(error.message || "Failed to share invoice.");
    } finally {
      setSendingInvoice(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!member) return <div className="p-6">Member not found</div>;

  // Compute isExpired first
  const joinedOn = member.joining_date || member.created_at;
  const derivedExpiry = computeExpiryDate(member, packageHistory);
  // Always use derivedExpiry (calculated from joining_date), not stored values
  const packageExpiry = derivedExpiry || member.end_date || null;
  const addOnExpiries = memberAddOns.map(r => r.end_date).filter(Boolean);
  const maxAddOnExpiry = addOnExpiries.length > 0 ? addOnExpiries.reduce((a, b) => a > b ? a : b) : null;
  
  const finalExpiry = (packageExpiry && maxAddOnExpiry)
    ? (packageExpiry > maxAddOnExpiry ? packageExpiry : maxAddOnExpiry)
    : (packageExpiry || maxAddOnExpiry);

  // Determine if actually expired (past today, not just expiring soon)
  const isExpired = (() => {
    if (!finalExpiry) return false;
    const expDate = new Date(finalExpiry);
    expDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expDate < today;
  })();

  // Make isActive dynamic based on expiry status, not static member.status
  const isActive = !isExpired && member.status?.toLowerCase() === "active" && finalExpiry !== null;
  
  const profileImage = member.profile_image_url
    ? `${member.profile_image_url}?t=${Date.now()}`
    : null;
    
  const validTill = finalExpiry 
    ? formatDate(finalExpiry) 
    : (member?.package_variants ? "No expiry" : "—");
  const packageExpiryDate = finalExpiry;
  const packageExpiringSoon = isWithinOrPastDays(packageExpiryDate, 2);
  const addOnExpiringSoon = memberAddOns.some((row) =>
    isWithinOrPastDays(row?.end_date, 2)
  );
  const showRenewButton = packageExpiringSoon || addOnExpiringSoon;
  
  const addOnSummary = memberAddOns
    .map((row) => row.add_ons?.name)
    .filter(Boolean)
    .join(", ");
  const addOnItems = Array.from(
    new Map(
      memberAddOns
        .map((row) => row.add_ons)
        .filter(Boolean)
        .map((addon) => [addon.id ?? addon.name, addon])
    ).values()
  );
  const getBillPayable = (bill) => {
    if (bill.payable_amount !== undefined && bill.payable_amount !== null) {
      return Number(bill.payable_amount);
    }
    const base = Number(bill.base_amount ?? 0);
    const discount = Number(bill.discount_amount ?? 0);
    const amount = Number(bill.amount ?? 0);
    if (amount !== undefined && amount !== null && amount > 0) return amount;
    return Math.max(base - discount, 0);
  };

  const getBillGross = (bill) => {
    const base = Number(bill.base_amount ?? 0);
    const amount = Number(bill.amount ?? 0);
    const payable = Number(bill.payable_amount ?? 0);
    const discount = Number(bill.discount_amount ?? 0);
    const net = getBillPayable(bill);
    const candidates = [base, amount, payable].filter((v) => v > 0);
    let gross = candidates.length > 0 ? Math.max(...candidates) : net;
    if (discount > 0 && net > 0 && gross <= net) {
      gross = net + discount;
    }
    return gross;
  };

  const getBillDiscountForStats = (bill) => {
    const discount = Number(bill.discount_amount ?? 0);
    if (discount > 0) return discount;
    const gross = getBillGross(bill);
    const net = getBillPayable(bill);
    return Math.max(gross - net, 0);
  };

  const processedBills = bills.map((b) => {
    const paid = (b.payments || [])
      .filter((p) => isCountable(p.status))
      .reduce((s, p) => s + Number(p.amount_paid || 0), 0);
    const payable = getBillPayable(b);
    return {
      ...b,
      paid,
      payable,
      status: (paid >= payable && payable > 0) ? "paid" : (paid > 0 ? "partial" : "unpaid")
    };
  });
  // Helper: Detect balance payment bills (same as Fees page)
  const isBalancePaymentBill = (bill) =>
    !!(bill.notes && bill.notes.startsWith('Balance Payment for'));

  // Dedup bills by key (same logic as Fees page)
  const getBillKey = (bill) => {
    if (bill.bill_type === "add_on") return `add_on:${bill.id}`;
    if (isBalancePaymentBill(bill)) return `balance:${bill.id}`;
    return `${bill.bill_type || "package"}:${bill.package_variant_id || bill.package_id || "none"}`;
  };

  const dedupedBills = (() => {
    const map = new Map();
    processedBills.forEach((bill) => {
      if (!bill?.id) return;
      const key = getBillKey(bill);
      const existing = map.get(key);
      if (!existing) { map.set(key, bill); return; }
      // Keep the one with higher paid amount, or newer date
      const existingPaid = existing.paid || 0;
      const billPaid = bill.paid || 0;
      if (billPaid > existingPaid) map.set(key, bill);
      else if (billPaid === existingPaid) {
        const existingDate = new Date(existing.billing_date || existing.due_date).getTime() || 0;
        const billDate = new Date(bill.billing_date || bill.due_date).getTime() || 0;
        if (billDate > existingDate) map.set(key, bill);
      }
    });
    return Array.from(map.values());
  })();

  // displayBills: bills shown in the payment history table, grouped by date
  const displayBills = (() => {
    const groups = new Map();
    dedupedBills.forEach((b) => {
      // Balance payment bills should NEVER be grouped with other bills
      if (isBalancePaymentBill(b)) {
        groups.set(`balance_${b.id}`, [b]);
        return;
      }
      const dateKey = new Date(b.billing_date || b.due_date).toLocaleDateString("en-GB");
      // Use created_at to differentiate "sessions" - 30 second window
      const timeRef = new Date(b.created_at || b.billing_date).getTime();
      const sessionKey = Math.floor(timeRef / (1000 * 30));
      const groupKey = `${dateKey}_${sessionKey}`;

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(b);
    });

    return Array.from(groups.values())
      .map((group) => {
        if (group.length === 1) return group[0];
        const main = group.find((b) => b.bill_type !== "add_on") || group[0];
        const mergedPaid = group.reduce((s, b) => s + b.paid, 0);
        const mergedPayable = group.reduce((s, b) => s + b.payable, 0);
        
        // Construct merged title for display
        const titles = group
          .map((b) => {
            if (b.bill_type === "add_on") {
              if (b.notes?.includes("Add-on:")) return b.notes.split("Add-on:")[1].trim();
              const notePart = b.notes?.split(":")[1]?.split("(")[0]?.trim();
              return notePart || "Add-on";
            }
            return b.packages?.title || "Package";
          })
          .join(" + ");

        return {
          ...main,
          isMerged: true,
          status: (mergedPaid >= mergedPayable && mergedPayable > 0) ? "paid" : (mergedPaid > 0 ? "partial" : "unpaid"),
          mergedPaid,
          mergedPayable,
          mergedTitles: titles,
          mergedBills: group,
        };
      })
      .filter((b) => b.status !== "unpaid" || b.is_current !== false)
      .sort((a, b) => {
        const da = new Date(a.billing_date || a.due_date);
        const db = new Date(b.billing_date || b.due_date);
        return db - da;
      });
  })();

  // currentBillsForStats: ALL active (non-archived) bills, including unpaid ones
  // Used for the outstanding/due amount calculation so unpaid add-on bills are counted
  const currentBillsForStats = processedBills.filter((b) => b.is_current !== false);

  const billsSummaryTotals = (() => {
    // Match the Fee page calculation exactly:
    // Use config prices (package + add-ons) as the gross baseline
    const pkgPrice = Number(member?.package_variants?.price || 0);
    const aoTotal = memberAddOns.reduce(
      (sum, row) => sum + Number(row.add_ons?.amount || 0), 0
    );
    const totalConfigPrice = pkgPrice + aoTotal;

    // Root bills = ALL non-balance-payment bills (including archived) — matches Fee page
    const rootBills = processedBills.filter((b) => !isBalancePaymentBill(b));
    const billedBase = rootBills.reduce((s, b) => s + Number(b.base_amount || 0), 0);

    // Total Gross = billed base + anything still unbilled from config
    const totalUnbilled = Math.max(0, totalConfigPrice - billedBase);
    const totalGross = billedBase + totalUnbilled;

    // Total Discount = from ALL bills including archived (matches Fee page)
    const totalDisc = processedBills.reduce(
      (s, b) => s + Number(b.discount_amount ?? 0), 0
    );

    // Total Payable Net (after discount)
    const totalPayableNet = Math.max(0, totalGross - totalDisc);

    // Total Paid = from ALL bills
    const totalPaid = processedBills.reduce((s, b) => s + Number(b.paid || 0), 0);

    // Outstanding
    const outstanding = Math.max(0, totalPayableNet - totalPaid);

    // Display "Total Payable" as totalGross (before discount), matching Fee page
    return { totalPayableNet: totalGross, totalDisc, totalPaid, outstanding };
  })();

  const totalAmount = billsSummaryTotals
    ? billsSummaryTotals.totalBase
    : Number(financials?.total_amount || 0);
  const dueAmount = billsSummaryTotals
    ? billsSummaryTotals.outstanding
    : Number(financials?.due_amount || 0);
  const hasBilling = totalAmount > 0;
  const hasOutstanding = dueAmount > 0;
  const isFullyPaid = hasBilling && dueAmount === 0;
  const phoneValid = member.phone?.replace(/\D/g, "").length >= 10;
  const latestPackageHistory =
    packageHistory.length > 0
      ? [
          packageHistory.reduce((latest, current) => {
            const latestDate =
              latest?.end_date || latest?.start_date || latest?.created_at || null;
            const currentDate =
              current?.end_date || current?.start_date || current?.created_at || null;

            const latestValue = latestDate ? new Date(latestDate).getTime() : 0;
            const currentValue = currentDate ? new Date(currentDate).getTime() : 0;

            if (Number.isNaN(latestValue)) return current;
            if (Number.isNaN(currentValue)) return latest;

            return currentValue > latestValue ? current : latest;
          }),
        ]
      : [];

  const toggleDependentOpen = (depId) => {
    setDependentsOpen((prev) => ({
      ...prev,
      [depId]: !prev[depId],
    }));
  };

  // Helper function to build bill label with package name and add-ons
  const getBillLabel = (bill) => {
    const notes = bill.notes || "";

    // For balance payment bills, extract items from notes
    if (isBalancePaymentBill(bill)) {
      const afterPrefix = notes.replace(/^Balance Payment for\s*/i, "");
      const addOnSplit = afterPrefix.match(/^(.+?)\s*\+\s*Add-ons?:\s*(.+)/i);
      if (addOnSplit) {
        const pkgTitle = addOnSplit[1].split('. Original')[0].trim() || bill.packages?.title || "Package";
        const addOnLabel = addOnSplit[2].split('. Original')[0].trim();
        return `${pkgTitle} + ${addOnLabel}`;
      }
      return afterPrefix.split('. Original')[0].trim() || bill.packages?.title || "Package";
    }

    // For add-on bills
    if (bill.bill_type === "add_on") {
      const notesMatch = notes.match(/Add-ons?:\s*(.+)/i);
      return notesMatch ? `Add-On: ${notesMatch[1].trim()}` : "Add-On";
    }
    
    // For package bills — read from joined package data
    const pkgTitle = bill.packages?.title || null;
    const durVal = bill.package_variants?.duration_value;
    const durUnit = bill.package_variants?.duration_unit;
    const duration = durVal && durUnit ? `${durVal} ${durUnit}` : null;
    
    // Check if it also includes add-ons (combined bill)
    const notesMatch = notes.match(/\+\s*Add-ons?:\s*(.+)/i);
    const addOnSuffix = notesMatch ? ` + ${notesMatch[1].trim()}` : "";
    
    if (pkgTitle && duration) return `${pkgTitle} (${duration})${addOnSuffix}`;
    if (pkgTitle) return `${pkgTitle}${addOnSuffix}`;
    return "Package";
  };

  return (
    <main className="min-h-screen bg-navy">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-primary-blue shadow-lg border-b border-secondary-blue">
        <PageHeader title="Member Profile" backTo="/members" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-gold border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted">Loading member profile...</p>
          </div>
        </div>
      ) : !member ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-red-500 font-semibold">Member not found</p>
          </div>
        </div>
      ) : (
        <>
        <div className="p-6 sm:p-10 mx-auto w-full space-y-10">
        
        {/* ===== HERO SECTION ===== */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase ${
                isExpired ? 'badge-error' : isActive ? 'badge-success' : 'bg-secondary-blue bg-opacity-50 text-secondary'
              }`}>
                {isExpired ? 'Expired' : isActive ? 'Active Member' : 'Inactive'}
              </span>
              <span className="text-secondary text-sm font-medium">ADMISSION #{member.admission_no}</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">{member.full_name}</h1>
            <p className="text-secondary max-w-xl text-base">
              {memberPackage?.packageTitle || 'No package'} • {memberPackage?.duration || '—'} 
              {addOnSummary ? ` + ${addOnSummary}` : ''}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {member.phone && (
              <button
                onClick={() => window.open(`https://wa.me/91${member.phone.replace(/\D/g, '')}`, '_blank')}
                className="bg-secondary-blue text-white px-6 py-2.5 rounded-md font-semibold text-sm hover:bg-primary-blue transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">phone</span> Contact
              </button>
            )}
            <button
              onClick={() => navigate(`/members/${id}/edit`)}
              className="bg-gold text-navy px-6 py-2.5 rounded-md font-semibold text-sm hover:bg-gold-bright transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">edit</span> Edit Profile
            </button>
          </div>
        </section>

        {/* ===== QUICK ACTION CARDS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-primary-blue p-6 rounded-xl space-y-3 flex flex-col justify-between group cursor-pointer hover:-translate-y-1 transition-all shadow-lg"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary-blue flex items-center justify-center text-gold">
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg font-headline text-white">Modify Package</h3>
              <p className="text-secondary text-sm">{memberPackage?.packageTitle || 'No package'}</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/billing", { state: { memberId: member.id } })}
            className="bg-primary-blue p-6 rounded-xl space-y-3 flex flex-col justify-between group cursor-pointer hover:-translate-y-1 transition-all shadow-lg"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary-blue flex items-center justify-center text-gold">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg font-headline text-white">Fee Details</h3>
              <p className="text-secondary text-sm">
                {financials?.expiring_soon ? 'Due Soon' : financials?.due_amount > 0 ? 'Payment Due' : 'Paid'}
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate(`/members/${id}/attendance`)}
            className="bg-primary-blue p-6 rounded-xl space-y-3 flex flex-col justify-between group cursor-pointer hover:-translate-y-1 transition-all shadow-lg"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary-blue flex items-center justify-center text-gold">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg font-headline text-white">Attendance</h3>
              <p className="text-secondary text-sm">Track & Manage</p>
            </div>
          </button>
        </div>

        {/* ===== BENTO GRID CONTENT ===== */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* LEFT COLUMN - Contact & Membership */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            
            {/* Profile Photo Card */}
            {profileImage && (
              <div className="bg-primary-blue p-8 rounded-xl shadow-lg">
                <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-6">Profile Photo</h2>
                <div className="relative group">
                  <img
                    src={profileImage}
                    alt={member.full_name}
                    className="w-full h-64 object-cover rounded-lg shadow-lg"
                  />
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg flex items-center justify-center transition-all duration-200"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-gold">zoom_in</span>
                      <span className="text-white font-semibold text-sm">View Full Photo</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
            
            {/* Contact Card */}
            <div className="bg-primary-blue p-8 rounded-xl shadow-lg">
              <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-6">Contact Information</h2>
              <ul className="space-y-6">
                <li className="flex flex-col">
                  <span className="text-xs text-secondary mb-1">Phone Number</span>
                  <span className="text-white font-semibold">{member?.phone || '—'}</span>
                </li>
                <li className="flex flex-col">
                  <span className="text-xs text-secondary mb-1">Email Address</span>
                  <span className="text-white font-semibold">{member?.email || '—'}</span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-secondary mb-1">Gender</span>
                    <span className="text-white font-semibold">{member?.gender || '—'}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-secondary mb-1">DOB</span>
                    <span className="text-white font-semibold">{formatDate(member?.dob)}</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Membership Details */}
            <div className="bg-primary-blue p-8 rounded-xl shadow-lg">
              <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-6">Membership Details</h2>
              <div className="space-y-4">
                <div className="flex justify-between py-2">
                  <span className="text-secondary text-sm">Batch</span>
                  <span className="font-semibold text-white">{formatBatch(member.batch, member.batch_start_time, member.batch_end_time)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-secondary text-sm">Joined Date</span>
                  <span className="font-semibold text-white">{formatDate(member.joining_date)}</span>
                </div>
                {memberPackage && (
                  <div className="mt-4 p-4 bg-secondary-blue border-l-4 border-gold rounded-lg">
                    <span className="block text-xs text-gold font-bold uppercase mb-1">Current Package</span>
                    <p className="text-white font-headline font-bold">{memberPackage.packageTitle} ({memberPackage.duration})</p>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency & Address */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-secondary-blue p-6 rounded-xl shadow-lg">
                <h3 className="text-xs font-bold uppercase text-secondary mb-4">Emergency Contact</h3>
                <div className="space-y-1">
                  <p className="font-bold text-white">{member?.emergency_contact || '—'}</p>
                  <p className="text-sm text-secondary">{member?.emergency_relation || '—'}</p>
                </div>
              </div>
              <div className="bg-secondary-blue p-6 rounded-xl shadow-lg">
                <h3 className="text-xs font-bold uppercase text-secondary mb-4">Primary Address</h3>
                <div className="space-y-1">
                  <p className="font-bold text-white">{member?.address || '—'}</p>
                  <p className="text-sm text-secondary">
                    {[member?.area, member?.district, member?.pin_code].filter(Boolean).join(", ") || '—'}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN - Metrics & Payment */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Payment History Table */}
            <div className="bg-primary-blue p-8 rounded-xl shadow-lg overflow-hidden">
              <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-6">Payment History</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-secondary-blue">
                    <tr>
                      <th className="pb-4 text-xs font-bold text-secondary uppercase tracking-wider">Bill Type</th>
                      <th className="pb-4 text-xs font-bold text-secondary uppercase tracking-wider">Date</th>
                      <th className="pb-4 text-xs font-bold text-secondary uppercase tracking-wider">Description</th>
                      <th className="pb-4 text-xs font-bold text-secondary uppercase tracking-wider text-right">Paid Amount</th>
                      <th className="pb-4 text-xs font-bold text-secondary uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-blue">
                    {displayBills.slice(0, 5).map((bill, idx) => {
                      const paidAmount = bill.isMerged
                        ? Number(bill.mergedPaid || 0)
                        : Number(bill.paid || 0);
                      const payableAmount = bill.isMerged
                        ? Number(bill.mergedPayable || 0)
                        : Number(bill.payable || 0);
                      const status = bill.status || (paidAmount >= payableAmount && payableAmount > 0
                        ? "paid"
                        : paidAmount > 0
                          ? "partial"
                          : "unpaid");

                      return (
                        <tr key={`${bill.id || "row"}-${idx}`}>
                          <td className="py-4 text-sm font-medium capitalize text-white">
                            {bill.isMerged ? "combined" : (bill.bill_type || "—")}
                          </td>
                          <td className="py-4 text-sm text-secondary">{formatDate(bill.billing_date || bill.due_date)}</td>
                          <td className="py-4 text-sm text-white">
                            {bill.mergedTitles || bill.packages?.[0]?.title || bill.packages?.title || bill.notes || "Payment"}
                          </td>
                          <td className="py-4 text-sm font-bold text-right text-white">
                            Rs.{paidAmount.toFixed(2)}
                          </td>
                          <td className="py-4 text-right">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              status === "paid"
                                ? "badge-success"
                                : status === "partial"
                                  ? "badge-warning"
                                  : "bg-slate-700 text-slate-200"
                            }`}>
                              {status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {displayBills.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-secondary">No payment history found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Health Metrics */}
            <div className="bg-primary-blue p-8 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-bold uppercase tracking-widest text-secondary">Health &amp; Fitness Metrics</h2>
                <span className="text-xs text-secondary italic">Last updated: 2 days ago</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="bg-secondary-blue p-5 rounded-lg">
                  <p className="text-xs text-secondary mb-1">Height</p>
                  <p className="text-2xl font-bold font-headline text-white">{member?.height_cm ? `${member.height_cm}` : '—'} <span className="text-sm font-normal text-secondary">cm</span></p>
                </div>
                <div className="bg-secondary-blue p-5 rounded-lg">
                  <p className="text-xs text-secondary mb-1">Weight</p>
                  <p className="text-2xl font-bold font-headline text-white">{member?.weight_kg ? `${member.weight_kg}` : '—'} <span className="text-sm font-normal text-secondary">kg</span></p>
                </div>
                <div className="bg-secondary-blue p-5 rounded-lg">
                  <p className="text-xs text-secondary mb-1">BMI</p>
                  <p className="text-2xl font-bold font-headline text-white">{member?.bmi ? `${member.bmi}` : '—'} <span className="bg-success bg-opacity-20 text-success text-[10px] px-2 py-0.5 rounded ml-2 align-middle">Healthy</span></p>
                </div>
                <div className="bg-secondary-blue p-5 rounded-lg">
                  <p className="text-xs text-secondary mb-1">Heart Rate</p>
                  <p className="text-2xl font-bold font-headline text-white">{member?.heart_rate ? `${member.heart_rate}` : '—'} <span className="text-sm font-normal text-secondary">bpm</span></p>
                </div>
                <div className="bg-secondary-blue p-5 rounded-lg">
                  <p className="text-xs text-secondary mb-1">Blood Pressure</p>
                  <p className="text-2xl font-bold font-headline text-white">{member?.blood_pressure || '—'}</p>
                </div>
                <div className="bg-secondary-blue p-5 rounded-lg">
                  <p className="text-xs text-secondary mb-1">Sugar Level</p>
                  <p className="text-2xl font-bold font-headline text-white">{member?.sugar_level ? `${member.sugar_level}` : '—'} <span className="text-sm font-normal text-secondary">mg/dL</span></p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {showAssignModal && (
          <AssignPackageAndAddOnsModal
            isOpen={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            memberId={id}
            onSuccess={loadMember}
          />
        )}
        
        {profileImage && (
          <ProfilePhotoModal
            isOpen={showPhotoModal}
            onClose={() => setShowPhotoModal(false)}
            photoUrl={profileImage}
            memberName={member.full_name}
          />
        )}
        </div>
        </>
      )}
    </main>
  );
}
