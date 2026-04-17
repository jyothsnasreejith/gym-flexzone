import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MemberForm from "../components/MemberForm";
import { supabase } from "../supabaseClient";

const TABS = [
  { id: "general", label: "General Info", icon: "person" },
  { id: "location", label: "Location & Emergency", icon: "location_on" },
  { id: "vitals", label: "Health & Vitals", icon: "monitor_heart" },
  { id: "membership", label: "Membership", icon: "card_membership" },
  { id: "trainer", label: "Assigned Trainer", icon: "fitness_center" },
];

import { useToast } from "../context/ToastContext";

export default function EditMember() {
  const { id } = useParams();
  const memberId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [member, setMember] = useState(null);
  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [memberAddOnIds, setMemberAddOnIds] = useState([]);
  const [initialAddOnDates, setInitialAddOnDates] = useState({});
  const [memberDependents, setMemberDependents] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [billedAddOnsAmount, setBilledAddOnsAmount] = useState(0); 
  const [billedPackageAmount, setBilledPackageAmount] = useState(0);
  
  const searchParams = new URLSearchParams(location.search);
  const isRenew = searchParams.get('renew') === 'true';
  const [activeTab, setActiveTab] = useState(isRenew ? "membership" : "general");
  const focusSection = location.state?.focus || null;
  const [packageHistory, setPackageHistory] = useState([]);

  /* ================= LOAD MEMBER ================= */
  useEffect(() => {
    if (!Number.isFinite(memberId)) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const loadMember = async () => {
      try {
        const { data, error } = await supabase
          .from("members")
          .select(`
            *,
            referrer:referred_by ( id, full_name )
          `)
          .eq("id", memberId)
          .eq("is_deleted", false)
          .single();

        if (error) throw error;
        // Flatten referrer_name for MemberForm hydration
        setMember({
          ...data,
          referrer_name: data.referrer?.full_name || "",
        });
      } catch (err) {
        console.error("LOAD MEMBER ERROR:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadMember();
  }, [memberId]);

  /* ================= LOAD DEPENDENTS ================= */
  useEffect(() => {
    if (!memberId) return;

    const loadDependents = async () => {
      const { data, error } = await supabase
        .from("member_dependents")
        .select("id, full_name, email, phone, gender, dob, joining_date, relation, address, area, district, pin_code, emergency_contact, emergency_relation, batch_slot_id, batch_start_time, batch_end_time, height_cm, weight_kg, bmi, heart_rate, blood_pressure, sugar_level, medical_issues, medical_other, profile_image_url, id_proof_type, id_proof_url")
        .eq("member_id", memberId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("LOAD DEPENDENTS ERROR:", error);
        setMemberDependents([]);
        return;
      }

      setMemberDependents(data || []);
    };

    loadDependents();
  }, [memberId]);

  /* ================= LOAD PACKAGES ================= */
  useEffect(() => {
    const loadPackages = async () => {
      const { data, error } = await supabase
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

      if (!error) {
        setPackages(data || []);
        return;
      }

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

      if (fallback.error) {
        console.error("LOAD PACKAGES ERROR:", error);
        return;
      }

      setPackages(fallback.data || []);
    };

    loadPackages();
  }, []);

  useEffect(() => {
    const loadAddOns = async () => {
      try {
        const { data, error } = await supabase
          .from("add_ons")
          .select("id, name, duration_value, duration_unit, amount, is_active")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAddOns(data || []);
      } catch (err) {
        console.error("LOAD ADD-ONS ERROR:", err);
        setAddOns([]);
      }
    };

    loadAddOns();
  }, []);

  useEffect(() => {
    if (focusSection !== "package") return;
    if (loading) return;

    const el = document.getElementById("package-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusSection, loading, packages.length]);

  useEffect(() => {
    if (!memberId) return;

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
        .eq("member_id", memberId)
        .order("start_date", { ascending: false });

      if (!error) {
        setPackageHistory(data || []);
      }
    };

    loadPackageHistory();
  }, [memberId]);

  useEffect(() => {
    if (!memberId) return;

    const loadMemberAddOns = async () => {
      const { data, error } = await supabase
        .from("member_add_ons")
        .select("add_on_id, start_date, end_date")
        .eq("member_id", memberId);

      if (!error && data) {
        const ids = data.map((row) => String(row.add_on_id));
        setMemberAddOnIds([...new Set(ids)]);

        const datesMap = {};
        data.forEach((row) => {
          datesMap[String(row.add_on_id)] = {
            start_date: row.start_date,
            end_date: row.end_date,
          };
        });
        setInitialAddOnDates(datesMap);
      } else {
        setMemberAddOnIds([]);
        setInitialAddOnDates({});
      }
    };

    loadMemberAddOns();
  }, [memberId]);

  /* ================= LOAD BILLED AMOUNTS ================= */
  useEffect(() => {
    if (!memberId) return;

    const loadBilled = async () => {
      const { data: bills } = await supabase
        .from("bills")
        .select("base_amount, bill_type")
        .eq("member_id", memberId)
        .eq("is_current", true);

      let p = 0, a = 0;
      (bills || []).forEach(b => {
        if (b.bill_type === "package") p += Number(b.base_amount || 0);
        else if (b.bill_type === "add_on") a += Number(b.base_amount || 0);
      });
      setBilledPackageAmount(p);
      setBilledAddOnsAmount(a);
    };

    loadBilled();
  }, [memberId]);

  /* ================= LOAD TRAINERS ================= */
  useEffect(() => {
    const loadTrainers = async () => {
      try {
        const { data } = await supabase
          .from("trainers")
          .select("id, full_name");
        setTrainers(data || []);
      } catch (err) {
        console.error("TRAINERS LOAD ERROR:", err);
      }
    };

    loadTrainers();
  }, []);

  /* ================= GUARDS ================= */
  if (loading) return <div className="p-10">Loading…</div>;

  if (loadError || !member) {
    return (
      <div className="p-10 text-red-600">
        Failed to load member details.
      </div>
    );
  }

  /* ================= SUBMIT ================= */
  const submit = async (payload, idProofFile, _photoFile, dependentsPayload = [], addOnDates = {}) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      showToast("Session expired. Please log in again.", "error");
      navigate("/login");
      return;
    }

    const { id: _ignore, created_at, coupon_code, add_on_ids, referrer, referrer_name, ...rest } = payload;
    console.log("EDIT MEMBER SUBMIT", {
      fullPayload: payload,
      databasePayload: { ...rest },
      addOnIds: payload.add_on_ids
    });

    const { referred_by: referredBy, ...restWithoutReferral } = rest;

    const normalizedPayload = {
      ...restWithoutReferral,
      coupon_id: rest.coupon_id || null,
      package_variant_id: rest.package_variant_id
        ? Number(rest.package_variant_id)
        : null,
      trainer_id: rest.trainer_id ? Number(rest.trainer_id) : null,
      height_cm: rest.height_cm ? Number(rest.height_cm) : null,
      weight_kg: rest.weight_kg ? Number(rest.weight_kg) : null,
      bmi: rest.bmi ? Number(rest.bmi) : null,
      heart_rate: rest.heart_rate ? Number(rest.heart_rate) : null,
      blood_pressure: rest.blood_pressure || null,
      sugar_level: rest.sugar_level || null,
      emergency_contact: rest.emergency_contact || null,
      emergency_relation: rest.emergency_relation || null,
      address: rest.address || null,
      area: rest.area || null,
      pin_code: rest.pin_code || null,
      medical_issues: rest.medical_issues,
      medical_other: rest.medical_other,
      // Only include referred_by if it has a value (avoids DB error if column not yet created)
      ...(referredBy != null ? { referred_by: Number(referredBy) } : {}),
      batch:
        restWithoutReferral.batch_start_time && restWithoutReferral.batch_end_time
          ? `${restWithoutReferral.batch_start_time}-${restWithoutReferral.batch_end_time}`
          : restWithoutReferral.batch || null,
    };

    // Scoped Status Flip
    const currentStatus = member?.status;
    const todayStr = new Date().toISOString().slice(0, 10);
    // Note: normalizedPayload.end_date might be updated below, so we check after the end_date calculation

    // ── Recalculate end_date whenever package changes or joining_date changes ──
    const newVariantId = normalizedPayload.package_variant_id;
    const oldVariantId = member?.package_variant_id ? Number(member.package_variant_id) : null;
    const newJoining = normalizedPayload.joining_date;
    const today = new Date().toISOString().slice(0, 10);

    if (newVariantId) {
      // Find the variant from already-loaded packages
      let variant = null;
      for (const pkg of packages) {
        const v = (pkg.package_variants || []).find(
          (v) => Number(v.id) === newVariantId
        );
        if (v) { variant = v; break; }
      }

      if (variant && variant.pricing_type === "duration") {
        // Base calculation on TODAY if package changed, otherwise use Joining Date
        const baseDate = (newVariantId !== oldVariantId) ? new Date(today) : new Date(newJoining);
        
        let daysToAdd = 0;
        const dv = Number(variant.duration_value || 0);
        const unit = variant.duration_unit?.toLowerCase();
        if (unit === "month") {
          daysToAdd = dv * 30;   // 30-day months as per requirement
        } else if (unit === "year") {
          daysToAdd = dv * 365;
        } else if (unit === "day" || unit === "days") {
          daysToAdd = dv;
        }
        
        if (daysToAdd > 0) {
          const endDate = new Date(baseDate);
          endDate.setDate(endDate.getDate() + daysToAdd);
          normalizedPayload.end_date = endDate.toISOString().slice(0, 10);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────

    const effectiveEndDate = normalizedPayload.end_date || member?.end_date;
    if (effectiveEndDate >= todayStr && ["Inactive", "Expired", "New", "active"].includes(currentStatus)) {
      normalizedPayload.status = "Active";
    }

    const { error } = await supabase
      .from("members")
      .update(normalizedPayload)
      .eq("id", memberId);

    if (error) {
      console.error("UPDATE FAILED FULL:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      showToast(error.message, "error");
      return;
    }

    const ids = Array.isArray(add_on_ids) ? add_on_ids : [];
    const currentIds = ids.map((id) => String(id));
    try {
      // Always do manual delete+insert so we can save start_date and end_date
      await supabase.from("member_add_ons").delete().eq("member_id", memberId);

      if (ids.length > 0) {
        const rows = ids.map((id) => ({
          member_id: memberId,
          add_on_id: id,
          start_date: addOnDates[String(id)]?.start_date || null,
          end_date: addOnDates[String(id)]?.end_date || null,
        }));
        const { error: addOnErr } = await supabase.from("member_add_ons").insert(rows);
        if (addOnErr) {
          console.error("UPDATE ADD-ONS ERROR:", addOnErr);
          showToast("Member updated, but add-ons failed: " + addOnErr.message, "error");
        }
      }
    } catch (err) {
      console.error("UPDATE ADD-ONS EXCEPTION:", err);
      showToast("Member updated, but add-ons failed", "error");
    }

    // ========== PHASE 3: Improved add-on modification handling ==========
    // Get current add-ons before update to detect what changed
    const { data: currentAddOns } = await supabase
      .from("member_add_ons")
      .select("add_on_id")
      .eq("member_id", memberId);

    const currentIdsBeforeUpdate = (currentAddOns || []).map(row => String(row.add_on_id));
    const addedIds = currentIds.filter(id => !currentIdsBeforeUpdate.includes(id));
    const removedIds = currentIdsBeforeUpdate.filter(id => !currentIds.includes(id));

    // Only take action if add-ons actually changed
    if (addedIds.length > 0 || removedIds.length > 0) {
      // 1. Archive bills for REMOVED add-ons only (unpaid ones)
      if (removedIds.length > 0) {
        const { data: unpaidAddOnBills } = await supabase
          .from("bills")
          .select("id")
          .eq("member_id", memberId)
          .eq("bill_type", "add_on")
          .eq("is_current", true)
          .eq("payment_status", "unpaid");

        const unpaidIds = (unpaidAddOnBills || []).map(b => b.id);
        if (unpaidIds.length > 0) {
          await supabase
            .from("bills")
            .update({ is_current: false })
            .in("id", unpaidIds);
        }
      }

      // 2. Create bills ONLY for NEWLY added add-ons
      if (addedIds.length > 0) {
        const addedItems = addedIds.map(id => addOns.find(a => String(a.id) === String(id))).filter(Boolean);
        const newAddOnAmount = addedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        if (newAddOnAmount > 0) {
          const billDate = new Date().toISOString().slice(0, 10);
          
          // Build structured component details
          const billComponents = addedItems.map(item => ({
            type: "add_on",
            name: item.name,
            amount: Number(item.amount || 0),
            add_on_id: item.id,
          }));

          const componentsSummary = billComponents
            .map(c => `${c.name}(₹${c.amount})`)
            .join(" + ");

          const { error: billError } = await supabase.from("bills").insert({
            member_id: memberId,
            bill_type: "add_on",
            base_amount: newAddOnAmount,
            discount_amount: 0,
            amount: newAddOnAmount,
            payable_amount: newAddOnAmount,
            payment_status: "unpaid",
            billing_date: billDate,
            due_date: billDate,
            is_current: true,
            notes: `Bill Components: ${componentsSummary}`,
          });

          if (billError) {
            console.error("ADD-ON BILL CREATION ERROR:", billError);
            showToast("Member updated, but add-on bill creation failed: " + billError.message, "error");
          }
        }
      }
    }

    // Upsert referral record
    const newReferredBy = normalizedPayload.referred_by
      ? Number(normalizedPayload.referred_by)
      : null;
    if (newReferredBy) {
      // 1. Fetch current reward amount from settings
      const { data: rewardSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "referral_reward_amount")
        .single();

      const currentReward = Number(rewardSetting?.value || 0);

      // 2. Upsert referral record with dynamic amount
      const { error: refErr } = await supabase.from("referrals").upsert({
        referrer_id: newReferredBy,
        referee_id: memberId,
        reward_amount: currentReward,
        reward_applied: false,
      }, { onConflict: "referrer_id,referee_id" });

      if (refErr) {
        console.error("REFERRAL UPSERT FAILED", refErr);
      }
    } else {
      // If referrer was cleared, remove any existing referral record for this referee
      const { error: delErr } = await supabase.from("referrals").delete().eq("referee_id", memberId);
      if (delErr) {
        console.error("REFERRAL DELETE FAILED", delErr);
      }
    }

    try {
      const deps = Array.isArray(dependentsPayload) ? dependentsPayload : [];
      await supabase.from("member_dependents").delete().eq("member_id", memberId);
      
      if (deps.length > 0) {
        const depRows = deps.map(d => ({ ...d, member_id: memberId }));
        const { error: depErr } = await supabase.from("member_dependents").insert(depRows);
        if (depErr) {
          console.error("UPDATE DEPENDENTS ERROR:", depErr);
          showToast("Member updated, but dependents failed", "error");
        }
      }
    } catch (err) {
      console.error("UPDATE DEPENDENTS ERROR:", err);
      showToast("Member updated, but dependents failed", "error");
    }

    const newPackageVariantId = normalizedPayload.package_variant_id;
    const oldPackageVariantId = member?.package_variant_id
      ? Number(member.package_variant_id)
      : null;

    const newJoiningDate = normalizedPayload.joining_date;
    const oldJoiningDate = member?.joining_date ? new Date(member.joining_date).toISOString().slice(0, 10) : null;

    if (
      newPackageVariantId &&
      (newPackageVariantId !== oldPackageVariantId || newJoiningDate !== oldJoiningDate)
    ) {
      // Use joining_date if available, otherwise fallback to today
      const startDate = normalizedPayload.joining_date || new Date().toISOString().slice(0, 10);
      const { error: assignError } = await supabase.rpc(
        "assign_member_package",
        {
          p_member_id: memberId,
          p_package_variant_id: newPackageVariantId,
          p_start_date: startDate,
        }
      );

      if (assignError) {
        console.error("ASSIGN PACKAGE ERROR:", assignError);
        showToast("Failed to assign package", "error");
        return;
      }

      // Automatically create an outstanding bill for the new package
      let selectedVariant = null;
      for (const pkg of packages) {
        const v = (pkg.package_variants || []).find(v => Number(v.id) === newPackageVariantId);
        if (v) {
          selectedVariant = v;
          break;
        }
      }

      if (selectedVariant) {
          // Archive Package Bills ONLY if package changed [CONDITION 3]
          // But wait, if we are doing delta billing, we might not want to archive everything.
          // However, assign_member_package usually means a fresh start if it was a cycle change.
          // If the user just edited the price, we just want to bill the delta.

          const billPrice = Number(selectedVariant.price || 0);
          const unbilledPkg = Math.max(0, billPrice - billedPackageAmount);

          // Bills are created when payment is recorded in Fees.
      }
    }

    if (idProofFile) {
      const ext = idProofFile.name.split(".").pop();
      const fileName = `id-proof-${memberId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("id-proofs")
        .upload(fileName, idProofFile, { upsert: true });

      if (uploadError) {
        console.error("ID UPLOAD ERROR:", uploadError);
        showToast("Failed to upload ID proof, but member data was saved.", "warning");
      } else {
        const { data: urlData } = supabase.storage
          .from("id-proofs")
          .getPublicUrl(fileName);

        await supabase
          .from("members")
          .update({ id_proof_url: urlData.publicUrl })
          .eq("id", memberId);
      }
    }

    if (_photoFile) {
      const ext = _photoFile.name.split(".").pop();
      const fileName = `member-${memberId}.${ext}`;
      const uploadOptions = { upsert: true };
      if (_photoFile.type) uploadOptions.contentType = _photoFile.type;
      const { error: uploadError } = await supabase.storage
        .from("member-avatars")
        .upload(fileName, _photoFile, uploadOptions);

      if (uploadError) {
        console.error("PHOTO UPLOAD ERROR:", uploadError);
        showToast("Member updated, but photo upload failed", "warning");
      } else {
        const { data: urlData } = supabase.storage
          .from("member-avatars")
          .getPublicUrl(fileName);

        await supabase
          .from("members")
          .update({ profile_image_url: urlData.publicUrl })
          .eq("id", memberId);
      }
    }

    showToast("Member updated successfully", "success");
    navigate("/members");
    return true;
  };

  /* ================= RENDER ================= */
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
        <h1 className="text-2xl font-bold ml-2">Edit Member</h1>
      </div>
      <MemberForm
        initialData={{ 
          ...member, 
          add_on_ids: isRenew ? [] : memberAddOnIds,
          package_variant_id: isRenew ? null : member.package_variant_id
        }}
        packages={packages}
        addOns={addOns}
        trainers={trainers}
        initialDependents={memberDependents}
        initialAddOnDates={initialAddOnDates}
        packageHistory={packageHistory}
        onSubmit={submit}
        submitLabel="Update Member"
        requireIdProof={false}
        disablePostSubmitUploads={true}
      />
    </div>
  );
}
