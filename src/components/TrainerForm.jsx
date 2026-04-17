import { useEffect, useRef, useState } from "react";

/* ================= CONSTANTS ================= */
const SPECIALIZATIONS = [
  "Personal Training",
  "Strength & Conditioning",
  "Weightlifting",
  "CrossFit",
  "Yoga",
  "Cardio & HIIT",
  "Physiotherapy",
  "Nutrition",
];

const SHIFT_OPTIONS = [
  { label: "Morning (05:00 AM - 07:00 AM)", value: "05:00-07:00" },
  { label: "Evening (05:00 PM - 07:00 PM)", value: "17:00-19:00" },
  { label: "Both (Morning & Evening)", value: "Both" },
];

const DOCUMENT_TYPES = [
  { key: "cv", label: "CV / Resume" },
  { key: "id1", label: "ID Proof" },
];


const normalizeShift = (value) => {
  if (!value) return "";
  const cleaned = String(value).trim();
  const lower = cleaned.toLowerCase();

  if (lower === "morning" || cleaned === "05:00-07:00") return "05:00-07:00";
  if (lower === "evening" || cleaned === "17:00-19:00") return "17:00-19:00";
  if (lower === "both") return "Both";

  if (cleaned.includes("-")) {
    const [start] = cleaned.split("-");
    const hour = Number((start || "").split(":")[0]);
    if (!Number.isNaN(hour)) {
      return hour < 15 ? "05:00-07:00" : "17:00-19:00";
    }
  }

  return cleaned;
};

