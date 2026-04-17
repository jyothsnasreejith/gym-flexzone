import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import PageHeader from "../../components/PageHeader";
import { useToast } from "../../context/ToastContext";
import { isCountable } from "../../utils/paymentStatus";

export default function AddBill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const preselectedMemberId = location.state?.memberId;

  const [members, setMembers] = useState([]);

  // UI state
  const [selectedMemberId, setSelectedMemberId] = useState(
    preselectedMemberId || ""
  );
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);

  const [saving, setSaving] = useState(false);
  const [memberPackage, setMemberPackage] = useState(null);
  const [memberAddOns, setMemberAddOns] = useState([]);
  const [referralReward, setReferralReward] = useState(0);
  const [referralIds, setReferralIds] = useState([]);
  const [billedAddOnsAmount, setBilledAddOnsAmount] = useState(0);
  const [billedPackageAmount, setBilledPackageAmount] = useState(0);
  const [paidAddOnsAmount, setPaidAddOnsAmount] = useState(0);
  const [paidPackageAmount, setPaidPackageAmount] = useState(0);
  const [payableAddOnsAmount, setPayableAddOnsAmount] = useState(0);
  const [payablePackageAmount, setPayablePackageAmount] = useState(0);
  const [allAddOnBills, setAllAddOnBills] = useState([]);

  /* ================= REFERRAL REWARD LOADER ================= */
  const loadReferralReward = async (memberId) => {
    const { data, error } = await supabase
      .from("referrals")
      .select("id, reward_amount")
      .eq("referrer_id", memberId)
      .eq("reward_applied", false)
      .gt("reward_amount", 0);

    if (error) {
      console.error("LOAD REFERRAL REWARD ERROR:", error);
      setReferralReward(0);
      setReferralIds([]);
      return;
    }

    const rows = data || [];
    const total = rows.reduce((s, r) => s + Number(r.reward_amount || 0), 0);
    setReferralReward(total);
    setReferralIds(rows.map((r) => r.id));
  };

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const loadData = async () => {
      if (preselectedMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id, full_name, joining_date, created_at, payment_mode")
          .eq("id", preselectedMemberId)
          .single();
        if (member) {
          setMembers([member]);
          setSelectedMemberId(member.id);
          setPaymentMode(member.payment_mode || "cash");

          const result = await loadMemberDetails(member.id);
          setMemberPackage(result?.pkg || null);
          setMemberAddOns(result?.addOns || []);
          setBilledAddOnsAmount(result?.billedAddOns || 0);
          setBilledPackageAmount(result?.billedPackage || 0);
          setPaidAddOnsAmount(result?.paidAddOns || 0);
          setPaidPackageAmount(result?.paidPackage || 0);
          setPayableAddOnsAmount(result?.payableAddOns || 0);
          setPayablePackageAmount(result?.payablePackage || 0);
          setAllAddOnBills(result?.rawAddOnBills || []);
          await loadReferralReward(member.id);
        }
      } else {
        const { data: allMembers, error: mErr } = await supabase
          .from("members")
          .select("id, full_name, joining_date, created_at, payment_mode")
          .order("full_name");
        if (mErr) console.error("Failed to load members:", mErr);
        setMembers(allMembers || []);
      }
    };

    loadData();
  }, [preselectedMemberId]);

  /* ================= DERIVED DATA ================= */
  const packageTotal = memberPackage ? Number(memberPackage.price || 0) : 0;
  const addOnsTotal = (memberAddOns || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const fullConfigTotal = packageTotal + addOnsTotal;

  const totalBilledBase = billedPackageAmount + billedAddOnsAmount;
  const outstandingOnBills = Math.max(0, payablePackageAmount - paidPackageAmount);
  const unbilledTotal = Math.max(0, fullConfigTotal - totalBilledBase);
  const outstandingTotal = outstandingOnBills + unbilledTotal;

  const referralDiscount = Number(referralReward || 0);
  const discount = Number(discountAmount || 0);
  const finalAmount = Math.max(0, outstandingTotal - discount - referralDiscount);
  const hasUnbilled = unbilledTotal > 0;

  const getBillPayable = (bill) => {
    if (bill.payable_amount !== undefined && bill.payable_amount !== null) {
      return Number(bill.payable_amount);
    }
    const base = Number(bill.base_amount ?? 0);
    const disc = Number(bill.discount_amount ?? 0);
    const amount = Number(bill.amount ?? 0);
    if (amount !== undefined && amount !== null && amount > 0) return amount;
    return Math.max(base - disc, 0);
  };

  const getPaidAmount = (bill) =>
    (bill.payments || [])
      .filter((p) => isCountable(p.status))
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

  const getBillDateValue = (bill) => {
    const raw = bill.billing_date || bill.due_date || bill.created_at || 0;
    const value = new Date(raw).getTime();
    return Number.isNaN(value) ? 0 : value;
  };

  const getBillKey = (bill) => {
    if (bill.bill_type === "add_on") return `add_on:${bill.id}`;
    if (bill.notes && String(bill.notes).startsWith('Balance Payment for')) return `balance:${bill.id}`;
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
      } else if (getBillDateValue(bill) > getBillDateValue(existing)) {
        keep = bill;
        discard = existing;
      }

      if (keep !== existing) map.set(key, keep);
      duplicates.push(discard);
    });

    return { deduped: Array.from(map.values()), duplicates };
  };

  const userHasEditedPaidRef = useRef(false);
  const lastMemberIdRef = useRef(selectedMemberId);

  useEffect(() => {
    const memberChanged = lastMemberIdRef.current !== selectedMemberId;
    if (memberChanged) {
      userHasEditedPaidRef.current = false;
      setAmountPaid(finalAmount);
    } else if (!userHasEditedPaidRef.current) {
      setAmountPaid(finalAmount);
    }
    lastMemberIdRef.current = selectedMemberId;
  }, [finalAmount, selectedMemberId]);

  const handleMemberChange = async (e) => {
    const memberId = e.target.value;
    setSelectedMemberId(memberId);
    userHasEditedPaidRef.current = false;

    if (memberId) {
      const { data: member } = await supabase
        .from("members")
        .select("payment_mode")
        .eq("id", memberId)
        .single();

      setPaymentMode(member?.payment_mode || "cash");

      const result = await loadMemberDetails(memberId);
      setMemberPackage(result?.pkg || null);
      setMemberAddOns(result?.addOns || []);
      setBilledAddOnsAmount(result?.billedAddOns || 0);
      setBilledPackageAmount(result?.billedPackage || 0);
      setPaidAddOnsAmount(result?.paidAddOns || 0);
      setPaidPackageAmount(result?.paidPackage || 0);
      setPayableAddOnsAmount(result?.payableAddOns || 0);
      setPayablePackageAmount(result?.payablePackage || 0);
      setAllAddOnBills(result?.rawAddOnBills || []);
      await loadReferralReward(memberId);
    } else {
      setMemberPackage(null);
      setMemberAddOns([]);
      setBilledAddOnsAmount(0);
      setBilledPackageAmount(0);
      setReferralReward(0);
      setReferralIds([]);
      setPaymentMode("cash");
    }
  };

  const loadMemberDetails = async (memberId) => {
    // 1. Get member's current package variant
    const { data: member } = await supabase
      .from("members")
      .select("package_variant_id")
      .eq("id", memberId)
      .single();

    let pkgInfo = null;
    if (member?.package_variant_id) {
      const { data: variant } = await supabase
        .from("package_variants")
        .select("id, price, duration_value, duration_unit, package_id, pricing_type")
        .eq("id", member.package_variant_id)
        .single();

      if (variant) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("title")
          .eq("id", variant.package_id)
          .single();

        pkgInfo = { ...variant, package_title: pkg?.title || "Unknown Package" };
      }
    }

    // 2. Get current add-ons assigned to member
    const { data: ma } = await supabase
      .from("member_add_ons")
      .select("add_on_id")
      .eq("member_id", memberId);

    let addOnsList = [];
    if (ma && ma.length > 0) {
      const ids = ma.map((r) => String(r.add_on_id));
      const { data: ao } = await supabase
        .from("add_ons")
        .select("id, name, amount, duration_value, duration_unit")
        .in("id", ids);
      addOnsList = ao || [];
    }

    // 3. Get ALL bills for member
    const { data: allBills } = await supabase
      .from("bills")
      .select("id, bill_type, base_amount, payable_amount, amount, discount_amount, payment_status, member_id, is_current, billing_date, created_at, notes")
      .eq("member_id", memberId)
      .order("billing_date", { ascending: false });

    const allBillsList = allBills || [];
    const allBillIds = allBillsList.map(b => b.id).filter(Boolean);

    // Fetch payments for ALL bills
    let paymentsMap = {};
    if (allBillIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .in("bill_id", allBillIds);

      (paymentsData || []).forEach(p => {
        if (!paymentsMap[p.bill_id]) paymentsMap[p.bill_id] = [];
        paymentsMap[p.bill_id].push(p);
      });
    }

    allBillsList.forEach(bill => {
      bill.payments = paymentsMap[bill.id] || paymentsMap[String(bill.id)] || [];
    });

    // Balance payment bills = notes starts with "Balance Payment for"
    const isBalancePmt = (b) => b.notes && String(b.notes).startsWith('Balance Payment for');

    // Root bills = non-balance-payment bills — for base/gross calculation
    const rootBills = allBillsList.filter(b => !isBalancePmt(b));
    const currentBills = allBillsList.filter(b => b.is_current !== false);

    const { deduped: dedupedBills } = dedupeBillsByKey(currentBills);

    // 4. Gross/base from root bills
    const billedPkgBaseFromRoot = rootBills
      .filter(b => b.bill_type !== "add_on")
      .reduce((sum, b) => sum + Number(b.base_amount || 0), 0);
    const billedAoBaseFromRoot = rootBills
      .filter(b => b.bill_type === "add_on")
      .reduce((sum, b) => sum + Number(b.base_amount || 0), 0);
    const allBilledBase = billedPkgBaseFromRoot + billedAoBaseFromRoot;

    // 5. Discount and paid from ALL bills
    const totalDiscountAllBills = allBillsList.reduce(
      (sum, b) => sum + Number(b.discount_amount || 0), 0
    );
    const totalPaidAllBills = allBillsList.reduce(
      (sum, b) => sum + getPaidAmount(b), 0
    );

    // 6. Full config cost
    const pkgPrice = Number(pkgInfo?.price || 0);
    const aoTotal = addOnsList.reduce((sum, ao) => sum + Number(ao.amount || 0), 0);
    const fullConfigTotal = pkgPrice + aoTotal;

    // 7. KEY FIX: Outstanding = what's owed on existing bills only (payable - paid).
    //    Do NOT add unbilled on top — if there are existing bills, they already
    //    represent the config. "Unbilled" only applies when NO bills exist at all.
    const hasAnyBill = rootBills.length > 0;
    const totalPayableNet = Math.max(0, allBilledBase - totalDiscountAllBills);
    const outstandingOnBills = Math.max(0, totalPayableNet - totalPaidAllBills);

    // Unbilled only counts when nothing has ever been billed yet
    const unbilledTotal = hasAnyBill ? 0 : Math.max(0, fullConfigTotal - allBilledBase);

    const totalOutstanding = outstandingOnBills + unbilledTotal;

    return {
      pkg: pkgInfo,
      addOns: addOnsList,
      billedAddOns: billedAoBaseFromRoot,
      billedPackage: billedPkgBaseFromRoot,
      paidAddOns: dedupedBills
        .filter(b => b.bill_type === "add_on")
        .reduce((sum, b) => sum + getPaidAmount(b), 0),
      paidPackage: totalPaidAllBills,
      payableAddOns: dedupedBills
        .filter(b => b.bill_type === "add_on")
        .reduce((sum, b) => sum + getBillPayable(b), 0),
      // KEY: payablePackage = total net payable across ALL bills (used for outstanding calc)
      payablePackage: totalPayableNet,
      rawAddOnBills: dedupedBills,
    };
  };

  /* ================= SUBMIT ================= */
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!memberPackage && memberAddOns.length === 0) {
      showToast("Selected member has no package or add-ons assigned", "error");
      return;
    }

    const paidAmountValue = Math.max(Number(amountPaid) || 0, 0);

    setSaving(true);

    try {
      const today = new Date().toISOString().slice(0, 10);

      // === Re-fetch live data to ensure accuracy ===
      const { data: allBillsRaw = [] } = await supabase
        .from("bills")
        .select("id, bill_type, base_amount, payable_amount, discount_amount, payment_status, notes, is_current, package_id, package_variant_id")
        .eq("member_id", selectedMemberId);

      const isBalancePmt = (b) => b.notes && String(b.notes).startsWith('Balance Payment for');
      const rootBillsLive = allBillsRaw.filter(b => !isBalancePmt(b));
      const currentBillsLive = allBillsRaw.filter(b => b.is_current !== false);

      // Fetch payments for all bills (including archived)
      const allIds = allBillsRaw.map(b => b.id).filter(Boolean);
      let paymentsMap = {};
      if (allIds.length > 0) {
        const { data: pd } = await supabase
          .from("payments")
          .select("*")
          .in("bill_id", allIds);
        (pd || []).forEach(p => {
          if (!paymentsMap[p.bill_id]) paymentsMap[p.bill_id] = [];
          paymentsMap[p.bill_id].push(p);
        });
      }
      allBillsRaw.forEach(b => {
        b.payments = paymentsMap[b.id] || [];
      });

      // Get live config prices from DB
      const { data: pkgVariantData } = await supabase
        .from("members")
        .select("package_variant_id")
        .eq("id", selectedMemberId)
        .single();

      let dbPkgPrice = 0;
      if (pkgVariantData?.package_variant_id) {
        const { data: variantPrice } = await supabase
          .from("package_variants")
          .select("price")
          .eq("id", pkgVariantData.package_variant_id)
          .single();
        if (variantPrice) dbPkgPrice = Number(variantPrice.price || 0);
      }

      const { data: aoRows } = await supabase
        .from("member_add_ons")
        .select("add_ons(name, amount)")
        .eq("member_id", selectedMemberId);
      const aoTotal = (aoRows || []).reduce((s, r) => s + Number(r.add_ons?.amount || 0), 0);
      const allConfigAddOns = (aoRows || []).map(r => ({ name: r.add_ons?.name, amount: Number(r.add_ons?.amount || 0) })).filter(a => a.name);

      const totalConfigPrice = dbPkgPrice + aoTotal;

      // Billed base from root bills (including archived — they still represent billed amounts)
      const billedBase = rootBillsLive.reduce((s, b) => s + Number(b.base_amount || 0), 0);
      const hasAnyRootBill = rootBillsLive.length > 0;

      // Total paid & discount across ALL bills (like Fees.jsx)
      const totalPaidLive = allBillsRaw.reduce((s, b) =>
        s + (b.payments || []).filter(p => isCountable(p.status)).reduce((a, p) => a + Number(p.amount_paid || 0), 0), 0);
      const totalDiscLive = allBillsRaw.reduce((s, b) => s + Number(b.discount_amount || 0), 0);
      const totalPayableLive = Math.max(0, billedBase - totalDiscLive);
      const outstandingLive = Math.max(0, totalPayableLive - totalPaidLive);

      // Unbilled = config items not yet in any root bill (always calculate, even when bills exist)
      const unbilledLive = Math.max(0, totalConfigPrice - billedBase);

      // Expiry date calculation
      let newExpiryDate = null;
      const durValue = Number(memberPackage?.duration_value || 0);
      const durUnit = (memberPackage?.duration_unit || "").toLowerCase();
      if (durValue > 0 && durUnit) {
        const expiry = new Date(today);
        if (durUnit === "month" || durUnit === "months") expiry.setMonth(expiry.getMonth() + durValue);
        else if (durUnit === "year" || durUnit === "years") expiry.setFullYear(expiry.getFullYear() + durValue);
        else if (durUnit.includes("day")) expiry.setDate(expiry.getDate() + durValue);
        newExpiryDate = expiry.toISOString().slice(0, 10);
      }

      // Add-on expiry
      let addOnExpiryDate = null;
      memberAddOns.forEach(ao => {
        const val = Number(ao.duration_value || 0);
        const unit = (ao.duration_unit || "").toLowerCase();
        if (val > 0 && unit) {
          const exp = new Date(today);
          if (unit === "month" || unit === "months") exp.setMonth(exp.getMonth() + val);
          else if (unit === "year" || unit === "years") exp.setFullYear(exp.getFullYear() + val);
          else if (unit.includes("day")) exp.setDate(exp.getDate() + val);
          if (!addOnExpiryDate || exp.toISOString() > addOnExpiryDate) {
            addOnExpiryDate = exp.toISOString().slice(0, 10);
          }
        }
      });
      const combinedDueDate = newExpiryDate || addOnExpiryDate || today;

      // Build descriptive notes with actual package/add-on names
      const aoNamesList = memberAddOns.map(ao => ao.name).filter(Boolean);
      const aoNotesStr = aoNamesList.length > 0 ? ` + Add-ons: ${aoNamesList.join(", ")}` : "";
      const pkgTitle = memberPackage?.package_title || "Package";
      const itemsLabel = `${pkgTitle}${aoNotesStr}`;

      const totalDisc = Number(discountAmount || 0) + Number(referralReward || 0);

      // ================================================================
      // CASE 1: No root bills exist yet — create the first bill
      // ================================================================
      if (!hasAnyRootBill) {
        const baseAmt = totalConfigPrice;
        const finalPayable = Math.max(0, baseAmt - totalDisc);
        const derivedSt = paidAmountValue <= 0 ? "unpaid"
          : paidAmountValue >= finalPayable ? "paid"
          : "partial";

        const { data: newBill, error: billErr } = await supabase
          .from("bills")
          .insert({
            member_id: selectedMemberId,
            package_id: memberPackage?.package_id || null,
            package_variant_id: memberPackage?.id || null,
            bill_type: "package",
            base_amount: baseAmt,
            discount_amount: totalDisc,
            payable_amount: finalPayable,
            amount: finalPayable,
            payment_status: derivedSt,
            payment_mode: paymentMode,
            billing_date: today,
            due_date: combinedDueDate,
            is_current: true,
            notes: notes?.trim() || itemsLabel,
          })
          .select()
          .single();

        if (billErr) throw billErr;

        if (paidAmountValue > 0 && newBill) {
          await supabase.from("payments").insert({
            bill_id: newBill.id,
            amount_paid: paidAmountValue,
            payment_date: today,
            method: paymentMode,
            status: derivedSt,
          });
        }

        showToast("Fee saved successfully", "success");
      }
      // ================================================================
      // CASE 2: New unbilled items exist (add-on/package added after
      //         initial billing) — create bill for unbilled portion only
      // ================================================================
      else if (unbilledLive > 0) {
        const hasBilledPackage = rootBillsLive.some(b => b.bill_type !== 'add_on');
        const billType = hasBilledPackage ? "add_on" : "package";
        const baseAmt = unbilledLive;
        const finalPayable = Math.max(0, baseAmt - totalDisc);
        const derivedSt = paidAmountValue <= 0 ? "unpaid"
          : paidAmountValue >= finalPayable ? "paid"
          : "partial";

        // Figure out which add-ons are newly unbilled by matching amounts
        const billedAoBase = rootBillsLive
          .filter(b => b.bill_type === 'add_on')
          .reduce((s, b) => s + Number(b.base_amount || 0), 0);
        const unbilledAoAmt = Math.max(0, aoTotal - billedAoBase);
        let unbilledLabel;
        if (billType === 'add_on' && unbilledAoAmt > 0) {
          // Find subset of add-ons whose amounts sum to the unbilled amount
          const findSubset = (items, target) => {
            const n = items.length;
            if (n === 0 || n > 15) return null;
            for (let mask = 1; mask < (1 << n); mask++) {
              let sum = 0;
              const subset = [];
              for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) { sum += items[i].amount; subset.push(items[i]); }
              }
              if (Math.abs(sum - target) < 0.01) return subset;
            }
            return null;
          };
          const matched = findSubset(allConfigAddOns, unbilledAoAmt);
          const unbilledNames = matched ? matched.map(a => a.name) : allConfigAddOns.map(a => a.name);
          unbilledLabel = `Add-ons: ${unbilledNames.join(', ')}`;
        } else {
          unbilledLabel = itemsLabel;
        }

        const { data: newBill, error: billErr } = await supabase
          .from("bills")
          .insert({
            member_id: selectedMemberId,
            package_id: memberPackage?.package_id || null,
            package_variant_id: memberPackage?.id || null,
            bill_type: billType,
            base_amount: baseAmt,
            discount_amount: totalDisc,
            payable_amount: finalPayable,
            amount: finalPayable,
            payment_status: derivedSt,
            payment_mode: paymentMode,
            billing_date: today,
            due_date: combinedDueDate,
            is_current: true,
            notes: notes?.trim() || unbilledLabel,
          })
          .select()
          .single();

        if (billErr) throw billErr;

        if (paidAmountValue > 0 && newBill) {
          await supabase.from("payments").insert({
            bill_id: newBill.id,
            amount_paid: paidAmountValue,
            payment_date: today,
            method: paymentMode,
            status: derivedSt,
          });
        }

        showToast("Fee saved successfully", "success");
      }
      // ================================================================
      // CASE 3: Everything billed, outstanding exists — archive unpaid
      //         bill(s) and create a new balance payment bill
      // ================================================================
      else if (outstandingLive > 0 && paidAmountValue > 0) {
        // Archive all unpaid/partial current bills
        const unpaidCurrentIds = currentBillsLive
          .filter(b => b.payment_status !== 'paid')
          .map(b => b.id);

        if (unpaidCurrentIds.length > 0) {
          await supabase
            .from("bills")
            .update({ payment_status: "paid", is_current: false })
            .in("id", unpaidCurrentIds);
        }

        // Balance payment bill — base = global outstanding
        const baseAmt = outstandingLive;
        const finalPayable = Math.max(0, baseAmt - totalDisc);
        const actualPaid = Math.min(paidAmountValue, finalPayable);
        const derivedSt = actualPaid >= finalPayable ? "paid" : "partial";

        // Reference bill for package_id/variant_id
        const referenceBill = currentBillsLive[0] || rootBillsLive[0];

        const { data: balanceBill, error: billErr } = await supabase
          .from("bills")
          .insert({
            member_id: selectedMemberId,
            package_id: referenceBill?.package_id || memberPackage?.package_id || null,
            package_variant_id: referenceBill?.package_variant_id || memberPackage?.id || null,
            bill_type: referenceBill?.bill_type || "package",
            base_amount: baseAmt,
            discount_amount: totalDisc,
            payable_amount: finalPayable,
            amount: finalPayable,
            payment_status: derivedSt,
            payment_mode: paymentMode,
            billing_date: today,
            due_date: combinedDueDate,
            is_current: true,
            notes: `Balance Payment for ${itemsLabel}`,
          })
          .select()
          .single();

        if (billErr) throw billErr;

        await supabase.from("payments").insert({
          bill_id: balanceBill.id,
          amount_paid: actualPaid,
          payment_date: today,
          method: paymentMode,
          status: derivedSt,
        });

        const remaining = Math.max(0, finalPayable - actualPaid);
        showToast(
          remaining > 0
            ? `Payment of ₹${actualPaid} recorded. Remaining: ₹${remaining}`
            : `Payment complete. No outstanding balance.`,
          "success"
        );
      }
      // ================================================================
      // CASE 4: Nothing outstanding, no unbilled — advance/extra payment
      // ================================================================
      else if (paidAmountValue > 0) {
        const { data: advanceBill, error: advErr } = await supabase
          .from("bills")
          .insert({
            member_id: selectedMemberId,
            bill_type: "package",
            base_amount: paidAmountValue,
            discount_amount: 0,
            payable_amount: paidAmountValue,
            amount: paidAmountValue,
            payment_status: "paid",
            payment_mode: paymentMode,
            billing_date: today,
            due_date: combinedDueDate,
            is_current: true,
            notes: notes?.trim() || "Advance payment",
          })
          .select()
          .single();

        if (advErr) throw advErr;

        await supabase.from("payments").insert({
          bill_id: advanceBill.id,
          amount_paid: paidAmountValue,
          payment_date: today,
          method: paymentMode,
          status: "paid",
        });

        showToast(`Advance payment of ₹${paidAmountValue} recorded.`, "success");
      } else {
        showToast("Nothing to bill or pay.", "info");
        setSaving(false);
        return;
      }

      // Update member end_date
      if (newExpiryDate) {
        await supabase
          .from("members")
          .update({ end_date: newExpiryDate })
          .eq("id", selectedMemberId);
      }

      // Mark referral rewards as applied
      if (referralIds.length > 0) {
        await supabase
          .from("referrals")
          .update({ reward_applied: true })
          .in("id", referralIds);
      }

      navigate("/billing", { state: { memberId: selectedMemberId } });
    } catch (err) {
      console.error("Fee creation failed:", err);
      showToast(err.message || "Fee assignment failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */
  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 bg-navy">
      <PageHeader title="Add Fee" backTo="/billing" />

      <form
        onSubmit={submit}
        className="bg-card p-5 sm:p-6 rounded-xl border space-y-6"
      >
        {/* MEMBER */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white uppercase">
            Member
          </h2>

          <select
            name="member_id"
            required
            value={selectedMemberId}
            className="w-full border rounded-lg px-3 py-2 bg-card text-white"
            onChange={handleMemberChange}
            disabled={!!preselectedMemberId}
          >
            <option value="">Select member *</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
          <div className="pt-2">
            {memberPackage || memberAddOns.length > 0 ? (
              <div className="bg-slate-800/50 p-3 rounded-lg border text-sm space-y-1">
                {memberPackage && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {memberPackage.package_title} ({memberPackage.duration_value}{" "}
                        {memberPackage.duration_unit})
                      </p>
                      {paidPackageAmount >= payablePackageAmount && payablePackageAmount > 0 ? (
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                      ) : (payablePackageAmount - paidPackageAmount) > 0 ? (
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">₹{payablePackageAmount - paidPackageAmount} Outstanding</span>
                      ) : null}
                    </div>
                    <p className="text-secondary text-xs">₹{memberPackage.price}</p>
                  </>
                )}

                {memberAddOns.length > 0 && (
                  <div className={`mt-2 ${memberPackage ? 'pt-2 border-t border-slate-700/20' : ''}`}>
                    <p className="text-xs text-secondary font-semibold mb-1 uppercase">Add-ons</p>
                    {memberAddOns.map(ao => (
                      <div key={ao.id} className="flex justify-between items-center text-xs">
                        <span>{ao.name}</span>
                        <span className="font-medium">₹{ao.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-secondary text-sm">No package or add-ons assigned</p>
            )}
          </div>
        </section>

        {/* BILLING SUMMARY */}
        <section className="bg-slate-800/50 border rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase">
            Fee Summary
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-lg flex-1 border">
              <label className="text-[10px] sm:text-xs text-secondary font-semibold mb-1 uppercase block">
                Outstanding Amount
              </label>
              <div className="text-xl sm:text-2xl font-bold">₹{outstandingTotal}</div>
              <p className="text-[10px] text-gray-400 mt-1">Package & Add-on combined</p>
            </div>

            <div>
              <label className="text-xs text-secondary">Discount</label>
              <input
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-card text-white focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-secondary">Referral Reward</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-blue-50/50 border border-secondary-blue text-sm text-blue-700">
                ₹{referralDiscount}
              </div>
            </div>

            <div>
              <label className="text-xs text-secondary">Final Amount</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm font-bold text-green-700">
                ₹{finalAmount}
              </div>
            </div>
          </div>
        </section>

        {/* PAYMENT */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase">
            Payment
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-secondary">Amount Paid</label>
              <input
                type="number"
                min="0"
                value={amountPaid}
                onChange={(e) => {
                  userHasEditedPaidRef.current = true;
                  setAmountPaid(e.target.value);
                }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-card text-white"
              />
            </div>
            <div>
              <label className="text-xs text-secondary">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 bg-card text-white"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>
        </section>

        {/* NOTES */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white uppercase">
            Notes (optional)
          </h2>

          <textarea
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-card text-white"
          />
        </section>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate("/billing")}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || Number(amountPaid || 0) <= 0}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Fee"}
          </button>
        </div>
      </form>
    </main>
  );
}