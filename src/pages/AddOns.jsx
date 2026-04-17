import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../context/ToastContext";

const AddOns = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: "",
    durationValue: "",
    durationUnit: "days",
    amount: "",
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    durationValue: "",
    durationUnit: "days",
    amount: "",
  });
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      durationValue: "",
      durationUnit: "days",
      amount: "",
    });
  };

  const fetchAddOns = async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data, error } = await supabase
        .from("add_ons")
        .select("id, name, duration_value, duration_unit, amount, created_at, is_active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      if (err?.code === "PGRST205") {
        setTableMissing(true);
        setItems([]);
      } else {
        console.error("Failed to load add-ons:", err);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddOns();
  }, []);

  const validateFields = (values) => {
    const name = values.name.trim();
    const durationValue = Number(values.durationValue);
    const amount = Number(values.amount);

    if (!name || name.length < 2) {
      return "Enter a valid package name";
    }
    if (!Number.isFinite(durationValue) || durationValue < 1) {
      return "Enter a valid duration";
    }
    if (!Number.isFinite(amount) || amount < 1) {
      return "Enter a valid amount";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateFields(form);
    if (error) {
      showToast(error, "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        duration_value: Number(form.durationValue),
        duration_unit: form.durationUnit,
        amount: Number(form.amount),
        is_active: true,
      };

      const { error: insertError } = await supabase
        .from("add_ons")
        .insert(payload);

      if (insertError) throw insertError;

      showToast("Add-on created", "success");
      resetForm();
      fetchAddOns();
    } catch (err) {
      console.error("Failed to create add-on:", err);
      showToast("Failed to create add-on", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name || "",
      durationValue: item.duration_value ?? "",
      durationUnit: item.duration_unit || "days",
      amount: item.amount ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: "",
      durationValue: "",
      durationUnit: "days",
      amount: "",
    });
  };

  const handleUpdate = async (id) => {
    const error = validateFields(editForm);
    if (error) {
      showToast(error, "error");
      return;
    }

    try {
      setUpdatingId(id);
      const payload = {
        name: editForm.name.trim(),
        duration_value: Number(editForm.durationValue),
        duration_unit: editForm.durationUnit,
        amount: Number(editForm.amount),
      };

      const { error: updateError } = await supabase
        .from("add_ons")
        .update(payload)
        .eq("id", id);

      if (updateError) throw updateError;

      showToast("Add-on updated", "success");
      cancelEdit();
      fetchAddOns();
    } catch (err) {
      console.error("Failed to update add-on:", err);
      showToast("Failed to update add-on", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this add-on?");
    if (!ok) return;

    try {
      setDeletingId(id);
      const { error: deleteError } = await supabase
        .from("add_ons")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      showToast("Add-on deleted", "success");
      fetchAddOns();
    } catch (err) {
      console.error("Failed to delete add-on:", err);
      showToast("Failed to delete add-on", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 p-8 bg-navy">
      <div className="mx-auto w-full bg-navy">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Add On</h1>
          <p className="text-sm text-secondary mt-1">
            Create and manage add-ons for your membership packages.
          </p>
        </div>

        {tableMissing && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Add-ons table is missing. Create `add_ons` in Supabase to enable this
            feature.
          </div>
        )}

        <div className="bg-primary-blue rounded-xl shadow-sm p-6 border border-slate-700/20 w-full">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Create Add-On</h2>
            <span className="text-xs text-secondary">All fields required</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white mb-1.5">
                  Package Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  className="w-full rounded-lg border border-slate-700/20 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. PT Add-on"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1.5">
                  Duration
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.durationValue}
                  onChange={(e) => updateForm("durationValue", e.target.value)}
                  className="w-full rounded-lg border border-slate-700/20 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. 30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1.5">
                  Unit
                </label>
                <select
                  value={form.durationUnit}
                  onChange={(e) => updateForm("durationUnit", e.target.value)}
                  className="w-full rounded-lg border border-slate-700/20 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 bg-card text-white"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1.5">
                  Amount (INR)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateForm("amount", e.target.value)}
                  className="w-full rounded-lg border border-slate-700/20 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. 1499"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || tableMissing}
                className="h-[42px] px-6 rounded-lg bg-primary text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Submit"}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-primary-blue rounded-xl shadow-sm border border-slate-700/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Add-On List</h2>
            <span className="text-sm text-secondary">
              {loading ? "Loading..." : `${items.length} total`}
            </span>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-secondary">
              Loading add-ons...
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-12 text-center text-secondary">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">
                  inventory_2
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-700">
                No add-ons created yet.
              </div>
              <div className="text-xs text-secondary mt-1">
                Use the form above to get started.
              </div>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                <thead className="bg-slate-800/50 text-secondary uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Name</th>
                    <th className="px-6 py-3 text-left font-semibold">Duration</th>
                    <th className="px-6 py-3 text-left font-semibold">Amount (INR)</th>
                    <th className="px-6 py-3 text-left font-semibold">Created</th>
                    <th className="px-6 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/20">
                      <td className="px-6 py-3 font-medium text-white">
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border-gray-300 text-sm bg-card text-white"
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-6 py-3 text-secondary">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={editForm.durationValue}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  durationValue: e.target.value,
                                }))
                              }
                              className="w-24 rounded-md border-gray-300 text-sm bg-card text-white"
                            />
                            <select
                              value={editForm.durationUnit}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  durationUnit: e.target.value,
                                }))
                              }
                              className="rounded-md border-gray-300 text-sm bg-card text-white"
                            >
                              <option value="days">Days</option>
                              <option value="months">Months</option>
                            </select>
                          </div>
                        ) : (
                          `${item.duration_value} ${item.duration_unit}`
                        )}
                      </td>
                      <td className="px-6 py-3 text-secondary">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                amount: e.target.value,
                              }))
                            }
                            className="w-28 rounded-md border-gray-300 text-sm bg-card text-white"
                          />
                        ) : (
                          Number(item.amount || 0).toFixed(2)
                        )}
                      </td>
                      <td className="px-6 py-3 text-secondary">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-3">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdate(item.id)}
                              disabled={updatingId === item.id}
                              className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-800/50 disabled:opacity-60"
                            >
                              {updatingId === item.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 rounded-lg border text-sm text-secondary hover:bg-slate-800/50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-800/50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              className="px-3 py-1.5 rounded-lg border text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              {deletingId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
              {/* Mobile Card View */}
              <div className="md:hidden">
                {items.map((item) => (
                  <div key={item.id} className="border-b border-slate-700/30 p-4">
                  {editingId === item.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-secondary">Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border-gray-300 text-sm mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-secondary">Duration</label>
                          <input
                            type="number"
                            min="1"
                            value={editForm.durationValue}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                durationValue: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border-gray-300 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-secondary">Unit</label>
                          <select
                            value={editForm.durationUnit}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                durationUnit: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border-gray-300 text-sm mt-1"
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-secondary">Amount (INR)</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              amount: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border-gray-300 text-sm mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={updatingId === item.id}
                          className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-800/50 disabled:opacity-60"
                        >
                          {updatingId === item.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-lg border text-sm text-secondary hover:bg-slate-800/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-white">{item.name}</div>
                          <div className="text-secondary">
                            {item.duration_value} {item.duration_unit}
                          </div>
                        </div>
                        <div className="text-white font-semibold">
                          ₹{Number(item.amount || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-between items-center">
                        <div className="text-xs text-secondary">
                          Created:{" "}
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(item)}
                            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-800/50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="px-3 py-1.5 rounded-lg border text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingId === item.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddOns;