const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/* ================= COMPONENT ================= */
export default function TrainerForm({
  title,
  initialData = {},
  onSubmit,
  submitLabel = "Save Trainer",

  // ✅ NEW PROPS (REQUIRED)
  photoFile,
  setPhotoFile,
  cvFile,
  setCvFile,
  idProof1File,
  setIdProof1File,
  idProof2File,
  setIdProof2File,
  workExperienceFile,
  setWorkExperienceFile,
}) {
  const hydratedRef = useRef(false);
  const fileInputRef = useRef(null);

  const [selectedDocs, setSelectedDocs] = useState([]);

  const documentStateMap = {
    cv: { file: cvFile, setFile: setCvFile, existingUrl: initialData.cv_url },
    id1: { file: idProof1File, setFile: setIdProof1File, existingUrl: initialData.id_proof_1_url },
  };


  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    specialization: [],
    designation: "",
    date_of_joining: "",
    base_salary: "",
    commission: "",
    shift: "",
    weekly_off: "",
    notes: "",
  });

  const update = (key, value) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSpecialization = (value) => {
    setForm((prev) => ({
      ...prev,
      specialization: prev.specialization.includes(value)
        ? prev.specialization.filter(v => v !== value)
        : [...prev.specialization, value],
    }));
  };

  useEffect(() => {
    const initialSelectedDocs = [];
    if (initialData.cv_url || cvFile) initialSelectedDocs.push("cv");
    if (initialData.id_proof_1_url || idProof1File) initialSelectedDocs.push("id1");
    if (initialData.id_proof_2_url || idProof2File) initialSelectedDocs.push("id2");
    if (initialData.work_experience_url || workExperienceFile)
      initialSelectedDocs.push("work");

    setSelectedDocs((prev) => {
      const combined = [...new Set([...prev, ...initialSelectedDocs])];
      if (JSON.stringify(combined) === JSON.stringify(prev)) return prev;
      return combined;
    });
  }, [
    initialData.cv_url,
    initialData.id_proof_1_url,
    initialData.id_proof_2_url,
    initialData.work_experience_url,
    cvFile,
    idProof1File,
    idProof2File,
    workExperienceFile,
  ]);

  /* ================= HYDRATE ================= */
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!initialData || Object.keys(initialData).length === 0) return;

    setForm({
      full_name: initialData.full_name || "",
      phone: initialData.phone || "",
      email: initialData.email || "",
      specialization: Array.isArray(initialData.specialization)
        ? initialData.specialization
        : [],
      designation: initialData.designation || "",
      date_of_joining: initialData.date_of_joining || "",
      base_salary: initialData.base_salary ?? "",
      commission: initialData.commission ?? "",
      shift: normalizeShift(initialData.shift || ""),
      weekly_off: initialData.weekly_off || "",
      notes: initialData.notes || "",
    });

    hydratedRef.current = true;
  }, [initialData]);

  /* ================= SUBMIT ================= */
  const submit = async (e) => {
    e.preventDefault();

    // ================= DOCUMENT VALIDATION =================
    // Documents are now optional based on user request.

    if (!form.full_name || !form.phone || form.specialization.length === 0) {
      alert("Full name, phone, and at least one specialization are required");
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      phone: String(form.phone).trim(),
      email: form.email?.trim() || null,
      specialization: form.specialization.length ? form.specialization : null,
      designation: form.designation || null,
      date_of_joining: form.date_of_joining || null,
      base_salary: form.base_salary !== "" ? Number(form.base_salary) : null,
      commission: form.commission !== "" ? Number(form.commission) : null,
      shift: normalizeShift(form.shift) || null,
      weekly_off: form.weekly_off || null,
      notes: form.notes || null,
    };

    const documentFiles = {
      cvFile,
      idProof1File,
      idProof2File,
      workExperienceFile,
    };

    await onSubmit(payload, documentFiles);
  };

  /* ================= UI ================= */
  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* PROFILE PHOTO */}
      <section className="bg-card rounded-2xl p-4 sm:p-6 shadow mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-2xl font-bold border-2 border-dashed border-gray-300 flex-shrink-0">
            {photoFile ? (
              <img
                src={URL.createObjectURL(photoFile)}
                className="h-full w-full object-cover"
                alt="Profile Preview"
              />
            ) : initialData.profile_image_url ? (
              <img
                src={initialData.profile_image_url}
                className="h-full w-full object-cover"
                alt="Current Profile"
              />
            ) : (
              initialData.full_name?.charAt(0) || "?"
            )}
          </div>

          <div className="flex flex-col items-center sm:items-start">
            <input
              type="file"
              hidden
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => setPhotoFile(e.target.files[0])}
            />
            <p className="font-semibold">Profile Photo</p>
            <p className="text-xs text-gray-500 mt-1 mb-2">
              JPG / PNG · Square recommended
            </p>
            <button type="button" onClick={() => fileInputRef.current.click()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
              Upload Photo
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="space-y-6 sm:space-y-8">
        {/* PERSONAL */}
        <Card icon="person" title="Personal & Contact Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Full Name *" value={form.full_name} onChange={(v) => update("full_name", v)} />
            <Input label="Phone *" value={form.phone} onChange={(v) => update("phone", v)} />
            <Input label="Email" value={form.email} onChange={(v) => update("email", v)} />
          </div>

          {SPECIALIZATIONS.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.specialization.includes(s)}
                onChange={() => toggleSpecialization(s)}
              />
              {s}
            </label>
          ))}
        </Card>

        {/* EMPLOYMENT */}
        <Card icon="work" title="Employment & Compensation">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input label="Designation" value={form.designation} onChange={(v) => update("designation", v)} />
            <Input type="date" label="Date of Joining" value={form.date_of_joining} onChange={(v) => update("date_of_joining", v)} />
            <Input label="Base Salary (₹)" value={form.base_salary} onChange={(v) => update("base_salary", v)} />
            <Input label="Commission (%)" value={form.commission} onChange={(v) => update("commission", v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Shift"
              value={form.shift}
              options={SHIFT_OPTIONS}
              onChange={(v) => update("shift", v)}
            />

            <Select
              label="Weekly Off"
              value={form.weekly_off}
              options={WEEK_DAYS.map(d => ({ label: d, value: d }))}
              onChange={(v) => update("weekly_off", v)}
            />
          </div>
        </Card>

        {/* NOTES */}
        <Card icon="description" title="Notes">
          <Textarea value={form.notes} onChange={(v) => update("notes", v)} />
        </Card>

        {/* DOCUMENTS */}
        <Card icon="folder" title="Documents">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Add a document</label>
              <select
                value="" // always reset
                onChange={(e) => {
                  const selectedKey = e.target.value;
                  if (selectedKey && !selectedDocs.includes(selectedKey)) {
                    setSelectedDocs([...selectedDocs, selectedKey]);
                  }
                }}
                className="w-full border rounded-lg px-3 py-2 bg-card"
              >
                <option value="">Select document type...</option>
                {DOCUMENT_TYPES.map(d => (
                  <option
                    key={d.key}
                    value={d.key}
                    disabled={selectedDocs.includes(d.key)}
                  >
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4 pt-2">
              {selectedDocs.map((docKey) => {
                const docConfig = documentStateMap[docKey];
                const docTypeInfo = DOCUMENT_TYPES.find(d => d.key === docKey);
                if (!docTypeInfo) return null;

                return (
                  <FileInput
                    key={docKey}
                    label={docTypeInfo.label}
                    file={docConfig.file}
                    setFile={docConfig.setFile}
                    existingUrl={docConfig.existingUrl}
                  />
                );
              })}
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <button className="w-full sm:w-auto px-6 py-3 bg-primary text-white rounded-lg font-bold">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

const FileInput = ({ label, file, setFile, existingUrl }) => {
  const inputRef = useRef(null);
  return (
    <div>
      <label className="block text-sm text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-4">
        <input
          type="file"
          hidden
          ref={inputRef}
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
        >
          Upload
        </button>
        {file && (
          <p className="text-sm text-gray-600 truncate">{file.name}</p>
        )}
        {!file && existingUrl && (
          <a
            href={`${existingUrl}${existingUrl.includes('?') ? '&' : '?'}t=${Date.now()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View Uploaded
          </a>
        )}
      </div>
    </div>
  );
};


/* ================= HELPERS ================= */
const Card = ({ icon, title, children }) => (
  <section className="bg-card rounded-2xl p-4 sm:p-6 shadow space-y-4">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <h3 className="font-semibold">{title}</h3>
    </div>
    {children}
  </section>
);

const Input = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="block text-sm text-white mb-1">{label}</label>
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 bg-card text-white"
    />
  </div>
);

const Textarea = ({ value, onChange }) => (
  <textarea
    rows="4"
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className="w-full border rounded-lg px-3 py-2 bg-card text-white"
  />
);

const Select = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-sm text-gray-500 mb-1">{label}</label>
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 bg-card"
    >
      <option value="">Select</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);
