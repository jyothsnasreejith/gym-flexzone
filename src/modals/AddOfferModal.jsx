import { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

const DISCOUNT_TYPES = [
  { label: "Percentage (%)", value: "percent" },
  { label: "Flat Amount (?)", value: "flat" },
];

export default function AddOfferModal({
  mode = "add",
  initialData = {},
  onSave,
}) {
  const { closeModal } = useModal();

  const [form, setForm] = useState({
    title: initialData.title || "",
    discount_type: initialData.discount_type || "percent",
    // We keep a single generic 'value' for the form state
    discount_value: initialData.discount_value ?? initialData.discount_amount ?? "",
    discount_percent: initialData.discount_percent ?? "",
    start_date: initialData.start_date ? initialData.start_date.split("T")[0] : "",
    end_date: initialData.end_date ? initialData.end_date.split("T")[0] : "",
  });

  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.discount_type === "flat") {
      setForm((f) => ({ ...f, discount_percent: "" }));
    }
    if (form.discount_type === "percent") {
      setForm((f) => ({ ...f, discount_value: "" }));
    }
  }, [form.discount_type]);

  /* ===============================
      SUBMIT LOGIC
  =============================== */
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);

    if (!form.start_date || !form.end_date) {
      alert("Start date and end date are required");
      setSaving(false);
      return;
    }

    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (start > end) {
      alert("End date must be after start date");
      setSaving(false);
      return;
    }

    const title = form.title;
    const discount_type = form.discount_type;
    const discount_value = form.discount_value;
    const discount_percent = form.discount_percent;
    const is_active = true;
    const has_coupon = false;
    const coupon_code = null;
    const start_date = form.start_date;
    const end_date = form.end_date;
    const usage_limit = null;

    if (!title || title.trim().length === 0) {
      alert("Offer title is required");
      setSaving(false);
      return;
    }

    if (!discount_type) {
      alert("Discount type is required");
      setSaving(false);
      return;
    }

    if (discount_type === "flat") {
      if (!discount_value || Number(discount_value) <= 0) {
        alert("Flat discount amount must be greater than 0");
        setSaving(false);
        return;
      }
    }

    if (discount_type === "percent") {
      if (
        !discount_percent ||
        Number(discount_percent) <= 0 ||
        Number(discount_percent) > 100
      ) {
        alert("Discount percent must be between 1 and 100");
        setSaving(false);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      discount_type,
      is_active,
      has_coupon,
      coupon_code,
      start_date,
      end_date,
      usage_limit,

      // ?? REQUIRED BY DB (ALWAYS NOT NULL)
      discount_value:
        discount_type === "flat"
          ? Number(discount_value)
          : Number(discount_percent),

      // ?? REQUIRED BY offers_discount_check
      discount_amount:
        discount_type === "flat"
          ? Number(discount_value)
          : null,

      discount_percent:
        discount_type === "percent"
          ? Number(discount_percent)
          : null,
    };

    console.log("OFFER PAYLOAD", payload);

    try {
      if (mode === "edit") {
        const { error } = await supabase
          .from("offers")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("offers")
          .insert(payload)
          .select("*");

        if (error) {
          console.error("Failed to save offer", error);
          alert(error.message);
          setSaving(false);
          return;
        }
      }

      onSave?.();
      closeModal();
    } catch (err) {
      console.error("Failed to save offer:", err);
      alert("Failed to save offer: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-3xl bg-card rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[95vh]">
        {/* HEADER */}
        <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-card z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold">
            {mode === "edit" ? "Edit Offer" : "Add Offer"}
          </h2>
          <button
            onClick={closeModal}
            className="text-gray-500 text-xl leading-none hover:text-gray-700"
            aria-label="Close"
          >
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={submit} className="px-4 sm:px-6 py-4 space-y-4 overflow-y-auto">
          <input
            placeholder="Offer Title"
            className="w-full border rounded-lg px-3 py-2 bg-card text-white"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className="w-full border rounded-lg px-3 py-2 bg-card text-white"
              value={form.discount_type}
              onChange={(e) => update("discount_type", e.target.value)}
            >
              {DISCOUNT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            <input
              type="number"
              placeholder={form.discount_type === "percent" ? "Discount %" : "Amount (?)"}
              className="w-full border rounded-lg px-3 py-2 bg-card text-white"
              value={form.discount_type === "percent" ? form.discount_percent : form.discount_value}
              onChange={(e) =>
                update(
                  form.discount_type === "percent" ? "discount_percent" : "discount_value",
                  e.target.value
                )
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 bg-card text-white"
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
              required
            />
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 bg-card text-white"
              value={form.end_date}
              onChange={(e) => update("end_date", e.target.value)}
              required
            />
          </div>
        </form>

        {/* FOOTER */}
        <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={closeModal} className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button disabled={saving} onClick={submit} className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
            {saving ? "Saving..." : "Save Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
