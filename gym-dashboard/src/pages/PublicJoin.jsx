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
  const [debugData, setDebugData] = useState({
    payload: null,
    uploadInfo: {},
    errors: [],
    member: null,
  });

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
    
    // Initialize debug storage
    const uploadDebugInfo = {
      idProof: { attempts: [], errors: [], success: false, url: null, rpcError: null },
      profilePhoto: { attempts: [], errors: [], success: false, url: null, rpcError: null },
    };
    const debugErrors = [];

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

      // Helper: Compress image before upload (for both avatars and ID proofs if images)
      const compressImage = async (file) => {
        if (!file.type?.startsWith("image/")) {
          return file;
        }
        
        return new Promise((resolve) => {
          const img = new Image();
          const canvas = document.createElement("canvas");
          
          img.onload = () => {
            try {
              // Reduce dimensions: max 1200px
              const maxDim = 1200;
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
              const width = Math.round(img.width * scale);
              const height = Math.round(img.height * scale);
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(file);
                return;
              }
              
              ctx.drawImage(img, 0, 0, width, height);
              
              // Convert to JPEG with 80% quality for smaller file size
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    resolve(file);
                    return;
                  }
                  
                  const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  
                  resolve(compressed);
                },
                "image/jpeg",
                0.8
              );
            } catch (err) {
              resolve(file);
            }
          };
          
          img.onerror = () => {
            resolve(file);
          };
          
          img.src = URL.createObjectURL(file);
        });
      };

      // Upload ID Proof with retry logic and compression
      if (idProofFile) {
        try {
          let uploadFile = idProofFile;
          const fileInfo = {
            name: idProofFile.name,
            size: `${(idProofFile.size / 1024 / 1024).toFixed(2)}MB`,
            type: idProofFile.type,
          };
          uploadDebugInfo.idProof.originalFile = fileInfo;
          
          // Compress if image
          if (idProofFile.type?.startsWith("image/")) {
            uploadFile = await compressImage(idProofFile);
            const compressedInfo = {
              newSize: `${(uploadFile.size / 1024 / 1024).toFixed(2)}MB`,
              newType: uploadFile.type,
            };
            uploadDebugInfo.idProof.compressed = compressedInfo;
          } else {
            uploadDebugInfo.idProof.compressed = { skipped: true, reason: "not-image" };
          }
          
          const ext = uploadFile.name.split(".").pop();
          const fileName = `id-proof-${member.id}.${ext}`;

          // Upload with explicit retry
          let uploadError = null;
          let uploadSuccess = false;
          let retries = 3;
          let attemptCount = 0;
          
          while (retries > 0) {
            attemptCount++;
            
            try {
              const result = await supabase.storage
                .from("id-proofs")
                .upload(fileName, uploadFile, { upsert: true });
              
              const apiResponse = {
                hasError: !!result.error,
                hasData: !!result.data,
                error: result.error ? {
                  message: result.error.message,
                  code: result.error.code,
                  status: result.error.status,
                } : null,
              };
              uploadDebugInfo.idProof.attempts.push({ attempt: attemptCount, response: apiResponse });
              
              if (!result.error) {
                uploadError = null;
                uploadSuccess = true;
                break;
              }
              
              uploadError = result.error;
              retries--;
              uploadDebugInfo.idProof.errors.push(uploadError);
              
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (catchErr) {
              uploadError = catchErr;
              retries--;
              uploadDebugInfo.idProof.errors.push({ catchError: catchErr.message });
              debugErrors.push({ type: "ID_PROOF_CATCH", error: catchErr.message });
              
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (!uploadError && uploadSuccess) {
            const { data: urlData } = supabase.storage
              .from("id-proofs")
              .getPublicUrl(fileName);

            uploadDebugInfo.idProof.url = urlData.publicUrl;

            const { error: rpcError, data: rpcData } = await supabase.rpc(
              "update_member_images",
              {
                p_member_id: member.id,
                p_id_proof_url: urlData.publicUrl,
              }
            );

            const rpcResponse = {
              hasError: !!rpcError,
              hasData: !!rpcData,
              error: rpcError ? {
                message: rpcError.message,
                code: rpcError.code,
                status: rpcError.status,
              } : null,
              data: rpcData,
            };
            uploadDebugInfo.idProof.rpcResponse = rpcResponse;

            if (rpcError) {
              uploadDebugInfo.idProof.rpcError = rpcError;
              uploadDebugInfo.idProof.success = false;
              debugErrors.push({ type: "ID_PROOF_RPC", error: rpcError?.message, code: rpcError?.code });
            } else {
              uploadDebugInfo.idProof.success = true;
            }
          } else {
            uploadDebugInfo.idProof.success = false;
            if (uploadError) {
              debugErrors.push({ type: "ID_PROOF_UPLOAD", error: uploadError?.message || "Unknown error" });
            }
          }
        } catch (err) {
          uploadDebugInfo.idProof.success = false;
          debugErrors.push({ type: "ID_PROOF_EXCEPTION", error: err.message });
        }
      } else {
        uploadDebugInfo.idProof.skipped = true;
      }

      // Upload Profile Photo with retry logic and aggressive compression
      if (photoFile) {
        try {
          let uploadFile = photoFile;
          const fileInfo = {
            name: photoFile.name,
            size: `${(photoFile.size / 1024 / 1024).toFixed(2)}MB`,
            type: photoFile.type,
          };
          uploadDebugInfo.profilePhoto.originalFile = fileInfo;
          
          // Always compress profile photos aggressively
          uploadFile = await compressImage(photoFile);
          const compressedInfo = {
            newSize: `${(uploadFile.size / 1024 / 1024).toFixed(2)}MB`,
            newType: uploadFile.type,
          };
          uploadDebugInfo.profilePhoto.compressed = compressedInfo;

          const ext = uploadFile.name.split(".").pop();
          const fileName = `member-${member.id}.${ext}`;

          // Upload with explicit retry
          let uploadError = null;
          let uploadSuccess = false;
          let retries = 3;
          let attemptCount = 0;
          
          while (retries > 0) {
            attemptCount++;
            
            try {
              const result = await supabase.storage
                .from("member-avatars")
                .upload(fileName, uploadFile, { upsert: true });
              
              const apiResponse = {
                hasError: !!result.error,
                hasData: !!result.data,
                error: result.error ? {
                  message: result.error.message,
                  code: result.error.code,
                  status: result.error.status,
                } : null,
              };
              uploadDebugInfo.profilePhoto.attempts.push({ attempt: attemptCount, response: apiResponse });
              
              if (!result.error) {
                uploadError = null;
                uploadSuccess = true;
                break;
              }
              
              uploadError = result.error;
              retries--;
              uploadDebugInfo.profilePhoto.errors.push(uploadError);
              
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (catchErr) {
              uploadError = catchErr;
              retries--;
              uploadDebugInfo.profilePhoto.errors.push({ catchError: catchErr.message });
              debugErrors.push({ type: "PROFILE_CATCH", error: catchErr.message });
              
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (!uploadError && uploadSuccess) {
            const { data: urlData } = supabase.storage
              .from("member-avatars")
              .getPublicUrl(fileName);

            uploadDebugInfo.profilePhoto.url = urlData.publicUrl;

            const { error: rpcError, data: rpcData } = await supabase.rpc(
              "update_member_images",
              {
                p_member_id: member.id,
                p_profile_image_url: urlData.publicUrl,
              }
            );

            const rpcResponse = {
              hasError: !!rpcError,
              hasData: !!rpcData,
              error: rpcError ? {
                message: rpcError.message,
                code: rpcError.code,
                status: rpcError.status,
              } : null,
              data: rpcData,
            };
            uploadDebugInfo.profilePhoto.rpcResponse = rpcResponse;

            if (rpcError) {
              uploadDebugInfo.profilePhoto.rpcError = rpcError;
              uploadDebugInfo.profilePhoto.success = false;
              debugErrors.push({ type: "PROFILE_RPC", error: rpcError?.message, code: rpcError?.code });
            } else {
              uploadDebugInfo.profilePhoto.success = true;
            }
          } else {
            uploadDebugInfo.profilePhoto.success = false;
            if (uploadError) {
              debugErrors.push({ type: "PROFILE_UPLOAD", error: uploadError?.message || "Unknown error" });
            }
          }
        } catch (err) {
          uploadDebugInfo.profilePhoto.success = false;
          debugErrors.push({ type: "PROFILE_EXCEPTION", error: err.message });
        }
      } else {
        uploadDebugInfo.profilePhoto.skipped = true;
      }

      setSubmitted(true);
      setDebugData({
        payload,
        uploadInfo: uploadDebugInfo,
        errors: debugErrors,
        member: member,
      });
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
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Thank You Section */}
          <div className="bg-card rounded-2xl shadow p-6 text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <h2 className="text-2xl font-bold text-primary">
              Thank you for registering!
            </h2>
            <p className="text-sm text-secondary">
              Our team will contact you shortly.
            </p>
          </div>

          {/* Member ID */}
          {debugData.member && (
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-secondary mb-2">Member ID</p>
              <p className="font-mono text-sm break-all text-primary">{debugData.member.id}</p>
            </div>
          )}

          {/* Upload Status Summary */}
          <div className="bg-card rounded-lg p-4 border border-border space-y-2">
            <h3 className="font-semibold text-sm text-primary">📤 Upload Status</h3>
            
            <div className="space-y-2 text-xs">
              {/* ID Proof */}
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">
                  {debugData.uploadInfo.idProof?.skipped ? "⏭️" : 
                   debugData.uploadInfo.idProof?.success ? "✅" : "❌"}
                </span>
                <div className="flex-1">
                  <p className="font-mono font-semibold">ID Proof</p>
                  {debugData.uploadInfo.idProof?.originalFile && (
                    <p className="text-secondary">{debugData.uploadInfo.idProof.originalFile.name} ({debugData.uploadInfo.idProof.originalFile.size})</p>
                  )}
                  {debugData.uploadInfo.idProof?.compressed && !debugData.uploadInfo.idProof?.compressed?.skipped && (
                    <p className="text-secondary">→ {debugData.uploadInfo.idProof.compressed.newSize}</p>
                  )}
                  {debugData.uploadInfo.idProof?.url && (
                    <p className="text-green-600 text-xs break-all">URL: {debugData.uploadInfo.idProof.url.substring(0, 60)}...</p>
                  )}
                </div>
              </div>

              {/* Profile Photo */}
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">
                  {debugData.uploadInfo.profilePhoto?.skipped ? "⏭️" : 
                   debugData.uploadInfo.profilePhoto?.success ? "✅" : "❌"}
                </span>
                <div className="flex-1">
                  <p className="font-mono font-semibold">Profile Photo</p>
                  {debugData.uploadInfo.profilePhoto?.originalFile && (
                    <p className="text-secondary">{debugData.uploadInfo.profilePhoto.originalFile.name} ({debugData.uploadInfo.profilePhoto.originalFile.size})</p>
                  )}
                  {debugData.uploadInfo.profilePhoto?.compressed && (
                    <p className="text-secondary">→ {debugData.uploadInfo.profilePhoto.compressed.newSize}</p>
                  )}
                  {debugData.uploadInfo.profilePhoto?.url && (
                    <p className="text-green-600 text-xs break-all">URL: {debugData.uploadInfo.profilePhoto.url.substring(0, 60)}...</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Details (if any) */}
          {debugData.errors.length > 0 && (
            <div className="bg-card rounded-lg p-4 border border-red-500/30 space-y-2">
              <h3 className="font-semibold text-sm text-red-600">❌ Errors Encountered</h3>
              <div className="space-y-2 text-xs font-mono">
                {debugData.errors.map((err, idx) => (
                  <div key={idx} className="bg-background rounded p-2 text-red-500">
                    <p className="font-semibold">{err.type}</p>
                    <p className="break-words">{err.error}</p>
                    {err.code && <p className="text-red-600">Code: {err.code}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID Proof Upload Details */}
          {debugData.uploadInfo.idProof?.attempts.length > 0 && (
            <div className="bg-card rounded-lg p-4 border border-border space-y-2">
              <h3 className="font-semibold text-sm text-primary">📄 ID Proof Upload Attempts</h3>
              <div className="space-y-2">
                {debugData.uploadInfo.idProof.attempts.map((attempt, idx) => (
                  <div key={idx} className="bg-background rounded p-2 text-xs">
                    <p className="font-semibold text-secondary">Attempt {attempt.attempt}</p>
                    <p className="font-mono text-primary">
                      {attempt.response.hasError ? "❌ Error" : "✅ Success"}
                    </p>
                    {attempt.response.error && (
                      <div className="text-red-500 mt-1 break-words">
                        <p>{attempt.response.error.message}</p>
                        <p className="text-xs">Code: {attempt.response.error.code} (Status: {attempt.response.error.status})</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {debugData.uploadInfo.idProof?.rpcResponse && (
                <div className="bg-background rounded p-2 text-xs mt-2">
                  <p className="font-semibold text-secondary">RPC Update</p>
                  <p className="font-mono text-primary">
                    {debugData.uploadInfo.idProof.rpcResponse.hasError ? "❌ Error" : "✅ Success"}
                  </p>
                  {debugData.uploadInfo.idProof.rpcResponse.error && (
                    <div className="text-red-500 mt-1 break-words">
                      <p>{debugData.uploadInfo.idProof.rpcResponse.error.message}</p>
                      <p className="text-xs">Code: {debugData.uploadInfo.idProof.rpcResponse.error.code}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Profile Photo Upload Details */}
          {debugData.uploadInfo.profilePhoto?.attempts.length > 0 && (
            <div className="bg-card rounded-lg p-4 border border-border space-y-2">
              <h3 className="font-semibold text-sm text-primary">📸 Profile Photo Upload Attempts</h3>
              <div className="space-y-2">
                {debugData.uploadInfo.profilePhoto.attempts.map((attempt, idx) => (
                  <div key={idx} className="bg-background rounded p-2 text-xs">
                    <p className="font-semibold text-secondary">Attempt {attempt.attempt}</p>
                    <p className="font-mono text-primary">
                      {attempt.response.hasError ? "❌ Error" : "✅ Success"}
                    </p>
                    {attempt.response.error && (
                      <div className="text-red-500 mt-1 break-words">
                        <p>{attempt.response.error.message}</p>
                        <p className="text-xs">Code: {attempt.response.error.code} (Status: {attempt.response.error.status})</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {debugData.uploadInfo.profilePhoto?.rpcResponse && (
                <div className="bg-background rounded p-2 text-xs mt-2">
                  <p className="font-semibold text-secondary">RPC Update</p>
                  <p className="font-mono text-primary">
                    {debugData.uploadInfo.profilePhoto.rpcResponse.hasError ? "❌ Error" : "✅ Success"}
                  </p>
                  {debugData.uploadInfo.profilePhoto.rpcResponse.error && (
                    <div className="text-red-500 mt-1 break-words">
                      <p>{debugData.uploadInfo.profilePhoto.rpcResponse.error.message}</p>
                      <p className="text-xs">Code: {debugData.uploadInfo.profilePhoto.rpcResponse.error.code}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Member Registration Data */}
          {debugData.payload && (
            <details className="bg-card rounded-lg p-4 border border-border">
              <summary className="font-semibold text-sm text-primary cursor-pointer hover:text-accent">
                📋 Registration Data (tap to expand)
              </summary>
              <pre className="mt-3 text-xs font-mono overflow-auto bg-background rounded p-3 text-secondary max-h-96">
                {JSON.stringify(debugData.payload, null, 2)}
              </pre>
            </details>
          )}

          {/* Instructions */}
          <div className="bg-card rounded-lg p-4 border border-border space-y-2">
            <h3 className="font-semibold text-sm text-primary">🔍 Debugging Tips</h3>
            <ul className="text-xs text-secondary space-y-1 list-disc list-inside">
              <li>✅ = Success, ❌ = Error, ⏭️ = Skipped</li>
              <li>Check "Upload Status" for which step failed</li>
              <li>Red error codes indicate the exact issue</li>
              <li>Open DevTools Console (F12) to see detailed logs</li>
              <li>Share error codes with support team</li>
            </ul>
          </div>

          <p className="text-xs text-secondary text-center pt-2">
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
