import { useState, useEffect } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

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

const AddTrainerModal = ({ trainer = null, onSave }) => {
  const { closeModal } = useModal();
  const isEdit = Boolean(trainer);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleSpecialization = (value) => {
    setSpecialization((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  /* ===============================
     HYDRATE EDIT DATA
  =============================== */
  useEffect(() => {
    if (trainer) {
      setFullName(trainer.full_name || "");
      setPhone(trainer.phone || "");
      setEmail(trainer.email || "");
      setSpecialization(
        Array.isArray(trainer.specialization) ? trainer.specialization : []
      );
    }
  }, [trainer]);

  /* ===============================
     SUBMIT (NO AUTH)
  =============================== */
  const submit = async (e) => {
    e.preventDefault();

    if (specialization.length === 0) {
      setError("Please select at least one specialization.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        full_name: typeof fullName === "string" ? fullName.trim() : fullName,

        phone:
          typeof phone === "string" && phone.trim() !== ""
            ? phone.trim()
            : null,

        email:
          typeof email === "string" && email.trim() !== ""
            ? email.trim()
            : null,

        specialization: specialization.length ? specialization : null,
      };


      let result;

      if (isEdit) {
        result = await supabase
          .from("trainers")
          .update(payload)
          .eq("id", trainer.id);
      } else {
        result = await supabase
          .from("trainers")
          .insert(payload);
      }

      if (result.error) {
        throw result.error;
      }

      onSave?.();
      closeModal();
    } catch (err) {
      console.error("Trainer save failed:", err);
      setError(err.message || "Failed to save trainer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[520px] bg-card rounded-2xl shadow-xl">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h3 className="text-lg font-semibold">
          {isEdit ? "Edit Trainer" : "Add New Trainer"}
        </h3>
        <button
          onClick={closeModal}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
      </div>

      {/* FORM */}
      <form onSubmit={submit} className="px-6 py-5 space-y-5">
        {/* FULL NAME */}
        <div>
          <label className="text-sm font-medium text-white">
            Full Name
          </label>
          <div className="mt-1 relative">
            <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined">
              person
            </span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-white"
              placeholder="e.g. John Doe"
            />
          </div>
        </div>

        {/* PHONE + EMAIL */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-white">
              Phone Number
            </label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined">
                call
              </span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-white"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-white">
              Email Address
            </label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined">
                mail
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-white"
                placeholder="john@example.com"
              />
            </div>
          </div>
        </div>

        {/* SPECIALIZATION */}
        <div>
          <label className="text-sm font-medium text-white">
            Specialization
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SPECIALIZATIONS.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={specialization.includes(s)}
                  onChange={() => toggleSpecialization(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
          >
            {loading
              ? "Saving..."
              : isEdit
                ? "Update Trainer"
                : "Create Trainer"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTrainerModal;
