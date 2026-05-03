import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function PackageDetailsDisplay({ 
  memberId, 
  packageHistory, 
  addOnHistory, 
  currentPackage,
  onUpdate 
}) {
  const [viewMode, setViewMode] = useState("table"); // "card" or "table" - default to table
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [editForm, setEditForm] = useState({ start_date: "", end_date: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const openEditModal = (id, type, startDate, endDate) => {
    setEditingId(id);
    setEditingType(type);
    setEditForm({ start_date: startDate || "", end_date: endDate || "" });
  };

  const closeEditModal = () => {
    setEditingId(null);
    setEditingType(null);
    setEditForm({ start_date: "", end_date: "" });
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      const table = editingType === "package" ? "member_packages" : "member_add_ons";
      const { error } = await supabase
        .from(table)
        .update({
          start_date: editForm.start_date,
          end_date: editForm.end_date,
        })
        .eq("id", editingId);

      if (error) throw error;
      closeEditModal();
      onUpdate?.();
    } catch (err) {
      console.error("Error updating:", err);
      alert("Failed to update dates");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm("Are you sure you want to delete this " + (type === "package" ? "package" : "add-on") + "?")) {
      return;
    }
    try {
      setIsDeleting(true);
      const table = type === "package" ? "member_packages" : "member_add_ons";
      const { error } = await supabase
        .from(table)
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) throw error;
      onUpdate?.();
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      case "expired":
        return "bg-red-500/20 text-red-400 border border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
    }
  };

  // Combine current package with history if history is empty
  const hasData = packageHistory.length > 0 || addOnHistory.length > 0 || currentPackage;
  const filteredPackages = (packageHistory.length > 0 ? packageHistory : (currentPackage ? [currentPackage] : []))
    .filter((pkg) => pkg.start_date !== pkg.end_date); // Hide if start and end date are same
  const displayPackages = filteredPackages;

  return (
    <>
      {/* Header with View Mode Toggle */}
      <div className="bg-primary-blue p-8 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
            <span className="material-symbols-outlined">inventory_2</span>
            Package Details
          </h2>
          <div className="flex items-center gap-2 bg-secondary-blue rounded-lg p-1">
            <button
              onClick={() => setViewMode("card")}
              className={`px-3 py-2 rounded text-xs font-semibold transition-colors ${
                viewMode === "card"
                  ? "bg-primary-blue text-gold"
                  : "text-secondary hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_comfy</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 rounded text-xs font-semibold transition-colors ${
                viewMode === "table"
                  ? "bg-primary-blue text-gold"
                  : "text-secondary hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">table_chart</span>
            </button>
          </div>
        </div>

        {/* CARD VIEW */}
        {viewMode === "card" && (
          <div className="space-y-6">
            {/* Packages */}
            {displayPackages.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-secondary mb-3 uppercase tracking-wide">
                  Packages ({displayPackages.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="bg-secondary-blue p-4 rounded-lg border border-slate-600/30 hover:border-gold/30 transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-white">
                            {pkg.packages?.title || pkg.packageTitle || "Unknown Package"}
                          </h4>
                          {/* Show Duration - inline after name */}
                          {pkg.duration && (
                            <p className="text-xs text-secondary mt-1">
                              {pkg.duration}
                            </p>
                          )}"
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-2 ${getStatusColor(
                              pkg.status || "active"
                            )}`}
                          >
                            {pkg.status || "active"}
                          </span>
                        </div>
                        {pkg.id && (
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                openEditModal(pkg.id, "package", pkg.start_date, pkg.end_date)
                              }
                              className="p-2 hover:bg-primary-blue rounded-lg transition text-gold hover:text-white"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(pkg.id, "package")}
                              disabled={isDeleting}
                              className="p-2 hover:bg-red-900/50 rounded-lg transition text-red-400 hover:text-red-200 disabled:opacity-50"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        {pkg.start_date && (
                          <div className="flex justify-between">
                            <span className="text-secondary">Start Date:</span>
                            <span className="text-white font-medium">{formatDate(pkg.start_date)}</span>
                          </div>
                        )}
                        {pkg.end_date && (
                          <div className="flex justify-between">
                            <span className="text-secondary">End Date:</span>
                            <span className="text-white font-medium">{formatDate(pkg.end_date)}</span>
                          </div>
                        )}
                        {!pkg.end_date && pkg.status !== "active" && (
                          <div className="flex justify-between">
                            <span className="text-secondary">End Date:</span>
                            <span className="text-slate-400 italic">Not Set</span>
                          </div>
                        )}
                        {(pkg.duration || pkg.duration_value) && (
                          <div className="flex justify-between">
                            <span className="text-secondary">Duration:</span>
                            <span className="text-white font-medium">
                              {pkg.duration || (pkg.duration_value ? `${pkg.duration_value} ${pkg.duration_unit || ""}` : "N/A")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {addOnHistory.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-secondary mb-3 uppercase tracking-wide">
                  Add-ons ({addOnHistory.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addOnHistory.map((addon) => (
                    <div
                      key={addon.id}
                      className="bg-slate-700/50 p-4 rounded-lg border border-purple-600/30 hover:border-purple-400/50 transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-white">
                            {addon.add_ons?.name || "Unknown Add-on"}
                          </h4>
                          <p className="text-xs text-secondary mt-1">
                            {addon.add_ons?.duration_value} {addon.add_ons?.duration_unit}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              openEditModal(addon.id, "addon", addon.start_date, addon.end_date)
                            }
                            className="p-2 hover:bg-primary-blue rounded-lg transition text-purple-400 hover:text-white"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(addon.id, "addon")}
                            disabled={isDeleting}
                            className="p-2 hover:bg-red-900/50 rounded-lg transition text-red-400 hover:text-red-200 disabled:opacity-50"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-secondary">Start Date:</span>
                          <span className="text-white font-medium">{formatDate(addon.start_date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">End Date:</span>
                          <span className="text-white font-medium">{formatDate(addon.end_date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasData && (
              <div className="text-center py-8 text-secondary">
                <span className="material-symbols-outlined text-3xl block mb-2 opacity-50">
                  inventory_2
                </span>
                <p>No packages or add-ons found</p>
              </div>
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase">Start Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase">End Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-secondary uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {displayPackages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400">
                        Package
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {pkg.packages?.title || pkg.packageTitle || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-secondary text-sm">
                      {pkg.package_variants?.duration_value ? `${pkg.package_variants.duration_value} ${pkg.package_variants.duration_unit || ""}` : pkg.duration || "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary">{formatDate(pkg.start_date) || "—"}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(pkg.end_date) || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(pkg.status || "active")}`}>
                        {pkg.status || "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {pkg.id && (
                          <>
                            <button
                              onClick={() =>
                                openEditModal(pkg.id, "package", pkg.start_date, pkg.end_date)
                              }
                              className="p-2 hover:bg-primary-blue rounded-lg transition text-gold hover:text-white"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(pkg.id, "package")}
                              disabled={isDeleting}
                              className="p-2 hover:bg-red-900/50 rounded-lg transition text-red-400 hover:text-red-200 disabled:opacity-50"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {addOnHistory.map((addon) => (
                  <tr
                    key={addon.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-400">
                        Add-on
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {addon.add_ons?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-secondary text-sm">
                      {addon.add_ons?.duration_value || "—"} {addon.add_ons?.duration_unit || ""}
                    </td>
                    <td className="px-4 py-3 text-secondary">{formatDate(addon.start_date)}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(addon.end_date)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-500/20 text-slate-300">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() =>
                            openEditModal(addon.id, "addon", addon.start_date, addon.end_date)
                          }
                          className="p-2 hover:bg-primary-blue rounded-lg transition text-purple-400 hover:text-white"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(addon.id, "addon")}
                          disabled={isDeleting}
                          className="p-2 hover:bg-red-900/50 rounded-lg transition text-red-400 hover:text-red-200 disabled:opacity-50"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!hasData && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-secondary">
                      No packages or add-ons found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-primary-blue rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-600">
            <h3 className="text-lg font-bold text-white mb-6">
              Edit {editingType === "package" ? "Package" : "Add-on"} Dates
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-secondary mb-2">Start Date</label>
                <input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      start_date: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-secondary-blue text-white rounded-lg border border-slate-600 focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">End Date</label>
                <input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      end_date: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-secondary-blue text-white rounded-lg border border-slate-600 focus:border-gold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gold hover:bg-gold-bright text-navy rounded-lg font-semibold transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
