import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function CategoryManagement() {
  const [activeTab, setActiveTab] = useState("income");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    is_default: false,
  });

  const loadCategories = async (type) => {
    setLoading(true);
    setError("");
    try {
      const table = type === "income" ? "income_subtypes" : "expense_subtypes";
      const { data, error: loadError } = await supabase
        .from(table)
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (loadError) throw loadError;
      setCategories(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load categories");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories(activeTab);
  }, [activeTab]);

  const handleSave = async () => {
    if (!form.name) {
      setError("Name is required");
      return;
    }

    try {
      const table = activeTab === "income" ? "income_subtypes" : "expense_subtypes";

      // Note: type is required for expense_subtypes/income_subtypes. 
      // For now we use activeTab as parent type name if not specified.
      // This matches the schema created in SQL.
      const parentType = activeTab === "income" ? "Membership Fees" : "Other";

      const { error: saveError } = await supabase
        .from(table)
        .insert({
          name: form.name,
          type: parentType, // Using a default parent group
          is_active: true
        });

      if (saveError) throw saveError;

      setShowModal(false);
      setForm({ name: "", description: "", is_default: false });
      loadCategories(activeTab);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-1 p-8 bg-navy">
      <div className="mx-auto w-full">

        {/* HEADER */}
        <div className="flex justify-between items-center pb-6">
          <h1 className="text-white text-3xl font-black">
            Category Management
          </h1>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 h-10 bg-primary text-white font-bold text-sm rounded-lg hover:bg-blue-600"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Add Category
          </button>
        </div>

        {/* TABS */}
        <div className="flex space-x-6 border-b border-gray-300 mb-6">
          {["income", "expense"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${activeTab === t
                ? "border-primary text-primary font-bold"
                : "border-transparent text-secondary hover:text-white"
                }`}
            >
              {t === "income" ? "Income Categories" : "Expense Categories"}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div className="bg-card rounded-xl shadow-sm border border-slate-700/20 overflow-hidden">
          <div className="hidden md:block">
            <table className="min-w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Category Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase">
                    Default
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-secondary">
                      Loading categories...
                    </td>
                  </tr>
                )}

                {!loading && categories.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-secondary">
                      No categories found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  categories.map((cat) => (
                    <tr key={cat.id}>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {cat.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary">
                        {cat.description || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {cat.is_default && (
                          <span className="material-symbols-outlined text-green-500">
                            check_circle
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden">
            {loading && (
              <div className="px-6 py-4 text-center text-secondary">
                Loading categories...
              </div>
            )}
            {!loading && categories.length === 0 && (
              <div className="px-6 py-4 text-center text-secondary">
                No categories found.
              </div>
            )}
            {!loading &&
              categories.map((cat) => (
                <div key={cat.id} className="border-b p-4">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-white">{cat.name}</div>
                    {cat.is_default && (
                      <span className="material-symbols-outlined text-green-500">
                        check_circle
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-secondary mt-1">
                    {cat.description || "-"}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-4">{error}</p>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-700/20 flex justify-between">
              <h3 className="text-xl font-bold text-white">
                Add {activeTab === "income" ? "Income" : "Expense"} Category
              </h3>
              <button onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined text-2xl">
                  close
                </span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <input
                placeholder="Category Name"
                className="form-input w-full rounded-lg bg-card text-white"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />

              <textarea
                placeholder="Description"
                className="form-textarea w-full rounded-lg bg-card text-white"
                rows="3"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) =>
                    setForm({ ...form, is_default: e.target.checked })
                  }
                />
                Set as default
              </label>
            </div>

            <div className="p-6 bg-slate-800/50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-secondary hover:bg-slate-800/30"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
