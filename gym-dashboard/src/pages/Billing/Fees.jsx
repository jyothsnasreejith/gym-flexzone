import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { generateInvoice } from "../../utils/generateInvoice";
import { isCountable } from "../../utils/paymentStatus";
import { openEmailClient, shareInvoice } from "../../utils/communicationHelpers";
import logger from "../../utils/logger";

const Stat = ({ label, value, highlight = false }) => (
  <div className="bg-slate-800/50 p-3 sm:p-4 rounded-lg">
    <div className="text-xs sm:text-sm text-secondary">{label}</div>
    <div
      className={`text-lg sm:text-2xl font-bold ${highlight ? "text-red-600" : "text-white"
        }`}
    >
      {value}
    </div>
  </div>
);

export default function Fees() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedMemberId =
    location.state?.memberId || null;
  const detailsRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feeSchedule, setFeeSchedule] = useState([]);
  const [memberAddOnNames, setMemberAddOnNames] = useState([]);
  const [memberPackage, setMemberPackage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sendingInvoiceBillId, setSendingInvoiceBillId] = useState(null);

  // Record Payment modal state
  const [paymentModal, setPaymentModal] = useState(null); // { bill } | null
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [savingPayment, setSavingPayment] = useState(false);

  // Edit Fee modal state
  const [editModal, setEditModal] = useState(null); // { bill } | null
  const [editData, setEditData] = useState({
    base_amount: "",
    discount_amount: "",
    billing_date: "",
    amount_paid: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // History modal state
  const [historyModal, setHistoryModal] = useState(null); // { bill, logs } | null
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isMobile = () =>
    typeof window !== "undefined" &&
    window.innerWidth < 768;

  const filteredMembers = members.filter((m) =>
    m.full_name
      ?.toLowerCase()
      .includes(memberQuery.trim().toLowerCase())
  );

  const currentBills = feeSchedule.filter(b => b.is_current !== false);
  const historyBills = feeSchedule.filter(b => b.is_current === false);

  const getPaidAmount = (bill) =>
    (bill.payments || [])
      .filter((p) => isCountable(p.status))
      .reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);

  // Helper: Detect balance payment bills
  // Format: "Balance Payment for ${packageName}. Original Bill Total: ?${base} (Discount: ?${discount})"
  const isBalancePaymentBill = (bill) =>
    !!(bill.notes && bill.notes.startsWith('Balance Payment for'));

  // Alias used throughout table/display code
  const isInstallmentBill = isBalancePaymentBill;

  // Helper: Get total paid on a single bill (used for table row display)
  const getTotalPaidWithInstallments = (bill, _allBills) => getPaidAmount(bill);

  // Helper: Returns the bill's own base amount for table display
  const getOriginalBaseAmount = (bill, _allBills) => Number(bill.base_amount || 0);

  const getBillDateValue = (bill) => {
    const raw = bill.billing_date || bill.due_date || bill.created_at || 0;
    const value = new Date(raw).getTime();
    return Number.isNaN(value) ? 0 : value;
  };

  const getBillDateKey = (bill) => {
    const raw = bill.billing_date || bill.due_date || bill.created_at || null;
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const getBillKey = (bill) => {
    // Add-on bills: each is unique (never collapse)
    if (bill.bill_type === "add_on") return `add_on:${bill.id}`;
    // Balance payment bills: each is a separate payment record (never collapse)
    if (bill.notes && String(bill.notes).startsWith('Balance Payment for')) return `balance:${bill.id}`;
    // Package bills: dedup by variant so only the most recent/paid version is kept
    return `${bill.bill_type || "package"}:${bill.package_variant_id || bill.package_id || "none"}`;
  };

  const dedupeBillsByKey = (bills) => {
    const map = new Map();
    const duplicates = [];

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

      let keep = existing;
      let discard = bill;

      const existingPaid = getPaidAmount(existing);
      const billPaid = getPaidAmount(bill);

      if (billPaid > existingPaid) {
        keep = bill;
        discard = existing;
      } else if (billPaid < existingPaid) {
        keep = existing;
        discard = bill;
      } else if (billDate > existingDate) {
        keep = bill;
        discard = existing;
      }

      if (keep !== existing) {
        map.set(key, keep);
      }
      duplicates.push(discard);
    });

    return { deduped: Array.from(map.values()), duplicates };
  };

  const { deduped: statsBills } = dedupeBillsByKey(currentBills);

  const activeBillsForStats = statsBills;

  const formatInr = (
    amount,
    {
      minimumFractionDigits = 0,
      maximumFractionDigits = 0,
    } = {}
  ) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(Number(amount || 0));

  const getBillPayable = (bill) => {
    if (bill.payable_amount !== undefined && bill.payable_amount !== null) {
      return Number(bill.payable_amount);
    }
    const base = Number(bill.base_amount ?? 0);
    const discount = Number(bill.discount_amount ?? 0);
    return Math.max(base - discount, 0);
  };

  const getDerivedStatus = (paidAmount, payableAmount) => {
    if (paidAmount <= 0) return "unpaid";
    if (paidAmount < payableAmount) return "partial";
    return "paid";
  };

  const getBillGross = (bill) => {
    return Number(bill.base_amount ?? 0);
  };

  const getBillDiscountForStats = (bill) => {
    return Number(bill.discount_amount ?? 0);
  };

  // Helper: Calculate correct expiry date based on package/add-on duration
  const calculateExpiryDate = (bill, baseDate = new Date()) => {
    const today = baseDate.toISOString().slice(0, 10);
    
    // If it's an add-on only bill, use add-on duration
    if (bill.bill_type === "add_on" && memberPackage?.addOnDuration) {
      const [durValue, durUnit] = memberPackage.addOnDuration.split(" ");
      const val = Number(durValue || 0);
      const unit = (durUnit || "").toLowerCase();
      if (val > 0 && unit) {
        const exp = new Date(baseDate);
        if (unit === "month" || unit === "months") exp.setMonth(exp.getMonth() + val);
        else if (unit === "year" || unit === "years") exp.setFullYear(exp.getFullYear() + val);
        else if (unit.includes("day")) exp.setDate(exp.getDate() + val);
        return exp.toISOString().slice(0, 10);
      }
    }
    
    // For package bills, use package duration
    if (memberPackage?.duration && !memberPackage?.duration.includes("Session")) {
      const [durValue, durUnit] = memberPackage.duration.split(" ");
      const val = Number(durValue || 0);
      const unit = (durUnit || "").toLowerCase();
      if (val > 0 && unit) {
        const exp = new Date(baseDate);
        if (unit === "month" || unit === "months") exp.setMonth(exp.getMonth() + val);
        else if (unit === "year" || unit === "years") exp.setFullYear(exp.getFullYear() + val);
        else if (unit.includes("day")) exp.setDate(exp.getDate() + val);
        return exp.toISOString().slice(0, 10);
      }
    }
    
    return today;
  };

  // ========== STATS: Use root bills (all non-balance-payment bills) for payable/discount/gross ==========
  // Root bills include archived originals (is_current: false) AND active first-time bills
  // This correctly preserves the original after-discount payable amount even after archiving
  const rootBills = feeSchedule.filter(b => !isBalancePaymentBill(b));

  // Config prices from member's current package/add-on assignment
  const pkgPrice = memberPackage?.kind === 'add_on'
    ? 0
    : Number(memberPackage?.price || 0);
  const aoTotal = Number(memberPackage?.addOnTotal || 0);
  const totalConfigPrice = pkgPrice + aoTotal;

  // Billed base from ALL root bills (including archived) � combined total, not split by type
  // This correctly handles combined bills where package+add-ons share one bill_type='package' bill
  const billedBase = rootBills.reduce((s, b) => s + Number(b.base_amount || 0), 0);

  // Unbilled = config items not yet covered by any root bill (always calculate)
  const totalUnbilled = Math.max(0, totalConfigPrice - billedBase);

  // Total Gross = billed base + anything still unbilled
  const totalGross = billedBase + totalUnbilled;

  // Total Discount = from ALL bills (discount can be on original OR on a balance payment bill)
  const totalDiscount = feeSchedule.reduce((sum, b) => sum + getBillDiscountForStats(b), 0);

  // Total Payable Net = gross minus ALL discounts across all bills
  const totalPayableNet = Math.max(0, totalGross - totalDiscount);

  // Total Paid = ALL payments across ALL bills
  const totalPaid = feeSchedule.reduce(
    (sum, f) => sum + (f.isMerged ? (f.mergedPaid || 0) : getPaidAmount(f)),
    0
  );

  const outstandingFromExistingBills = Math.max(0, totalPayableNet - totalPaid);
  const outstandingTotal = outstandingFromExistingBills;

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, phone, email, joining_date")
        .eq("is_deleted", false)
        .order("joining_date", { ascending: false });

      if (!error) {
        setMembers(data || []);
      }

      setLoading(false);
    };

    loadMembers();
  }, []);

  useEffect(() => {
    const fetchEmailTemplates = async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .eq("mode", "email")
        .order("title");

      if (error) {
        console.error("Error fetching email templates:", error);
      } else {
        setEmailTemplates(data || []);
      }
    };

    fetchEmailTemplates();
  }, []);

  useEffect(() => {
    if (!preselectedMemberId || members.length === 0) return;

    const member = members.find(
      (m) => m.id === preselectedMemberId
    );

    if (member) {
      handleMemberSelect(member);
    }
  }, [members, preselectedMemberId]);

  useEffect(() => {
    if (!selectedMember || !isMobile()) return;
    detailsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedMember]);

  const loadMemberPackage = async (memberId) => {
    const { data, error } = await supabase
      .from("members")
      .select(`
        id,
        created_at,
        joining_date,
        discount_amount,
        final_amount,
        package_variant_id,
        package_variants (
          id,
          package_id,
          pricing_type,
          duration_value,
          duration_unit,
          price,
          packages (
            title
          )
        )
      `)
      .eq("id", memberId)
      .single();

    if (error) {
      console.error("Failed to load member package:", error);
      return null;
    }

    let addOnNames = [];
    let addOnTotal = 0;
    let addOnDuration = "";
    let addOnItems = [];
    
    // Fetch bills to extract addon information
    const { data: memberBills, error: billsError } = await supabase
      .from("bills")
      .select("*")
      .eq("member_id", memberId);

    if (!billsError && Array.isArray(memberBills) && memberBills.length > 0) {
      // Find addon bills, excluding "Admin Added" entries
      const addonBills = memberBills.filter(bill => 
        (bill.bill_type === "add_on" || (bill.notes && bill.notes.includes("Days"))) &&
        (!bill.notes || !bill.notes.includes("Admin Added"))
      );

      if (addonBills.length > 0) {
        // Extract addon names from notes
        const notesSet = new Set();

        addonBills.forEach(bill => {
          if (bill.notes) {
            // notes typically contain addon name like "6 Days P T 24 CLASS"
            notesSet.add(bill.notes);
          }
        });

        addOnNames = Array.from(notesSet);

        // Create addon items from bills
        addOnItems = addonBills.map((bill, idx) => ({
          name: bill.notes || `Add-on ${idx + 1}`,
          amount: bill.base_amount,
          duration_value: null,
          duration_unit: null,
        }));

        addOnTotal = addOnItems.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );
        
        addOnDuration = "Custom"; // Since we're getting from bills, use generic duration
      }
    }

    if (data?.package_variants) {
      return {
        kind: "package",
        packageTitle: data.package_variants.packages.title,
        price: Number(data.package_variants.price || 0), // Add-ons are billed separately via their own bills
        packageVariantId: data.package_variant_id,
        packageId: data.package_variants.package_id,
        discountAmount: Number(data.discount_amount || 0),
        finalAmount:
          data.final_amount !== null && data.final_amount !== undefined
            ? Number(data.final_amount || 0)
            : null,
        duration:
          data.package_variants.pricing_type === "duration"
            ? `${data.package_variants.duration_value} ${data.package_variants.duration_unit}`
            : "Session based",
        joiningDate: data.joining_date || data.created_at,
        addOnNames,
        addOnTotal,
        addOnDuration,
        addOnItems,
      };
    }

    if (addOnNames.length > 0) {
      return {
        kind: "add_on",
        packageTitle: "Add-ons",
        price: addOnTotal,
        packageVariantId: data.package_variant_id,
        packageId: data.package_variants?.package_id,
        discountAmount: Number(data.discount_amount || 0),
        finalAmount:
          data.final_amount !== null && data.final_amount !== undefined
            ? Number(data.final_amount || 0)
            : null,
        duration: addOnDuration || "Custom",
        joiningDate: data.joining_date || data.created_at,
        addOnNames,
        addOnTotal,
        addOnDuration,
        addOnItems,
      };
    }

    return null;
  };

  const loadFeeSchedule = async (memberId) => {
    // Fetch bills using wildcard to avoid 400 errors from missing/unrecognised columns
    const { data: billsData, error: billsError } = await supabase
      .from("bills")
      .select("*, packages:packages!bills_package_id_fkey(title)")
      .eq("member_id", memberId)
      .order("due_date", { ascending: false });

    if (billsError) {
      console.error("Failed to load fee history FULL:", {
        message: billsError.message,
        details: billsError.details,
        hint: billsError.hint,
        code: billsError.code,
      });
      return [];
    }

    const billIds = (billsData || []).map((b) => b.id).filter(Boolean);
    let paymentsMap = {};

    if (billIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .in("bill_id", billIds);

      if (paymentsError) {
        console.warn("Failed to load payments:", paymentsError.message);
      } else {
        (paymentsData || []).forEach((p) => {
          if (!paymentsMap[p.bill_id]) paymentsMap[p.bill_id] = [];
          paymentsMap[p.bill_id].push(p);
        });
      }
    }

    const rows = (billsData || []).map((bill) => ({
      ...bill,
      payments: paymentsMap[bill.id] || paymentsMap[String(bill.id)] || [],
    }));

    const updates = rows
      .map((bill) => {
        // Never recalculate status for archived bills � their status was intentionally
        // set when archived (e.g. 'paid') and must not be overwritten by raw payment math
        if (bill.is_current === false) return null;

        const paidAmount =
          bill.payments
            ?.filter((p) => isCountable(p.status))
            .reduce(
              (sum, p) => sum + Number(p.amount_paid || 0),
              0
            ) || 0;

        const amount = getBillPayable(bill);
        const derivedStatus = getDerivedStatus(
          paidAmount,
          amount
        );

        if (derivedStatus === bill.payment_status) return null;

        return supabase
          .from("bills")
          .update({ payment_status: derivedStatus })
          .eq("id", bill.id);
      })
      .filter(Boolean);

    if (updates.length > 0) {
      await Promise.all(updates);
      // Re-fetch to get the updated records with their joined payments
      return loadFeeSchedule(memberId);
    }

    const currentRows = rows.filter((b) => b.is_current !== false);
    const { deduped, duplicates } = dedupeBillsByKey(currentRows);

    if (duplicates.length > 0) {
      const keepMap = new Map(deduped.map((b) => [getBillKey(b), b]));
      const safeToArchive = duplicates.filter((b) => {
        const keep = keepMap.get(getBillKey(b));
        if (!keep) return false;
        // Archive the older bill � keep the newer one regardless of payment status
        const keepDate = getBillDateValue(keep);
        const discardDate = getBillDateValue(b);
        return keepDate > discardDate;
      });

      if (safeToArchive.length > 0) {
        await supabase
          .from("bills")
          .update({ is_current: false })
          .in("id", safeToArchive.map((b) => b.id));

        return loadFeeSchedule(memberId);
      }
    }

    return rows;
  };

  const handleMemberSelect = async (member) => {
    if (selectedMember?.id === member.id) return;

    setSelectedMember(member);
    setLoadingDetails(true);
    setShowHistory(false); // Reset history view on member change

    const [schedule, pkg] = await Promise.all([
      loadFeeSchedule(member.id),
      loadMemberPackage(member.id),
    ]);

    // Fetch add-on names for this member
    const { data: aoRows } = await supabase
      .from("member_add_ons")
      .select("add_ons ( name )")
      .eq("member_id", member.id);
    const aoNames = (aoRows || []).map(r => r.add_ons?.name).filter(Boolean);
    setMemberAddOnNames(aoNames);

    setFeeSchedule(schedule);
    setMemberPackage(pkg);
    setLoadingDetails(false);
  };

  // Find subset of add-ons whose amounts sum to a target (for invoice item matching)
  const findMatchingAddOns = (addOnItems, targetAmount) => {
    const n = addOnItems.length;
    if (n === 0 || n > 15) return null;
    for (let mask = 1; mask < (1 << n); mask++) {
      let sum = 0;
      const subset = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          sum += Number(addOnItems[i].amount || 0);
          subset.push(addOnItems[i]);
        }
      }
      if (Math.abs(sum - targetAmount) < 0.01) return subset;
    }
    return null;
  };

  const handleShareInvoice = async (bill) => {
    if (!selectedMember || !memberPackage || !bill) {
      alert("Unable to share invoice. Missing information.");
      return;
    }

    // Determine bill category by bill_type (primary) � notes prefix is unreliable
    const isAddOnBill = bill.bill_type === "add_on";
    const isPackageBill = !isAddOnBill; // bill_type is "package" or unset

    // Build a bill-specific packageInfo so the invoice shows the right items
    let billPackageInfo;
    const allAddOns = memberPackage.addOnItems || [];

    if (isAddOnBill) {
      // Add-on bill: find which specific add-ons this bill covers
      const billBase = Number(bill.base_amount || bill.amount || 0);
      const matchingAddOns = findMatchingAddOns(allAddOns, billBase);
      const billAddOns = matchingAddOns || allAddOns;

      billPackageInfo = {
        ...memberPackage,
        addOnItems: billAddOns,
        addOnNames: billAddOns.map(ao => ao.name),
        packageTitle: billAddOns.map(ao => ao.name).join(", ") || "Add-ons",
        duration: memberPackage.addOnDuration || "Custom",
      };
    } else {
      // Package bill (including balance payment for package): show package + all add-ons
      billPackageInfo = {
        ...memberPackage,
        packageTitle: bill.packages?.title || memberPackage.packageTitle
      };
    }

    setSendingInvoiceBillId(bill.id);
    try {
      const siblingBills = bill.mergedBills ? bill.mergedBills.filter(b => b.id !== bill.id) : [];
      await shareInvoice({
        member: selectedMember,
        packageInfo: billPackageInfo,
        bill,
        isAddOnBill,
        siblingBills,
      });
    } catch (error) {
      console.error("Critical Error during handleShareInvoice:", {
        billId: bill.id,
        error: error,
        message: error.message
      });
      alert(error.message || "Failed to share invoice.");
    } finally {
      setSendingInvoiceBillId(null);
    }
  };


  /* ====== RECORD ADDITIONAL PAYMENT ====== */
  const openPaymentModal = (bill) => {
    const paidAmount =
      bill.payments
        ?.filter((p) => isCountable(p.status))
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
    const remaining = Math.max(getBillPayable(bill) - paidAmount, 0);
    setPayAmount(remaining > 0 ? remaining : "");
    setPayMode("cash");
    setPaymentModal(bill);
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    setPayAmount("");
    setPayMode("cash");
  };

  const savePayment = async () => {
    if (!paymentModal || savingPayment) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;

    setSavingPayment(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const paidSoFar =
        paymentModal.payments
          ?.filter((p) => isCountable(p.status))
          .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;
      const totalPayable = getBillPayable(paymentModal);
      const newTotal = paidSoFar + amount;
      const newStatus = newTotal >= totalPayable ? "paid" : "partial";

      if (newStatus === "paid") {
        // FULLY PAID: archive the original bill, then create a new balance payment bill as a receipt

        // 1. Archive original bill
        const { error: archiveErr } = await supabase
          .from("bills")
          .update({ payment_status: "paid", is_current: false })
          .eq("id", paymentModal.id);
        if (archiveErr) throw archiveErr;

        // 2. Create balance payment bill
        const packageName = memberPackage?.packageTitle || "Package";
        const originalBase = Number(paymentModal.base_amount || 0);
        const originalDiscount = Number(paymentModal.discount_amount || 0);
        const balanceNotes = `Balance Payment for ${packageName}. Original Bill Total: ?${originalBase} (Discount: ?${originalDiscount})`;

        const { data: balanceBill, error: billErr } = await supabase
          .from("bills")
          .insert({
            member_id: paymentModal.member_id,
            package_id: paymentModal.package_id || null,
            package_variant_id: paymentModal.package_variant_id || null,
            bill_type: paymentModal.bill_type || "package",
            base_amount: amount,
            payable_amount: amount,
            discount_amount: 0,
            amount: amount,
            payment_status: "paid",
            payment_mode: payMode,
            billing_date: today,
            due_date: today,
            is_current: true,
            notes: balanceNotes,
          })
          .select()
          .single();
        if (billErr) throw billErr;

        // 3. Record payment against the new balance bill
        const { error: payError } = await supabase
          .from("payments")
          .insert({
            bill_id: balanceBill.id,
            amount_paid: amount,
            payment_date: today,
            method: payMode,
            status: "paid",
          });
        if (payError) throw payError;

      } else {
        // PARTIAL: record payment against the existing bill and update its status
        const { error: payError } = await supabase
          .from("payments")
          .insert({
            bill_id: paymentModal.id,
            amount_paid: amount,
            payment_date: today,
            method: payMode,
            status: newStatus,
          });
        if (payError) throw payError;

        await supabase
          .from("bills")
          .update({ payment_status: newStatus })
          .eq("id", paymentModal.id);
      }

      // Refresh fee schedule
      const updated = await loadFeeSchedule(selectedMember.id);
      setFeeSchedule(updated);
      closePaymentModal();
    } catch (err) {
      console.error("Failed to record payment:", err);
      alert("Failed to record payment. Please try again.");
    } finally {
      setSavingPayment(false);
    }
  };

  /* ====== EDIT FEE ====== */
  const openEditModal = (bill) => {
    const paidAmount =
      bill.payments
        ?.filter((p) => isCountable(p.status))
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0;

    setEditData({
      base_amount: bill.base_amount || 0,
      discount_amount: bill.discount_amount || 0,
      billing_date: bill.billing_date || new Date().toISOString().slice(0, 10),
      amount_paid: paidAmount,
    });
    setEditModal(bill);
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditData({ base_amount: "", discount_amount: "", billing_date: "" });
  };

  const saveEdit = async () => {
    if (!editModal || savingEdit) return;
    setSavingEdit(true);

    try {
      const oldBill = { ...editModal };
      const newBase = Number(editData.base_amount);
      const newDiscount = Number(editData.discount_amount);
      const newPayable = Math.max(newBase - newDiscount, 0);
      const newPaid = Number(editData.amount_paid);

      // 1. Update Bill
      const statusFromPaid =
        newPaid <= 0 ? "unpaid" : newPaid < newPayable ? "partial" : "paid";

      const { error: billError } = await supabase
        .from("bills")
        .update({
          base_amount: newBase,
          discount_amount: newDiscount,
          payable_amount: newPayable,
          amount: newPayable,
          billing_date: editData.billing_date,
          payment_status: statusFromPaid,
        })
        .eq("id", editModal.id);

      if (billError) throw new Error("Bill update failed: " + billError.message);

      // 2. Sync Payments (Clean Slate)
      const { error: delError } = await supabase
        .from("payments")
        .delete()
        .eq("bill_id", editModal.id);

      if (delError) throw new Error("Could not clear old payments: " + delError.message);

      if (newPaid > 0) {
        const { error: insError } = await supabase.from("payments").insert({
          bill_id: editModal.id,
          amount_paid: newPaid,
          status: statusFromPaid,
          payment_date: new Date().toISOString().slice(0, 10),
          method: "cash",
        });
        if (insError) throw new Error("Could not save new payment: " + insError.message);
      }

      // 3. Log the change
      await logger.info(`Edited fee for ${selectedMember.full_name}`, {
        bill_id: editModal.id,
        member_id: selectedMember.id,
        action: "edit_fee",
        old_values: {
          base_amount: oldBill.base_amount,
          discount_amount: oldBill.discount_amount,
          billing_date: oldBill.billing_date,
          paid_amount: oldBill.payments?.reduce((s, p) => s + Number(p.amount_paid), 0) || 0,
        },
        new_values: {
          base_amount: newBase,
          discount_amount: newDiscount,
          billing_date: editData.billing_date,
          paid_amount: newPaid,
        },
      });

      // 3. Refresh
      const updated = await loadFeeSchedule(selectedMember.id);
      setFeeSchedule(updated);
      closeEditModal();
      alert("Changes saved successfully!");
    } catch (err) {
      console.error("Failed to edit fee:", err);
      alert("Failed to update fee details.");
    } finally {
      setSavingEdit(false);
    }
  };

  /* ====== VIEW HISTORY ====== */
  const openHistoryModal = async (bill) => {
    setLoadingHistory(true);
    setHistoryModal({ bill, logs: [] });

    try {
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .eq("level", "info")
        .contains("details", { bill_id: bill.id })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistoryModal({ bill, logs: data || [] });
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => setHistoryModal(null);

  const groupBillsByDate = (billsList) => {
    const groups = new Map();
    billsList.forEach((b) => {
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

    return Array.from(groups.values()).map((group) => {
      if (group.length === 1) return group[0];
      const main = group.find((b) => b.bill_type !== "add_on") || group[0];
      const totalPaid = group.reduce((s, b) => s + getPaidAmount(b), 0);
      const totalNet = group.reduce((s, b) => s + getBillPayable(b), 0);
      const totalGross = group.reduce((s, b) => s + getBillGross(b), 0);
      const titles = group
        .map((b) => {
          if (b.bill_type === "add_on") {
             // Handle both old and new note formats
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
        mergedPaid: totalPaid,
        mergedNet: totalNet,
        mergedGross: totalGross,
        mergedTitles: titles,
        mergedBills: group,
      };
    });
  };

  const { deduped: dedupedCurrentBills } = dedupeBillsByKey(currentBills);
  const allRawBills = [...dedupedCurrentBills, ...historyBills];
  const groupedBills = groupBillsByDate(allRawBills);

  const billsToDisplay = groupedBills
    .filter((bill) => {
      // Show if not totally unpaid, OR if it's a current bill
      // Balance payment bills (is_current: true) are shown as the active current bill
      // Archived root bills (is_current: false, paid) are shown as billing history
      const paidAmount = bill.isMerged ? bill.mergedPaid : getTotalPaidWithInstallments(bill, feeSchedule);
      const payableAmount = bill.isMerged ? bill.mergedNet : getBillPayable(bill);
      const status = getDerivedStatus(paidAmount, payableAmount);
      return status !== "unpaid" || bill.is_current !== false;
    })
    .sort((a, b) => getBillDateValue(b) - getBillDateValue(a));

  return (
    <main className="mx-auto w-full p-6 min-h-[calc(100vh-96px)] overflow-auto bg-navy">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Fees</h1>
          <p className="text-secondary">
            Manage member fees and payments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT: MEMBER LIST */}
        <div className="bg-primary-blue border border-slate-700/20 rounded-xl overflow-hidden md:h-[calc(100vh-160px)] flex flex-col">
          <div className="p-4 border-b">
            <div className="font-semibold">Members</div>
            <input
              type="text"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search by name"
              className="mt-3 w-full rounded-md border px-3 py-2 text-sm text-white bg-card"
            />
          </div>

          {loading && (
            <div className="p-4 text-secondary">
              Loading members�
            </div>
          )}

          {!loading && filteredMembers.length === 0 && (
            <div className="p-4 text-secondary">
              No members found.
            </div>
          )}

          <ul className="divide-y overflow-y-auto">
            {filteredMembers.map((m) => (
              <li
                key={m.id}
                onClick={() => handleMemberSelect(m)}
                className={`p-4 cursor-pointer hover:bg-slate-800/20 ${selectedMember?.id === m.id
                  ? "bg-primary/5"
                  : ""
                  }`}
              >
                <div className="font-semibold">
                  {m.full_name}
                </div>
                <div className="text-sm text-secondary">
                  {m.phone}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: DETAILS */}
        <div
          ref={detailsRef}
          className="md:col-span-2 bg-primary-blue border border-slate-700/20 rounded-xl p-6 md:h-[calc(100vh-160px)] flex flex-col md:overflow-hidden scroll-mt-20"
        >
          {!selectedMember ? (
            <div className="text-secondary text-center m-auto">
              Select a member to view fee details
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1">
              <h2 className="text-xl font-bold text-white mb-4">
                {selectedMember.full_name}
              </h2>

              {memberPackage && (
                <div className="mb-6 bg-slate-800/50 border border-slate-700/20 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                      {memberPackage.kind === "add_on" ? (
                        <>
                          <div className="font-bold text-lg mb-1">Add-ons</div>
                          <div className="space-y-1">
                            {memberPackage.addOnItems?.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-secondary">
                                <span className="font-semibold text-white">{item.name}</span>
                                <span>({item.duration_value} {item.duration_unit})</span>
                                <span className="text-primary font-bold">?{item.amount}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col gap-1">
                            <div className="text-lg font-bold text-white">
                              Package: {memberPackage.packageTitle} ({memberPackage.duration})
                              <span className="ml-2 text-primary">?{memberPackage.price}</span>
                            </div>
                            
                            {memberPackage.addOnItems?.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-700/30">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Add-ons</div>
                                <div className="space-y-1.5">
                                  {memberPackage.addOnItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-secondary">
                                      <span className="font-semibold text-white">{item.name}</span>
                                      <span>({item.duration_value || item.duration_unit ? `${item.duration_value} ${item.duration_unit}` : 'Custom'})</span>
                                      <span className="text-primary font-bold">?{item.amount}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    <div className="text-sm text-secondary whitespace-nowrap">
                      Joined on: {new Date(memberPackage.joiningDate).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() =>
                        navigate("/billing/add", {
                          state: {
                            memberId: selectedMember.id,
                          },
                        })
                      }
                      className="px-4 py-2 bg-primary text-white rounded-lg font-semibold"
                    >
                      + Fee
                    </button>
                  </div>
                </div>
              )}

              {loadingDetails ? (
                <div className="mt-6 text-secondary">Loading fee details�</div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-800/50 p-3 sm:p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-sm text-secondary">Total Payable</div>
                      </div>

                      <div className="text-lg sm:text-2xl font-bold text-white">
                        {formatInr(totalGross)}
                      </div>
                    </div>
                    <Stat label="Paid" value={formatInr(totalPaid)} />
                    <Stat label="Discount" value={totalDiscount > 0 ? `-${formatInr(totalDiscount)}` : "�"} />
                    <Stat
                      label="Outstanding"
                      value={formatInr(outstandingTotal)}
                      highlight={outstandingTotal > 0.5}
                    />
                  </div>

                  {/* ========== PHASE 4: Outstanding breakdown info ========== */}
                  {outstandingTotal > 0 && (
                    <div className="mb-6 bg-blue-50 border border-secondary-blue rounded-lg p-4 text-sm">
                      <div className="font-semibold text-blue-900 mb-2">Outstanding Breakdown:</div>
                      <div className="space-y-1 text-blue-800">
                        {outstandingFromExistingBills > 0 && (
                          <div>� Unpaid on existing bills: {formatInr(outstandingFromExistingBills)}</div>
                        )}
                        {totalUnbilled > 0 && (
                          <div>� Unbilled items: {formatInr(totalUnbilled)}</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[600px] border rounded-lg overflow-hidden">
                      <thead className="bg-slate-800/50 text-secondary text-xs uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-right">Base</th>
                          <th className="px-4 py-2 text-right">Discount</th>
                          <th className="px-4 py-2 text-right">Payable</th>
                          <th className="px-4 py-2 text-right">Paid</th>
                          <th className="px-4 py-2 text-right">Outstanding</th>
                          <th className="px-4 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billsToDisplay.length === 0 && (
                          <tr>
                            <td colSpan="7" className="px-4 py-6 text-center text-secondary">
                              No fee records found
                            </td>
                          </tr>
                        )}

                        {billsToDisplay.map(bill => {
                          // For parent bills, sum payments from parent + all children
                          const paidAmount = bill.isMerged 
                            ? bill.mergedPaid 
                            : getTotalPaidWithInstallments(bill, feeSchedule);
                          const finalAmount = bill.isMerged ? bill.mergedNet : getBillPayable(bill);
                          // Display the ORIGINAL base amount, not the installment amount
                          const grossAmount = bill.isMerged ? bill.mergedGross : getOriginalBaseAmount(bill, feeSchedule);
                          const discountAmount = bill.isMerged ? (grossAmount - finalAmount) : getBillDiscountForStats(bill);
                          const status = getDerivedStatus(
                            paidAmount,
                            finalAmount
                          );
                          const isAddOnBill = bill.bill_type === "add_on";
                          const durationText = isAddOnBill
                            ? (memberPackage?.addOnDuration || "Custom")
                            : (memberPackage?.duration || "Session based");
                          const paidDisplay =
                            paidAmount > 0 ? formatInr(paidAmount) : "�";

                          return (
                            <tr key={bill.id} className={`border-t ${bill.is_current === false ? 'opacity-70' : ''}`}>
                              <td className="px-4 py-2 text-xs">
                                {new Date(bill.billing_date || bill.due_date).toLocaleDateString("en-GB")}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-xs">
                                {formatInr(grossAmount)}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-xs text-orange-600">
                                {discountAmount > 0 ? `-${formatInr(discountAmount)}` : "�"}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-xs text-blue-600">
                                {formatInr(finalAmount)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-xs text-green-700">
                                {paidDisplay}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-xs text-red-600">
                                {bill.is_current === false ? "�" : formatInr(Math.max(finalAmount - paidAmount, 0))}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleShareInvoice(bill)}
                                    disabled={sendingInvoiceBillId === bill.id}
                                    title="Send Invoice"
                                    className="p-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                                  >
                                    <span className="material-icons-round text-sm">share</span>
                                  </button>
                                  <button
                                    onClick={() => openEditModal(bill)}
                                    title="Edit Fee"
                                    className="p-1 text-white hover:bg-blue-50 rounded transition-colors"
                                  >
                                    <span className="material-icons-round text-sm">edit</span>
                                  </button>
                                  <button
                                    onClick={() => openHistoryModal(bill)}
                                    title="View Edit History"
                                    className="p-1 text-white hover:bg-slate-800/30 rounded transition-colors"
                                  >
                                    <span className="material-icons-round text-sm">history</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {billsToDisplay.length === 0 && (
                      <div className="px-4 py-6 text-center text-secondary">
                        No fee records found
                      </div>
                    )}
                    {billsToDisplay.map(bill => {
                      // For parent bills, sum payments from parent + all children
                      const paidAmount = getTotalPaidWithInstallments(bill, feeSchedule);
                      const finalAmount = getBillPayable(bill);
                      const status = getDerivedStatus(
                        paidAmount,
                        finalAmount
                      );
                      const isAddOnBill = bill.bill_type === "add_on";
                      const isBalance = isBalancePaymentBill(bill);
                      const billNotes = bill.notes || "";

                      let packageLabel;
                      if (isBalance) {
                        const afterPrefix = billNotes.replace(/^Balance Payment for\s*/i, "");
                        const addOnSplit = afterPrefix.match(/^(.+?)\s*\+\s*Add-ons?:/i);
                        packageLabel = addOnSplit
                          ? addOnSplit[1].split('. Original')[0].trim()
                          : afterPrefix.split('. Original')[0].trim() || bill.packages?.title || memberPackage?.packageTitle || "Package";
                      } else if (isAddOnBill) {
                        // Show only add-on names, not package title
                        const addOnNoteMatch = billNotes.match(/\+\s*Add-ons?:\s*(.+)/i) || billNotes.match(/Add-ons?:\s*(.+)/i);
                        packageLabel = addOnNoteMatch ? addOnNoteMatch[1].trim() : (billNotes || "Add-On");
                      } else {
                        packageLabel = bill.packages?.title || memberPackage?.packageTitle || "Package";
                      }
                      const durationText = isAddOnBill
                        ? (memberPackage?.addOnDuration || "Custom")
                        : (memberPackage?.duration || "Session based");
                      const paidDisplay =
                        paidAmount > 0 ? formatInr(paidAmount) : "�";

                      return (
                        <div key={bill.id} className="border rounded-lg p-4 bg-card">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold">{new Date(bill.billing_date || bill.due_date).toLocaleDateString("en-GB")}</div>
                              <div className="text-sm text-secondary">Due Date</div>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status === "paid"
                                ? "bg-green-100 text-green-700"
                                : status === "partial"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                                }`}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-600 uppercase tracking-widest">
                              {packageLabel}
                            </span>
                          </div>
                          {(() => {
                            const notes = bill.notes || "";
                            let addOnLabel = "";

                            if (isBalance) {
                              const afterPrefix = notes.replace(/^Balance Payment for\s*/i, "");
                              const addOnSplit = afterPrefix.match(/\+\s*Add-ons?:\s*(.+)/i);
                              addOnLabel = addOnSplit ? addOnSplit[1].split('. Original')[0].trim() : "";
                            } else if (isAddOnBill) {
                              // Add-on bill: add-on names are already in packageLabel, no extra label needed
                              addOnLabel = "";
                            } else {
                              const addOnNoteMatch = notes.match(/\+\s*Add-ons?:\s*(.+)/i) || notes.match(/Add-ons?:\s*(.+)/i);
                              addOnLabel = addOnNoteMatch ? addOnNoteMatch[1].trim() : "";
                            }

                            return (
                              <>
                                <div className="text-xs font-semibold text-white">
                                  {packageLabel}
                                </div>
                                {addOnLabel && (
                                  <div className="text-[10px] text-primary font-medium mt-0.5">
                                    + {addOnLabel}
                                  </div>
                                )}
                                <div className="text-[10px] text-secondary font-medium">
                                  {durationText}
                                </div>
                                {(() => {
                                  const joiningDate = memberPackage?.joiningDate || new Date();
                                  const expiryDate = calculateExpiryDate(bill, new Date(joiningDate));
                                  return (
                                    <div className="text-[10px] text-gray-400 font-medium">
                                      Expires: {new Date(expiryDate).toLocaleDateString("en-GB")}
                                    </div>
                                  );
                                })()}
                              </>
                            );
                          })()}
                          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
                            <div>
                              <div className="text-sm text-secondary">Base</div>
                              <div className="font-semibold">{formatInr(getBillGross(bill))}</div>
                            </div>
                            <div>
                              <div className="text-sm text-secondary">Discount</div>
                              <div className="font-semibold text-orange-600">{getBillDiscountForStats(bill) > 0 ? `-${formatInr(getBillDiscountForStats(bill))}` : "�"}</div>
                            </div>
                            <div>
                              <div className="text-sm text-secondary">Payable</div>
                              <div className="font-semibold text-blue-600">{formatInr(getBillPayable(bill))}</div>
                            </div>
                          </div>

                          {/* ========== PHASE 4: Enhanced payment display ========== */}
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-sm text-secondary">Paid</div>
                              <div className="font-semibold text-green-600">{paidDisplay}</div>
                            </div>
                            <div>
                              <div className="text-sm text-secondary">Outstanding</div>
                              <div className="font-semibold text-red-600">
                                {bill.is_current === false ? "�" : formatInr(Math.max(getBillPayable(bill) - paidAmount, 0))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 text-xs">
                            <div className="text-secondary">Payment Mode:</div>
                            <div className="font-medium text-white">{bill.payment_mode || "Not specified"}</div>
                          </div>
                          <div className="mt-4 border-t pt-4 flex gap-3">
                            <button
                              onClick={() => handleShareInvoice(bill)}
                              disabled={sendingInvoiceBillId === bill.id}
                              className="flex-1 text-center text-primary font-semibold hover:underline disabled:opacity-60"
                            >
                              {sendingInvoiceBillId === bill.id ? "Sending..." : "Send Invoice"}
                            </button>
                            <button
                              onClick={() => openEditModal(bill)}
                              className="flex-1 text-center text-sm font-semibold px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openHistoryModal(bill)}
                              className="flex-1 text-center text-sm font-semibold px-3 py-1 rounded bg-gray-100 text-white hover:bg-gray-200"
                            >
                              History
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-1">Record Payment</h3>
            <p className="text-sm text-secondary mb-4">
              Outstanding balance:{" "}
              <span className="font-semibold text-white">
                {formatInr(
                  Math.max(
                    getBillPayable(paymentModal) -
                    (paymentModal.payments
                      ?.filter((p) => isCountable(p.status))
                      .reduce((s, p) => s + Number(p.amount_paid || 0), 0) || 0),
                    0
                  )
                )}
              </span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary">Amount Received (?)</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-card text-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-card text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closePaymentModal}
                className="flex-1 border rounded-lg py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={savePayment}
                disabled={savingPayment || !payAmount || Number(payAmount) <= 0}
                className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-bold disabled:opacity-60"
              >
                {savingPayment ? "Saving�" : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FEE MODAL */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-4">Edit Fee</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-blue-400">Base Amount (?)</label>
                <input
                  type="number"
                  value={editData.base_amount}
                  onChange={(e) => setEditData({ ...editData, base_amount: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-blue-900 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-400">Discount (?)</label>
                <input
                  type="number"
                  value={editData.discount_amount}
                  onChange={(e) => setEditData({ ...editData, discount_amount: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-blue-900 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-400">Billing Date</label>
                <input
                  type="date"
                  value={editData.billing_date}
                  onChange={(e) => setEditData({ ...editData, billing_date: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-blue-900 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-400">Amount Paid (?)</label>
                <input
                  type="number"
                  value={editData.amount_paid}
                  onChange={(e) => setEditData({ ...editData, amount_paid: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-blue-900 text-white"
                />
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-xs text-secondary">New Final Amount</div>
                  <div className="text-lg font-bold text-white">
                    {formatInr(Math.max(Number(editData.base_amount || 0) - Number(editData.discount_amount || 0), 0))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditData({ ...editData, amount_paid: Math.max(Number(editData.base_amount || 0) - Number(editData.discount_amount || 0), 0) })}
                  className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 text-blue-600"
                >
                  Set as Paid
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                className="flex-1 border rounded-lg py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-bold disabled:opacity-60"
              >
                {savingEdit ? "Saving�" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-bold mb-4">Edit History</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingHistory ? (
                <p className="text-center text-secondary py-10">Loading history...</p>
              ) : historyModal.logs.length === 0 ? (
                <p className="text-center text-secondary py-10">No edit history found.</p>
              ) : (
                historyModal.logs.map((log) => (
                  <div key={log.id} className="border-l-2 border-primary pl-4 py-1">
                    <div className="text-xs text-gray-400 font-medium">
                      {new Date(log.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-sm font-semibold text-white mt-1">
                      {log.message}
                    </div>
                    {log.details?.old_values && log.details?.new_values && (
                      <div className="mt-2 text-xs bg-slate-800/50 p-2 rounded border space-y-1">
                        <div className="flex justify-between">
                          <span className="text-secondary">Base Amount:</span>
                          <span>?{log.details.old_values.base_amount} ? ?{log.details.new_values.base_amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">Discount:</span>
                          <span>?{log.details.old_values.discount_amount} ? ?{log.details.new_values.discount_amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">Due Date:</span>
                          <span>{log.details.old_values.due_date} ? {log.details.new_values.due_date}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <button
              onClick={closeHistoryModal}
              className="mt-6 w-full border rounded-lg py-2 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
