import { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import AddPackageModal from "../modals/AddPackageModal";
import { supabase } from "../supabaseClient";

import { useToast } from "../context/ToastContext";

const Packages = () => {
  const { openModal } = useModal();
  const { showToast } = useToast();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  /* ===============================
     FETCH PACKAGES + VARIANTS
  =============================== */
  const fetchPackages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("packages")
        .select(
          `
        id,
        title,
        category,
        member_scope,
        member_count,
        is_active,
        batch_slot_id,
        batch_start_time,
        batch_end_time,
        is_student_offer,
        offer_valid_from,
        offer_valid_to,
        created_at,
        package_variants (
          id,
          pricing_type,
          duration_unit,
          duration_value,
          weekly_days,
          sessions_total,
          price,
          is_active
        )
      `
        )
        .order("display_order", { ascending: true });

      if (!error) {
        setPackages(data || []);
        return;
      }

      const fallback = await supabase
        .from("packages")
        .select(
          `
        id,
        title,
        category,
        member_scope,
        member_count,
        is_active,
        is_student_offer,
        offer_valid_from,
        offer_valid_to,
        created_at,
        package_variants (
          id,
          pricing_type,
          duration_unit,
          duration_value,
          weekly_days,
          sessions_total,
          price,
          is_active
        )
      `
        )
        .order("display_order", { ascending: true });

      if (fallback.error) {
        console.error("FETCH ERROR:", error);
        throw error;
      }

      setPackages(fallback.data || []);
    } catch (err) {
      console.error("Packages fetch failed:", err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  /* ===============================
     TOGGLE STATUS
  =============================== */
  const toggleStatus = async (pkg) => {
    try {
      const { error } = await supabase
        .from("packages")
        .update({ is_active: !pkg.is_active })
        .eq("id", pkg.id);

      if (error) throw error;
      showToast(
        `Package ${pkg.is_active ? "disabled" : "enabled"}`,
        "success"
      );
      fetchPackages();
    } catch (err) {
      console.error(err);
      showToast("Failed to update status", "error");
    }
  };

  /* ===============================
     DELETE PACKAGE
  =============================== */
  const deletePackage = async (pkg) => {
    const ok = window.confirm(`Delete package "${pkg.title}" permanently?`);
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("packages")
        .delete()
        .eq("id", pkg.id);

      if (error) throw error;
      showToast("Package deleted successfully", "success");
      fetchPackages();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete package", "error");
    }
  };

  return (
    <main className="flex-1 p-6 bg-navy">
      <div className="mx-auto w-full">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Membership Packages
            </h1>
            <p className="text-secondary mt-1">
              Manage gym membership plans and pricing tiers.
            </p>
          </div>

          <button
            onClick={() =>
              openModal(
                <AddPackageModal
                  mode="add"
                  onSave={fetchPackages}
                />
              )
            }
            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
          >
            <span className="material-symbols-outlined">add</span>
            Add Package
          </button>
        </div>

        {/* GRID */}
        {loading && (
          <p className="text-center text-secondary">
            Loading packages…
          </p>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const variants =
                pkg.package_variants
                  ?.filter((v) => v.is_active)
                  .sort((a, b) => a.price - b.price) || [];

              return (
                <div
                  key={pkg.id}
                  className="bg-card rounded-2xl border border-slate-700/20 overflow-hidden hover:shadow-xl transition flex flex-col"
                >
                  {/* CARD BODY */}
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
                            pkg.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-secondary"
                          }`}
                        >
                          {pkg.is_active ? "Active" : "Inactive"}
                        </span>
                        {pkg.is_student_offer && (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 ml-1">
                            Students Offer
                          </span>
                        )}

                        <h3 className="text-xl font-bold text-white">
                          {pkg.title}
                        </h3>
                        {pkg.is_student_offer && pkg.offer_valid_from && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Valid: {new Date(pkg.offer_valid_from).toLocaleDateString()} –{" "}
                            {new Date(pkg.offer_valid_to).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            openModal(
                              <AddPackageModal
                                mode="edit"
                                initialData={pkg}
                                onSave={fetchPackages}
                              />
                            )
                          }
                          className="p-2 text-slate-400 hover:text-primary"
                        >
                          <span className="material-symbols-outlined">
                            edit
                          </span>
                        </button>

                        <button
                          onClick={() => deletePackage(pkg)}
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <span className="material-symbols-outlined">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* VARIANTS */}
                    {variants.length ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Pricing Variants
                        </p>

                        {variants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                          >
                            <span className="text-sm font-medium text-slate-600">
                              {v.pricing_type === "duration" ? (
                                <span>
                                  {v.duration_value}{" "}
                                  {v.duration_unit === "month"
                                    ? "Months"
                                    : "Years"}
                                </span>
                              ) : (
                                <span>
                                  {Math.round(v.sessions_total / v.weekly_days / 4)} Months ·{" "}
                                  {v.weekly_days} days/week · {v.sessions_total} Sessions
                                </span>
                              )}
                            </span>
                            <span className="text-sm font-bold text-white">
                              ₹{v.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-40">
                          inventory_2
                        </span>
                        <p className="text-sm">
                          No variants added yet
                        </p>
                      </div>
                    )}
                  </div>

                  {/* CARD FOOTER */}
                  <div className="px-6 py-4 border-t bg-card-hover border-card-inner flex items-center justify-end">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pkg.is_active}
                        onChange={() => toggleStatus(pkg)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-500 peer-checked:bg-accent rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </div>
              );
            })}

            {/* ADD NEW CARD */}
            <button
              onClick={() =>
                openModal(
                  <AddPackageModal
                    mode="add"
                    onSave={fetchPackages}
                  />
                )
              }
              className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl hover:border-primary hover:bg-primary/5 transition"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined">
                  add
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Add New Package
              </h3>
              <p className="text-sm text-secondary mt-1">
                Create a new membership tier
              </p>
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default Packages;
