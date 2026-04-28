import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { useToast } from "../context/ToastContext";

const MEMBER_STATUS = {
  NEW: "New",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PAUSED: "Paused",
  CONVERTED: "Converted",
};

export default function AddMember() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD PACKAGES + TRAINERS ================= */
  useEffect(() => {
    const loadMeta = async () => {
      const { data: tr } = await supabase
        .from("trainers")
        .select("id, full_name")
        .order("full_name");

      const { data: ao, error: aoError } = await supabase
        .from("add_ons")
        .select("id, name, duration_value, duration_unit, amount, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      let pkg = [];
      const pkgQuery = await supabase
        .from("packages")
        .select(
          `
            id,
            title,
            category,
            member_scope,
            member_count,
            batch_slot_id,
            batch_start_time,
            batch_end_time,
            is_student_offer,
            package_variants (
              id,
              pricing_type,
              duration_unit,
              duration_value,
              weekly_days,
              sessions_total,
              price,
              is_active
            )
          `
        )
        .eq("is_active", true);

      if (!pkgQuery.error) {
        pkg = pkgQuery.data || [];
      } else {
        const fallback = await supabase
          .from("packages")
          .select(
            `
              id,
              title,
              category,
              member_scope,
              member_count,
              is_student_offer,
              package_variants (
                id,
                pricing_type,
                duration_unit,
                duration_value,
                weekly_days,
                sessions_total,
                price,
                is_active
              )
            `
          )
          .eq("is_active", true);
        pkg = fallback.data || [];
      }

      setPackages(pkg);
      setTrainers(tr || []);
      setAddOns(!aoError ? (ao || []).map(a => ({ ...a, id: String(a.id) })) : []);
      setLoading(false);
    };

    loadMeta();
  }, []);

  /* ================= SUBMIT ================= */
  const submit = async (payload, _idProofFile, _photoFile, dependentsPayload = [], addOnDates = {}) => {
    const { add_on_ids, ...rest } = payload;
    const enrichedPayload = {
      ...rest,

      // REQUIRED DEFAULTS
      status: MEMBER_STATUS.NEW,
      payment_status: "unpaid",
      is_active: true,
      is_deleted: false,
      deleted_at: null,
      joining_date:
        payload.joining_date || new Date().toISOString().slice(0, 10),
      batch:
        payload.batch_start_time && payload.batch_end_time
          ? `${payload.batch_start_time}-${payload.batch_end_time}`
          : null,
      source: "admin",
    };

    const { data, error } = await supabase
      .from("members")
      .insert(enrichedPayload)
      .select("*");

    if (error) {
      console.error("ADD MEMBER FAILED", error);
      throw error;
    }

    const member = data?.[0];

    const selectedAddOnIds = Array.isArray(add_on_ids)
      ? add_on_ids.map((id) => String(id))
      : [];

    if (member && selectedAddOnIds.length > 0) {
      try {
        const rows = selectedAddOnIds.map((id) => ({
          member_id: member.id,
          add_on_id: id,
          start_date: addOnDates[String(id)]?.start_date || null,
          end_date: addOnDates[String(id)]?.end_date || null,
        }));
        const { error: addOnErr } = await supabase.from("member_add_ons").insert(rows);
        if (addOnErr) {
          console.error("ADD MEMBER ADD-ONS FAILED", addOnErr);
          alert("Member created, but failed to save add-ons: " + addOnErr.message);
        }
      } catch (err) {
        console.error("ADD MEMBER ADD-ONS EXCEPTION", err);
      }
    }

    // Create consolidated bill for the new cycle
    if (member) {
      const variantId = Number(payload.package_variant_id);
      let selectedVariant = null;
      let pkgTitle = "Package";
      let pkgId = null;

      for (const pkg of packages) {
        const v = (pkg.package_variants || []).find(v => Number(v.id) === variantId);
        if (v) {
          selectedVariant = v;
          pkgTitle = pkg.title;
          pkgId = pkg.id;
          break;
        }
      }

      const packagePrice = selectedVariant ? Number(selectedVariant.price || 0) : 0;
      const discountValue = Number(payload.discount_amount || 0);

      const addOnNames = [];
      let addOnTotal = 0;
      if (selectedAddOnIds.length > 0) {
        selectedAddOnIds.forEach(id => {
          const ao = addOns.find(a => String(a.id) === String(id));
          if (ao) {
            addOnNames.push(ao.name);
            addOnTotal += Number(ao.amount || 0);
          }
        });
      }

      const totalBase = packagePrice + addOnTotal;
      const totalPayable = Math.max(0, totalBase - discountValue);
      const addOnNotes = addOnNames.length > 0 ? ` + Add-ons: ${addOnNames.join(", ")}` : "";

      // Create bill even if no package — add-on only members need a bill too
      const shouldCreateBill = variantId || selectedAddOnIds.length > 0;
      if (shouldCreateBill) {
        await supabase.from("bills").insert({
          member_id: member.id,
          package_id: pkgId,
          package_variant_id: variantId ? variantId : null,
          bill_type: selectedAddOnIds.length > 0 && !variantId ? "add_on" : "package",
          base_amount: totalBase,
          payable_amount: totalPayable,
          amount: 0,
          discount_amount: discountValue,
          payment_status: "unpaid",
          billing_date: enrichedPayload.joining_date,
          due_date: enrichedPayload.joining_date,
          is_current: true,
          notes: `Admin Added: ${pkgTitle}${addOnNotes}`,
        });
      }
    }

    // Save referral relationship
    if (member && payload.referred_by) {
      // 1. Fetch current reward amount from settings
      const { data: rewardSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "referral_reward_amount")
        .single();

      const currentReward = Number(rewardSetting?.value || 0);

      // 2. Upsert referral record with the dynamic amount
      const { error: refErr } = await supabase.from("referrals").upsert({
        referrer_id: payload.referred_by,
        referee_id: member.id,
        reward_amount: currentReward,
        reward_applied: false,
      }, { onConflict: "referrer_id,referee_id" });

      if (refErr) {
        console.error("REFERRAL INSERT FAILED", refErr);
      }
    }


    if (member) {
      const deps = Array.isArray(dependentsPayload) ? dependentsPayload : [];
      if (deps.length > 0) {
        const depRows = deps.map(d => ({ ...d, member_id: member.id }));
        const { error: depErr } = await supabase.from("member_dependents").insert(depRows);
        if (depErr) {
          console.error("ADD MEMBER DEPENDENTS FAILED", depErr);
        }
      }
      // Bills are created when payment is recorded in Fees.
    }

    // ID proof and profile photo uploads are handled internally by MemberForm.jsx post-submit logic.

    // Profile photo upload is handled internally by MemberForm.jsx post-submit logic.

    showToast("Member added successfully", "success");
    navigate("/members");
    return member;
  };

  if (loading) {
    return <div className="p-10">Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 bg-navy">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-800/30"
          aria-label="Go back"
        >
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-2xl font-bold ml-2">Add New Member</h1>
      </div>
      <MemberForm
        packages={packages}
        addOns={addOns}
        trainers={trainers}
        onSubmit={submit}
        submitLabel="Add Member"
        requirePackageSelection={true}
        requireTermsAcceptance={false}
        requireEmail={false}
        disablePostSubmitUploads={true}
      />
    </div>
  );
}
