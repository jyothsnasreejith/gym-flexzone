import { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

export default function AssignOfferModal({ offer, onSaved }) {
  const { closeModal } = useModal();

  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [packageQuery, setPackageQuery] = useState("");

  const formatVariantLabel = (variant) => {
    if (variant.pricing_type === "duration") {
      const unitLabel = variant.duration_unit === "month" ? "Month" : "Year";
      const plural = variant.duration_value > 1 ? "s" : "";
      return `${variant.duration_value} ${unitLabel}${plural} - ₹${variant.price}`;
    }
    if (variant.pricing_type === "sessions") {
      const plural = variant.duration_value > 1 ? "s" : "";
      return `${variant.duration_value} Month${plural} · ${variant.weekly_days} days/week · ${variant.sessions_total} Sessions - ₹${variant.price}`;
    }
    return `₹${variant.price}`;
  };

  /* ===============================
     LOAD PACKAGES + VARIANTS
  =============================== */
  useEffect(() => {
    const loadTargets = async () => {
      setTargets([]);
      setSelectedTarget(null);

      const { data, error } = await supabase
        .from("packages")
        .select(`
          uuid,
          title,
          package_variants (
            id,
            pricing_type,
            duration_value,
            duration_unit,
            weekly_days,
            sessions_total,
            price,
            is_active
          )
        `)
        .order("title", { ascending: true });

      if (!error) {
        const rows = [];
        (data || []).forEach((pkg) => {
          rows.push({
            id: pkg.uuid,
            type: "package",
            title: pkg.title,
            subtitle: "All variants",
            searchText: pkg.title,
          });

          (pkg.package_variants || [])
            .filter((v) => v.is_active)
            .forEach((v) => {
              const label = formatVariantLabel(v);
              rows.push({
                id: v.id,
                type: "package_variant",
                title: pkg.title,
                subtitle: label,
                searchText: `${pkg.title} ${label}`,
              });
            });
        });

        setTargets(rows);
      }
    };

    loadTargets();
  }, []);

  /* ===============================
     ASSIGN OFFER
  =============================== */
  const assign = async () => {
    if (!selectedTarget) {
      alert("Please select a target");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("offer_assignments").insert({
        offer_id: offer.id,
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
      });

      if (error) throw error;

      onSaved?.();
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Failed to assign offer");
    } finally {
      setSaving(false);
    }
  };

  const filteredTargets = targets.filter((t) =>
    t.searchText
      ?.toLowerCase()
      .includes(packageQuery.trim().toLowerCase())
  );

  return (
    <div className="w-full max-w-md bg-card rounded-xl shadow-xl flex flex-col max-h-[90vh]">
      
      {/* HEADER */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-bold truncate">
          Assign Offer — {offer.title}
        </h2>
        <button
          onClick={closeModal}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* BODY */}
      <div className="px-5 py-4 space-y-4 overflow-y-auto">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Search Package / Variant
          </label>
          <input
            type="text"
            value={packageQuery}
            onChange={(e) => setPackageQuery(e.target.value)}
            placeholder="Search by package or variant"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-2">
            Select Package or Variant
          </label>

          {filteredTargets.length === 0 ? (
            <div className="text-sm text-gray-500">
              No packages found.
            </div>
          ) : (
            <ul className="border rounded-lg divide-y max-h-72 overflow-y-auto">
              {filteredTargets.map((t) => (
                <li
                  key={`${t.type}:${t.id}`}
                  onClick={() => setSelectedTarget(t)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 ${
                    selectedTarget?.type === t.type && selectedTarget?.id === t.id
                      ? "bg-primary/5 border-l-4 border-primary"
                      : ""
                  }`}
                >
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-gray-500">{t.subtitle}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-5 py-4 border-t flex justify-end gap-3">
        <button
          onClick={closeModal}
          className="px-4 py-2 border rounded-lg"
        >
          Cancel
        </button>
        <button
          disabled={saving || !selectedTarget}
          onClick={assign}
          className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
        >
          {saving ? "Assigning…" : "Assign Offer"}
        </button>
      </div>
    </div>
  );
}
