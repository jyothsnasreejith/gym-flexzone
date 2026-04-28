import { useEffect, useState } from "react";
import MemberForm from "../components/MemberForm";
import { supabase } from "../supabaseClient";

export default function PublicJoin() {
  const [submitted, setSubmitted] = useState(false);
  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* =====================
     LOAD PACKAGES ONLY
     (NO TRAINERS — PUBLIC PAGE)
  ===================== */
  useEffect(() => {
    const loadPackages = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("packages")
        .select(`
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
            is_active,
            packages ( is_student_offer )
          )
        `)
        .eq("is_active", true)
        .eq("package_variants.is_active", true)
        .order("display_order", { ascending: true });

      if (!error) {
        setPackages(data || []);
      } else {
        const fallback = await supabase
          .from("packages")
          .select(`
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
              is_active,
              packages ( is_student_offer )
            )
          `)
          .eq("is_active", true)
          .eq("package_variants.is_active", true)
          .order("display_order", { ascending: true });

        if (fallback.error) {
          console.error("LOAD PACKAGES ERROR:", error);
          setPackages([]);
        } else {
          setPackages(fallback.data || []);
        }
      }

      setLoading(false);
    };

    loadPackages();
  }, []);

  useEffect(() => {
    const loadAddOns = async () => {
      try {
        const { data, error } = await supabase
          .from("add_ons")
          .select("id, name, duration_value, duration_unit, amount, is_active")
          .eq("is_active", true)
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

  /* =====================
     SUBMIT JOIN REQUEST
  ===================== */
  const submit = async (form, idProofFile, photoFile, dependents = [], addOnDates = {}) => {
    if (submitting) return null;
    setSubmitting(true);
    setError("");

    try {
      const package_variant_id = form.package_variant_id ?? null;
      const addOnIds = Array.isArray(form.add_on_ids) ? form.add_on_ids : [];
      const addOnTotalValue = addOnIds.reduce((sum, id) => {
        const match = addOns.find((a) => String(a.id) === String(id));
        return sum + Number(match?.amount || 0);
      }, 0);

      if (!package_variant_id && addOnIds.length === 0) {
        setError("Please select a package or at least one add-on before joining.");
        return;
      }

      const package_id = form.package_id ?? null;
      const package_price = form.package_price ?? 0;
      const discount = form.discount_amount ?? form.discount ?? 0;
      const paid_amount = form.paid_amount ?? 0;

      const price = Number(package_price);
      const discountValue = Number(discount || 0);
      const final_amount = (price + addOnTotalValue) - discountValue;
      const paid = Number(paid_amount || 0);

      let payment_status = "unpaid";

      const payload = {
        full_name: form.full_name?.trim(),
        phone: form.phone?.trim(),
        email: form.email || null,
        gender: form.gender || null,
        dob: form.dob || null,
        joining_date: form.joining_date || new Date().toISOString().slice(0, 10),
        address: form.address || null,
        area: form.area || null,
        district: form.district || null,
        pin_code: form.pin_code || null,
        emergency_contact: form.emergency_contact || null,
        emergency_relation: form.emergency_relation || null,
        medical_issues: form.medical_issues,
        medical_other: form.medical_other,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        bmi: form.bmi ? Number(form.bmi) : null,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
        blood_pressure: form.blood_pressure || null,
        sugar_level: form.sugar_level || null,
        package_id: package_id ? Number(package_id) : null,
        package_variant_id: package_variant_id ? Number(package_variant_id) : null,
        batch_slot_id: form.batch_slot_id ? Number(form.batch_slot_id) : null,
        batch_start_time: form.batch_start_time || null,
        batch_end_time: form.batch_end_time || null,
        batch: form.batch_start_time && form.batch_end_time ? `${form.batch_start_time}-${form.batch_end_time}` : null,
        trainer_id: null,
        status: "New",
        payment_mode: form.payment_mode,
        payment_claimed: form.payment_claimed,
        payment_reference: form.payment_reference || null,
        package_price: price || null,
        final_amount,
        paid_amount: paid,
        payment_status,
        pricing_snapshot: form.pricing_snapshot,
        id_proof_type: form.id_proof_type || null,
        terms_accepted: form.terms_accepted,
        coupon_id: form.coupon_id || null,
        is_deleted: false,
        deleted_at: null,
      };

      const { data: member, error } = await supabase
        .from("members")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("JOIN ERROR:", error);
        alert(error.message);
        return null;
      }

      if (addOnIds.length > 0) {
        try {
          const rows = addOnIds.map((id) => ({
            member_id: member.id,
            add_on_id: id,
            start_date: addOnDates[String(id)]?.start_date || null,
            end_date: addOnDates[String(id)]?.end_date || null,
          }));
          const { error: manualErr } = await supabase.from("member_add_ons").insert(rows);
          if (manualErr) {
            console.error("Failed to attach add-ons:", manualErr);
          }
        } catch (err) {
          console.error("PublicJoin add-on saving exception:", err);
        }
      }

      if (member) {
        const deps = Array.isArray(dependents) ? dependents : [];
        const { error: depErr } = await supabase.rpc("replace_member_dependents", {
          p_member_id: member.id,
          p_dependents: deps,
        });

        if (depErr) {
          console.error("DEPENDENTS SAVE ERROR:", depErr);
        }
      }

      // =====================
      // AUTO-CREATE CONSOLIDATED BILL
      // =====================
      const addOnNames = [];
      if (addOnIds.length > 0) {
        addOnIds.forEach((id) => {
          const match = addOns.find((a) => String(a.id) === String(id));
          if (match) addOnNames.push(match.name);
        });
      }

      const totalBaseAmount = price + (addOnTotalValue || 0);
      const totalPayableAmount = totalBaseAmount - discountValue;
      const addOnNotes = addOnNames.length > 0 ? ` + Add-ons: ${addOnNames.join(", ")}` : "";

      // Create bill even if no package — add-on only members need a bill too
      const shouldCreateBill = package_id || addOnIds.length > 0;
      if (shouldCreateBill) {
        const pkgTitle = packages.find(p => Number(p.id) === Number(package_id))?.title || "Package";

        const billPayload = {
          member_id: member.id,
          package_id: package_id ? Number(package_id) : null,
          package_variant_id: package_id ? payload.package_variant_id : null,
          bill_type: addOnIds.length > 0 && !package_id ? "add_on" : "package",
          base_amount: totalBaseAmount,
          discount_amount: discountValue,
          amount: 0, // No payment recorded here usually
          payable_amount: totalPayableAmount,
          billing_date: new Date().toISOString().slice(0, 10),
          due_date: new Date().toISOString().slice(0, 10), // Default due date to today
          payment_mode: form.payment_mode || null,
          payment_status,
          is_current: true,
          notes: form.payment_claimed
            ? `UPI/Cash payment claimed. ${pkgTitle}${addOnNotes}`
            : `Auto-generated: ${pkgTitle}${addOnNotes}`,
        };

        const { error: billErr } = await supabase
          .from("bills")
          .insert(billPayload);

        if (billErr) {
          console.error("Failed to auto-create consolidated bill:", billErr);
        }
      }

      if (idProofFile) {
        const ext = idProofFile.name.split(".").pop();
        const fileName = `id-proof-${member.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("id-proofs")
          .upload(fileName, idProofFile, { upsert: true });

        if (uploadError) {
          console.error("ID UPLOAD ERROR:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("id-proofs")
            .getPublicUrl(fileName);

          await supabase
            .from("members")
            .update({ id_proof_url: urlData.publicUrl })
            .eq("id", member.id);
        }
      }

      if (photoFile) {
        console.log("🔍 PHOTO UPLOAD DEBUG:", {
          photoFile: photoFile ? { name: photoFile.name, size: photoFile.size, type: photoFile.type } : null,
          memberId: member.id,
        });

        const ext = photoFile.name.split(".").pop();
        const fileName = `member-${member.id}.${ext}`;
        console.log("📤 Uploading to storage:", { fileName, bucketName: "member-avatars" });

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("member-avatars")
          .upload(fileName, photoFile, { upsert: true });

        console.log("📤 Storage upload result:", { uploadError, uploadData });

        if (uploadError) {
          console.error("❌ PROFILE PHOTO UPLOAD ERROR:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("member-avatars")
            .getPublicUrl(fileName);

          console.log("🔗 Public URL retrieved:", { publicUrl: urlData.publicUrl });

          const { error: updateError, data: updateData } = await supabase
            .from("members")
            .update({ profile_image_url: urlData.publicUrl })
            .eq("id", member.id);

          console.log("💾 Database update result:", { updateError, updateData });
        }
      } else {
        console.log("⚠️ photoFile is null/undefined, skipping upload");
      }

      setSubmitted(true);
      return member;
    } finally {
      setSubmitting(false);
    }
  };

  /* =====================
     UI STATES
  ===================== */
  if (loading) {
    return <div className="p-6 text-secondary">Loading…</div>;
  }

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card rounded-2xl shadow p-6 text-center space-y-4">
          <div className="text-4xl">🎉</div>

          <h2 className="text-2xl font-bold">
            Thank you for registering!
          </h2>

          <p className="text-sm text-secondary">
            Our team will contact you shortly.
          </p>

          <p className="text-xs text-gray-400">
            You may safely close this page.
          </p>
        </div>
      </div>
    );
  }

  /* =====================
     FORM
  ===================== */
  return (
    <div className="space-y-4">
      {error && (
        <div className="max-w-5xl mx-auto px-4 text-sm text-red-600">
          {error}
        </div>
      )}
      <MemberForm
        title="Join Our Gym"
        packages={packages}
        addOns={addOns}
        showTrainerSelect={false} // 🔒 CRITICAL
        enableUpiPayment={true}
        enableCashPayment={true}
        requireIdProof={false}
        requireTermsAcceptance={true}
        requireEmail={false}
        onSubmit={submit}
        submitLabel="Submit Registration"
        submitDisabled={submitting}
        requirePackageSelection={true}
        mode="public"
      />
    </div>
  );
}
