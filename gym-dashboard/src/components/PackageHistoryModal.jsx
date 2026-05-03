import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function PackageHistoryModal({ memberId, isOpen, onClose, onUpdate }) {
  const [packageHistory, setPackageHistory] = useState([]);
  const [addOnHistory, setAddOnHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [editForm, setEditForm] = useState({ start_date: "", end_date: "" });

  useEffect(() => {
    if (isOpen && memberId) {
      loadHistory();
    }
  }, [isOpen, memberId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // Load package history
      const { data: pkgData, error: pkgErr } = await supabase
        .from("member_packages")
        .select(`
          id,
          member_id,
          start_date,
          end_date,
          status,
          packages(id, title)
        `)
        .eq("member_id", memberId)
        .order("start_date", { ascending: false });

      if (!pkgErr) {
        setPackageHistory(pkgData || []);
      }

      // Load add-ons history
      const { data: addOnsData, error: addOnsErr } = await supabase
        .from("member_add_ons")
        .select(`
          id,
          member_id,
          add_on_id,
          start_date,
          end_date,
          add_ons(id, name, duration_value, duration_unit)
        `)
        .eq("member_id", memberId)
        .order("start_date", { ascending: false });

      if (!addOnsErr) {
        setAddOnHistory(addOnsData || []);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (id, type, startDate, endDate) => {
    setEditingId(id);
    setEditingType(type);
    setEditForm({ start_date: startDate, end_date: endDate });
  };

  const closeEditModal = () => {
    setEditingId(null);
    setEditingType(null);
    setEditForm({ start_date: "", end_date: "" });
  };

  const handleSaveEdit = async () => {
    try {
      const table = editingType === "package" ? "member_packages" : "member_add_ons";
      const { error } = await supabase
        .from(table)
        .update({
          start_date: editForm.start_date,
          end_date: editForm.end_date,
        })
        .eq("id", editingId);

      if (error) throw error;

      // Reload history
      await loadHistory();
      closeEditModal();
      onUpdate?.();
    } catch (err) {
      console.error("Error updating:", err);
      alert("Failed to update dates");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="material-icons-round text-primary">history</span>
            Package & Add-ons History
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-full"
          >
            <span className="material-icons-round text-white">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8 text-white">Loading...</div>
          ) : (
            <>
              {/* Packages Section */}
              {packageHistory.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-round text-blue-400">card_membership</span>
                    Package History
                  </h3>
                  <div className="space-y-3">
                    {packageHistory.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:bg-slate-700/50 transition"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">
                              {pkg.packages?.title || "Unknown Package"}
                            </h4>
                            <div className="text-sm text-gray-300 mt-2">
                              <div className="flex items-center gap-4">
                                <div>
                                  <span className="text-gray-400">Start: </span>
                                  <span className="text-white font-medium">
                                    {formatDate(pkg.start_date)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">End: </span>
                                  <span className="text-white font-medium">
                                    {formatDate(pkg.end_date)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Status: </span>
                                  <span
                                    className={`font-medium ${
                                      pkg.status === "active"
                                        ? "text-emerald-400"
                                        : "text-orange-400"
                                    }`}
                                  >
                                    {pkg.status || "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              openEditModal(pkg.id, "package", pkg.start_date, pkg.end_date)
                            }
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2 whitespace-nowrap"
                          >
                            <span className="material-icons-round text-[16px]">edit</span>
                            Edit Dates
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons Section */}
              {addOnHistory.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="material-icons-round text-purple-400">extension</span>
                    Add-ons History
                  </h3>
                  <div className="space-y-3">
                    {addOnHistory.map((addon) => (
                      <div
                        key={addon.id}
                        className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:bg-slate-700/50 transition"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">
                              {addon.add_ons?.name || "Unknown Add-on"}
                            </h4>
                            <div className="text-sm text-gray-300 mt-2">
                              <div className="flex items-center gap-4">
                                <div>
                                  <span className="text-gray-400">Duration: </span>
                                  <span className="text-white font-medium">
                                    {addon.add_ons?.duration_value}{" "}
                                    {addon.add_ons?.duration_unit}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Start: </span>
                                  <span className="text-white font-medium">
                                    {formatDate(addon.start_date)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">End: </span>
                                  <span className="text-white font-medium">
                                    {formatDate(addon.end_date)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              openEditModal(addon.id, "addon", addon.start_date, addon.end_date)
                            }
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2 whitespace-nowrap"
                          >
                            <span className="material-icons-round text-[16px]">edit</span>
                            Edit Dates
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {packageHistory.length === 0 && addOnHistory.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <span className="material-icons-round text-4xl mb-2 block opacity-30">
                    history
                  </span>
                  <p>No package or add-on history found</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit Modal */}
        {editingId && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
            <div className="bg-card rounded-lg shadow-2xl max-w-md w-full p-6 border border-slate-600">
              <h3 className="text-lg font-bold text-white mb-4">
                Edit {editingType === "package" ? "Package" : "Add-on"} Dates
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
