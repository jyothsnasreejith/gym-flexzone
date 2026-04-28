import { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

/* ================= CONSTANTS ================= */

const MEMBERSHIP_DURATIONS = {
  month: [1, 2, 3, 6],
  year: [1],
};

const PT_WEEKLY_DAYS = [4, 5, 6];

const weeksByMonths = {
  1: 4,
  3: 12,
  6: 24,
};

const calculateSessions = (months, weeklyDays) =>
  weeksByMonths[months] * weeklyDays;

const createMembershipVariant = () => ({
  id: crypto.randomUUID(),
  pricing_type: "duration",
  duration_unit: "month",
  duration_value: 1,
  price: "",
  is_active: true,
  isNew: true,
});

const createPTVariant = () => ({
  id: crypto.randomUUID(),
  pricing_type: "sessions",
  duration_months: 1,
  weekly_days: 4,
  price: "",
  is_active: true,
  isNew: true,
});

/* ================= COMPONENT ================= */

const AddPackageModal = ({ mode = "add", initialData, onSave }) => {
  const { closeModal } = useModal();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("membership");
  const [memberScope, setMemberScope] = useState("individual");
  const [memberCount, setMemberCount] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState([createMembershipVariant()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [batchSlots, setBatchSlots] = useState([]);
  const [batchSlotId, setBatchSlotId] = useState("");
  const [batchStartTime, setBatchStartTime] = useState("");
  const [batchEndTime, setBatchEndTime] = useState("");
  const [isStudentOffer, setIsStudentOffer] = useState(false);
  const [offerValidFrom, setOfferValidFrom] = useState("");
  const [offerValidTo, setOfferValidTo] = useState("");

  /* ================= LOAD EDIT ================= */

  useEffect(() => {
    if (mode !== "edit" || !initialData) return;

    setTitle(initialData.title);
    setCategory(initialData.category);
    setMemberScope(initialData.member_scope);
    setMemberCount(initialData.member_count);
    setIsActive(initialData.is_active);
    setBatchSlotId(
      initialData.batch_slot_id ? String(initialData.batch_slot_id) : ""
    );
    setBatchStartTime(initialData.batch_start_time || "");
    setBatchEndTime(initialData.batch_end_time || "");
    setIsStudentOffer(initialData.is_student_offer || false);
    setOfferValidFrom(initialData.offer_valid_from || "");
    setOfferValidTo(initialData.offer_valid_to || "");

    const loadVariants = async () => {
      const { data } = await supabase
        .from("package_variants")
        .select("*")
        .eq("package_id", initialData.id);

      setVariants(
        (data || []).map(v => {
          if (v.pricing_type === "sessions") {
            return {
              ...v,
              duration_months: v.duration_value, // 🔥 critical
              isNew: false,
            };
          }

          return {
            ...v,
            isNew: false,
          };
        })
      );
    };

    loadVariants();
  }, [mode, initialData]);

  useEffect(() => {
    const loadBatchSlots = async () => {
      const { data } = await supabase
        .from("batch_slots")
        .select("id, label, start_time, end_time")
        .eq("is_active", true)
        .order("start_time");
      setBatchSlots(data || []);
    };

    loadBatchSlots();
  }, []);

  /* ================= HELPERS ================= */

  const updateVariant = (id, key, value) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [key]: value } : v))
    );
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      category === "membership"
        ? createMembershipVariant()
        : createPTVariant(),
    ]);
  };

  const deactivateVariant = (id) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, is_active: false } : v
      )
    );
  };

  const activeVariants = variants.filter(v => v.is_active !== false);

  /* ================= VALIDATION ================= */

  const validate = () => {
    if (!title.trim()) return "Package title is required";
    if (activeVariants.length === 0)
      return "At least one active variant is required";
    if (activeVariants.length >= 10) {
      return "Too many variants. Consider simplifying.";
    }

    if (category === "membership") {
      const keys = activeVariants.map(
        (v) => `${v.duration_unit}-${v.duration_value}`
      );
      if (new Set(keys).size !== keys.length)
        return "Duplicate durations are not allowed";

      if (activeVariants.some((v) => !v.price || v.price <= 0))
        return "All variants must have a valid price";
    }

    if (category === "personal_training") {
      const keys = activeVariants.map(
        v => `sessions:${v.duration_months}:${v.weekly_days}`
      );

      if (new Set(keys).size !== keys.length) {
        return "Duplicate PT variants are not allowed";
      }

      for (const v of activeVariants) {
        if (!v.duration_months) {
          return "Duration is required for personal training";
        }
        if (![4, 5, 6].includes(v.weekly_days)) {
          return "Invalid weekly days";
        }
        if (v.duration_months > 1 && v.weekly_days === 6) {
          return `6 days/week is only available for 1-month packages.`;
        }
        if (!v.price || v.price <= 0) {
          return "All variants must have a valid price";
        }
      }
    }

    return null;
  };

  /* ================= SUBMIT ================= */

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let packageId = initialData?.id;

      if (mode === "add") {
        const { data, error } = await supabase
          .from("packages")
          .insert({
            title: title.trim(),
            category,
            member_scope: memberScope,
            member_count: memberCount,
            is_active: isActive,
            batch_slot_id: batchSlotId ? Number(batchSlotId) : null,
            batch_start_time: batchStartTime || null,
            batch_end_time: batchEndTime || null,
            is_student_offer: isStudentOffer,
            offer_valid_from: isStudentOffer && offerValidFrom ? offerValidFrom : null,
            offer_valid_to: isStudentOffer && offerValidTo ? offerValidTo : null,
          })
          .select("id")
          .single();

        if (error) throw error;
        packageId = data.id;
      } else {
        await supabase
          .from("packages")
          .update({
            title: title.trim(),
            category,
            member_scope: memberScope,
            member_count: memberCount,
            is_active: isActive,
            batch_slot_id: batchSlotId ? Number(batchSlotId) : null,
            batch_start_time: batchStartTime || null,
            batch_end_time: batchEndTime || null,
            is_student_offer: isStudentOffer,
            offer_valid_from: isStudentOffer && offerValidFrom ? offerValidFrom : null,
            offer_valid_to: isStudentOffer && offerValidTo ? offerValidTo : null,
          })
          .eq("id", packageId);
      }

      for (const v of variants) {
        const payload = {
          package_id: packageId,
          pricing_type: v.pricing_type,
          price: Number(v.price),
          is_active: v.is_active,
        };

        if (category === "personal_training") {
          payload.duration_unit = null;
          payload.duration_value = v.duration_months; // UI → DB mapping
          payload.weekly_days = v.weekly_days;
          payload.sessions_total = calculateSessions(
            v.duration_months,
            v.weekly_days
          );
        } else {
          payload.duration_unit = v.duration_unit;
          payload.duration_value = v.duration_value;
          payload.weekly_days = null;
          payload.sessions_total = null;
        }

        if (v.id && !v.isNew) {
          // Update existing variant
          const { error } = await supabase
            .from("package_variants")
            .update(payload)
            .eq("id", v.id);

          if (error) {
            console.error("VARIANT UPDATE ERROR:", error);
            alert(error.message);
            throw error;
          }
        } else if (v.isNew && v.is_active) {
          // Insert new variant
          const { error } = await supabase
            .from("package_variants")
            .insert(payload);

          if (error) {
            console.error("VARIANT INSERT ERROR:", error);
            alert(error.message);
            throw error;
          }
        } else if (v.isNew && !v.is_active) {
          // This is a new variant that was added and then removed before saving. Do nothing.
        }
      }

      onSave?.();
      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save package");
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="w-full max-w-3xl max-h-[85vh] bg-card rounded-xl shadow-xl flex flex-col">
      <form onSubmit={submit} className="flex flex-col h-full">
        {/* HEADER */}
        <div className="px-5 pt-4 pb-3 border-b">
          <h2 className="text-lg font-semibold">
            {mode === "edit" ? "Edit Package" : "Add Package"}
          </h2>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* BASIC INFO */}
          <input
            className="border rounded-md px-3 py-1.5 text-sm w-full bg-card text-white"
            placeholder="Package Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <select
              value={category}
              onChange={(e) => {
                const newCategory = e.target.value;
                setCategory(newCategory);
                setVariants([
                  newCategory === "membership"
                    ? createMembershipVariant()
                    : createPTVariant(),
                ]);
              }}
              className="w-full border rounded-md px-3 py-2 bg-card text-white"
            >
              <option value="membership">Membership</option>
              <option value="personal_training">Personal Training</option>
            </select>

            <select
              value={memberScope}
              onChange={(e) => {
                const scope = e.target.value;
                setMemberScope(scope);
                setMemberCount(scope === "family" ? 3 : scope === "couple" ? 2 : 1);
              }}
              className="w-full border rounded-md px-3 py-2 bg-card text-white"
            >
              <option value="individual">Individual</option>
              <option value="couple">Couple</option>
              <option value="family">Family (3 members)</option>
            </select>
          </div>

          {/* STUDENT OFFER */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="studentOffer"
              checked={isStudentOffer}
              onChange={e => setIsStudentOffer(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="studentOffer" className="text-sm font-medium text-white">
              Mark as Students Offer
            </label>
          </div>

          {isStudentOffer && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white mb-1 block">Valid From</label>
                <input
                  type="date"
                  value={offerValidFrom}
                  onChange={e => setOfferValidFrom(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm w-full bg-card text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white mb-1 block">Valid To</label>
                <input
                  type="date"
                  value={offerValidTo}
                  onChange={e => setOfferValidTo(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm w-full bg-card text-white"
                />
              </div>
            </div>
          )}

          {/* DEFAULT BATCH */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-white uppercase tracking-wide">
              Default Batch (Optional)
            </div>

            <select
              value={batchSlotId}
              onChange={(e) => {
                const id = e.target.value;
                const slot = batchSlots.find(
                  (s) => String(s.id) === String(id)
                );
                setBatchSlotId(id);
                setBatchStartTime(slot?.start_time || "");
                setBatchEndTime(slot?.end_time || "");
              }}
              className="w-full border rounded-md px-3 py-2 text-sm bg-card text-white"
            >
              <option value="">Select preset (optional)</option>
              {batchSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="time"
                value={batchStartTime}
                onChange={(e) => setBatchStartTime(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-card text-white"
                placeholder="Start Time"
              />
              <input
                type="time"
                value={batchEndTime}
                onChange={(e) => setBatchEndTime(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-card text-white"
                placeholder="End Time"
              />
            </div>
          </div>

          {/* VARIANTS */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-white uppercase tracking-wide">
              Variants
            </div>

            <div className="border rounded-lg bg-card max-h-[320px] overflow-y-auto">
              {(showAllVariants ? activeVariants : activeVariants.slice(0, 3)).map((v) => (
                <div key={v.id} className="grid grid-cols-[140px_170px_120px_90px] gap-3 items-center px-4 py-2">
                  {category === "membership" ? (
                    <>
                      <select
                        value={v.duration_unit}
                        onChange={e => {
                          const newUnit = e.target.value;
                          const resetValue = MEMBERSHIP_DURATIONS[newUnit][0];
                          setVariants(prev =>
                            prev.map(variant =>
                              variant.id === v.id
                                ? { ...variant, duration_unit: newUnit, duration_value: resetValue }
                                : variant
                            )
                          );
                        }}
                        className="w-full px-3 pr-9 h-9 text-sm truncate text-gray-800"
                      >
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                      </select>

                      <select
                        value={v.duration_value}
                        onChange={e =>
                          updateVariant(v.id, "duration_value", Number(e.target.value))
                        }
                        className="w-full px-3 pr-9 h-9 text-sm truncate text-gray-800"
                      >
                        {MEMBERSHIP_DURATIONS[v.duration_unit].map(d => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <select
                        value={v.duration_months}
                        onChange={(e) => {
                          const newMonths = Number(e.target.value);
                          if (newMonths > 1 && v.weekly_days === 6) {
                            updateVariant(v.id, "weekly_days", 5);
                          }
                          updateVariant(v.id, "duration_months", newMonths);
                        }}
                        className="w-full px-3 pr-9 h-9 text-sm truncate text-gray-800"
                      >
                        <option value={1}>1 Month</option>
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                      </select>

                      <select
                        value={v.weekly_days}
                        onChange={(e) =>
                          updateVariant(v.id, "weekly_days", Number(e.target.value))
                        }
                        className="w-full px-3 pr-9 h-9 text-sm truncate text-gray-800"
                      >
                        <option value={4}>4 days/week</option>
                        <option value={5}>5 days/week</option>
                        <option value={6} disabled={v.duration_months > 1}>
                          6 days/week
                        </option>
                      </select>
                    </>
                  )}

                  <input
                    type="number"
                    placeholder="Price"
                    value={v.price}
                    onChange={e =>
                      updateVariant(v.id, "price", Number(e.target.value))
                    }
                    className="w-full h-9 px-3 text-sm bg-card text-white"
                  />

                  <button
                    type="button"
                    onClick={() => deactivateVariant(v.id)}
                    className="text-red-400 text-sm whitespace-nowrap"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="p-2">
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-xs text-primary"
                >
                  + Add Variant
                </button>
              </div>
            </div>

            {activeVariants.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllVariants(v => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showAllVariants
                  ? "Show fewer variants"
                  : `Show all ${activeVariants.length} variants`}
              </button>
            )}
          </div>
        </div>

        {/* FIXED FOOTER */}
        <div className="h-16 px-6 border-t flex items-center justify-end gap-3 bg-card">
          <button
            type="button"
            onClick={closeModal}
            className="h-10 px-4 rounded-lg border text-sm"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 rounded-lg bg-primary text-white text-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Package"}
          </button>
        </div>
      </form>
    </div>
  </div>
  );
};
export default AddPackageModal;
