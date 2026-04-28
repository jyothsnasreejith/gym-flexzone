import { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

export default function PackageDistributionModal({ packages }) {
  const { closeModal } = useModal();
  const [detailedData, setDetailedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetailedPackageData = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from("members")
          .select(`
            id,
            full_name,
            phone,
            package_variant_id,
            package_variants (
              id,
              duration_value,
              duration_unit,
              pricing_type,
              price,
              packages (
                uuid,
                title
              )
            )
          `)
          .eq("status", "Active")
          .order("full_name", { ascending: true });

        if (error) throw error;

        // Group by package
        const packageMap = {};
        
        (data || []).forEach(member => {
          if (member.package_variants?.packages) {
            const pkg = member.package_variants.packages;
            const variant = member.package_variants;
            const key = pkg.uuid;
            
            if (!packageMap[key]) {
              packageMap[key] = {
                uuid: pkg.uuid,
                title: pkg.title,
                members: [],
                variants: {},
              };
            }
            
            packageMap[key].members.push({
              id: member.id,
              name: member.full_name,
              phone: member.phone,
              variantId: variant.id,
              variantLabel: formatVariant(variant),
            });

            // Count by variant
            if (!packageMap[key].variants[variant.id]) {
              packageMap[key].variants[variant.id] = {
                id: variant.id,
                label: formatVariant(variant),
                price: variant.price,
                count: 0,
              };
            }
            packageMap[key].variants[variant.id].count++;
          }
        });

        setDetailedData(Object.values(packageMap));
      } catch (err) {
        console.error("Failed to load detailed package data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDetailedPackageData();
  }, []);

  const formatVariant = (variant) => {
    if (variant.pricing_type === "duration") {
      return `${variant.duration_value} ${variant.duration_unit === "month" ? "Month" : "Year"}${variant.duration_value > 1 ? "s" : ""}`;
    } else if (variant.pricing_type === "sessions") {
      return `${variant.duration_value} Month${variant.duration_value > 1 ? "s" : ""}`;
    }
    return "Custom";
  };

  const totalMembers = detailedData.reduce((sum, pkg) => sum + pkg.members.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold">Package Distribution</h2>
            <p className="text-sm text-gray-500 mt-1">
              {totalMembers} active members across {detailedData.length} packages
            </p>
          </div>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined text-[28px]">close</span>
          </button>
        </div>

        {/* BODY */}
        <div className="px-6 py-4 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading package data...
            </div>
          ) : detailedData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No active members with packages
            </div>
          ) : (
            <div className="space-y-6">
              {detailedData.map((pkg) => (
                <div key={pkg.uuid} className="border rounded-lg overflow-hidden">
                  {/* PACKAGE HEADER */}
                  <div className="bg-primary/5 border-b px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{pkg.title}</h3>
                      <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-medium">
                        {pkg.members.length} members
                      </span>
                    </div>

                    {/* VARIANT BREAKDOWN */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {Object.values(pkg.variants).map((variant) => (
                        <div
                          key={variant.id}
                          className="px-2 py-1 bg-card border rounded text-xs"
                        >
                          <span className="font-medium">{variant.label}</span>
                          <span className="text-gray-500 ml-1">
                            ({variant.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MEMBERS LIST */}
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {pkg.members.map((member) => (
                      <div
                        key={member.id}
                        className="px-4 py-3 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">
                              {member.variantLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}