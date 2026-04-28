import { useState } from "react";
import { supabase } from "../supabaseClient";
import MemberForm from "../components/MemberForm";
import { useToast } from "../context/ToastContext";

export default function PublicMembers() {
  const { showToast } = useToast();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [member, setMember] = useState(null);

  const isValidPhone = (p) => /^\d{10}$/.test(p);

  const searchMember = async () => {
    setError("");
    setSuccess("");
    setMember(null);

    if (!isValidPhone(phone)) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_member_by_phone",
        { p_phone: phone }
      );

      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("No member found with this phone number.");
        return;
      }

      setMember(row);
    } catch (err) {
      console.error("Public member lookup failed:", err);
      setError("Failed to find member. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const uploadPublicFile = async (bucket, file, fileName) => {
    if (!file) return null;
    const uploadOptions = { upsert: true };
    if (file.type) uploadOptions.contentType = file.type;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, uploadOptions);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async (payload, idProofFile, photoFile) => {
    if (!member) return null;
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const memberId = member.id;

      let profileUrl = payload.profile_image_url || member.profile_image_url || null;
      let idProofUrl = payload.id_proof_url || member.id_proof_url || null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const fileName = `member-${memberId}.${ext}`;
        profileUrl = await uploadPublicFile("member-avatars", photoFile, fileName);
      }

      if (idProofFile) {
        const ext = idProofFile.name.split(".").pop();
        const fileName = `id-proof-${memberId}.${ext}`;
        idProofUrl = await uploadPublicFile("id-proofs", idProofFile, fileName);
      }

      const { error: updateError } = await supabase.rpc(
        "update_member_by_phone",
        {
          p_phone: member.phone,
          p_full_name: payload.full_name,
          p_email: payload.email,
          p_gender: payload.gender,
          p_dob: payload.dob,
          p_address: payload.address,
          p_area: payload.area,
          p_district: payload.district,
          p_pin_code: payload.pin_code,
          p_emergency_contact: payload.emergency_contact,
          p_emergency_relation: payload.emergency_relation,
          p_height_cm: payload.height_cm,
          p_weight_kg: payload.weight_kg,
          p_bmi: payload.bmi,
          p_heart_rate: payload.heart_rate,
          p_blood_pressure: payload.blood_pressure,
          p_sugar_level: payload.sugar_level,
          p_medical_issues: payload.medical_issues,
          p_medical_other: payload.medical_other,
          p_profile_image_url: profileUrl,
          p_id_proof_type: payload.id_proof_type,
          p_id_proof_url: idProofUrl,
          p_batch_slot_id: payload.batch_slot_id,
          p_batch_start_time: payload.batch_start_time,
          p_batch_end_time: payload.batch_end_time,
        }
      );

      if (updateError) throw updateError;

      setMember((prev) => ({
        ...prev,
        ...payload,
        profile_image_url: profileUrl,
        id_proof_url: idProofUrl,
      }));

      setSuccess("Profile updated successfully.");
      showToast("Profile updated successfully", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return { id: memberId };
    } catch (err) {
      console.error("Public member update failed:", err);
      const message = err?.message || "Failed to update profile. Please try again.";
      setError(message);
      showToast(message, "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy px-4 py-8 md:py-12 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Search Card */}
        <div className={`bg-card rounded-3xl shadow-xl shadow-blue-500/5 border border-secondary-blue/50 p-6 md:p-10 transition-all duration-300 ${!member ? "translate-y-12 md:translate-y-24" : "translate-y-0"}`}>
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 border border-secondary-blue">
              <span className="material-symbols-outlined text-4xl text-blue-600">person_search</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">My Profile</h1>
            <p className="text-secondary max-w-sm leading-relaxed">
              Enter the 10-digit mobile number used during registration to access your profile.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                phone_iphone
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="00000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-700/30 rounded-2xl focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-lg font-medium tracking-widest placeholder:tracking-normal placeholder:font-normal"
              />
            </div>

            <button
              type="button"
              onClick={searchMember}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-lg shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">search</span>
                  Access Profile
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-xl">error</span>
              <span className="text-sm font-semibold">{error}</span>
            </div>
          )}
        </div>

        {/* Member Result/Form */}
        {member && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="bg-card rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-700/30 overflow-hidden">
              <div className="bg-slate-50/50 border-b border-slate-700/30 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-inner">
                    {member.full_name?.charAt(0) || "M"}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">{member.full_name}</h2>
                    <p className="text-sm text-secondary">{member.phone}</p>
                  </div>
                </div>
                {saving && (
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-bold">
                    <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    Saving...
                  </div>
                )}
              </div>

              <div className="p-2 md:p-6 pb-12">
                <MemberForm
                  title="Update Details"
                  initialData={member}
                  packages={[]}
                  trainers={[]}
                  onSubmit={handleSave}
                  submitLabel="Update Profile"
                  showTrainerSelect={false}
                  showPackageSection={false}
                  requirePackageSelection={false}
                  enableUpiPayment={false}
                  enableCashPayment={false}
                  requireIdProof={true}
                  requireTermsAcceptance={false}
                  disablePostSubmitUploads={true}
                  submitDisabled={saving}
                  mode="public_edit"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
