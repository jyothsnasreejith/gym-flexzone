import { useState, useEffect } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

/* =========================
   LEAD SOURCE OPTIONS
========================= */
const LEAD_SOURCES = [
  "Walk-in",
  "Facebook",
  "Instagram",
  "Referral",
  "Google",
  "Website",
  "Other",
];

const AddEnquiryModal = ({ onSaved }) => {
  const { closeModal } = useModal();

  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    area: "",
    age: "",
    gender: "",
    source: "",
    status: "New",
    package_uuid: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     LOAD PACKAGES (SUPABASE)
  ========================= */
  useEffect(() => {
    const loadPackages = async () => {
      try {
        const { data, error } = await supabase
          .from("packages")
          .select("uuid, title");

        if (error) throw error;
        setPackages(data || []);
      } catch (err) {
        console.error("Failed to load packages", err);
        setPackages([]);
      } finally {
        setLoadingPackages(false);
      }
    };

    loadPackages();
  }, []);

  const update = (key, value) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* =========================
     SUBMIT ENQUIRY (SUPABASE)
  ========================= */
  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.full_name || !form.phone) {
      setError("Name and phone are required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        full_name: form.full_name,
        phone: form.phone,
        area: form.area || null,
        gender: form.gender || null,
        source: form.source || null,
        status: form.status,
        age: form.age ? Number(form.age) : null,
        package_uuid: form.package_uuid || null, // ✅ UUID stays string
      };

      const { error } = await supabase
        .from("enquiries")
        .insert([payload]);

      if (error) throw error;

      onSaved?.();
      closeModal();
    } catch (err) {
      console.error(err);
      setError("Failed to add enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg bg-card rounded-xl shadow-xl">
      {/* HEADER */}
      <div className="flex items-start justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-bold">Add New Enquiry</h2>
          <p className="text-sm text-white">
            Enter the details of the prospective member.
          </p>
        </div>
        <button onClick={closeModal} className="text-gray-400 text-xl">
          ✕
        </button>
      </div>

      {/* BODY */}
      <form onSubmit={submit} className="px-6 py-4 space-y-5">
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid sm:grid-cols-2 gap-4">
          <input
            placeholder="Full Name *"
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
          />
          <input
            placeholder="Phone *"
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <input
            type="number"
            placeholder="Age"
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="">Gender</option>
            <option>Male</option>
            <option>Female</option>
          </select>
          <input
            placeholder="Area"
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.area}
            onChange={(e) => update("area", e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <select
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.source}
            onChange={(e) => update("source", e.target.value)}
          >
            <option value="">Lead Source</option>
            {LEAD_SOURCES.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border px-3 py-2 bg-card text-white"
            value={form.package_uuid}
            onChange={(e) => update("package_uuid", e.target.value)}
            disabled={loadingPackages}
          >
            <option value="">Select Package</option>
            {packages.map((p) => (
              <option key={p.uuid} value={p.uuid}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <select
          className="w-full rounded-lg border px-3 py-2 bg-card text-white"
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
        >
          <option>New</option>
          <option>Hot</option>
          <option>Converted</option>
        </select>
      </form>

      <div className="flex justify-end gap-3 px-6 py-4 border-t">
        <button onClick={closeModal} className="px-4 py-2 border rounded-lg">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          {saving ? "Saving..." : "Add Enquiry"}
        </button>
      </div>
    </div>
  );
};

export default AddEnquiryModal;
