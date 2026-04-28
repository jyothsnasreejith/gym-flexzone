import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ExpenseSubtypeModal({
  open,
  onClose,
  expenseType,
  onUpdated,
}) {
  const [subtypes, setSubtypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !expenseType) return;

    const load = async () => {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("expense_subtypes")
        .select("id, name, is_active, type, created_at")
        .eq("type", expenseType)
        .order("name");

      if (loadError) {
        setError(loadError.message);
        setSubtypes([]);
      } else {
        setSubtypes(data || []);
      }
      setLoading(false);
    };

    load();
  }, [open, expenseType]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");

    const { error: insertError } = await supabase
      .from("expense_subtypes")
      .insert({
        type: expenseType,
        name: trimmed,
        is_active: true,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setName("");
    setSaving(false);
    onUpdated?.();
    const { data } = await supabase
      .from("expense_subtypes")
      .select("id, name, is_active, type, created_at")
      .eq("type", expenseType)
      .order("name");
    setSubtypes(data || []);
  };

  const toggleActive = async (subtype) => {
    const next = !subtype.is_active;
    const { error: updateError } = await supabase
      .from("expense_subtypes")
      .update({ is_active: next })
      .eq("id", subtype.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSubtypes((prev) =>
      prev.map((s) =>
        s.id === subtype.id ? { ...s, is_active: next } : s
      )
    );
    onUpdated?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              Manage Subtypes
            </h3>
            <p className="text-xs text-white">
              {expenseType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Subtype name"
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-card text-white"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !name.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-card px-4 py-2 text-xs text-white">
              Existing Subtypes
            </div>
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                Loading...
              </div>
            ) : subtypes.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No subtypes yet.
              </div>
            ) : (
              <ul className="divide-y">
                {subtypes.map((s) => (
                  <li
                    key={s.id}
                    className="px-4 py-2 flex items-center justify-between"
                  >
                    <div className="text-sm">
                      {s.name}
                      {!s.is_active && (
                        <span className="ml-2 text-xs text-gray-400">
                          (inactive)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleActive(s)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {s.is_active ? "Disable" : "Enable"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
