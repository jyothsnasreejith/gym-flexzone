import { useEffect, useMemo, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

const DISCOUNT_TYPES = [
  { label: "Percentage (%)", value: "percent" },
  { label: "Flat Amount (₹)", value: "flat" },
];

const normalizeDiscountType = (type) => {
  if (!type) return "percent";
  if (type === "percentage") return "percent";
  if (type === "fixed") return "flat";
  return type;
};

const formatVariantLabel = (variant) => {
  if (variant.pricing_type === "duration") {
    const unitLabel = variant.duration_unit === "month" ? "Month" : "Year";
    const plural = variant.duration_value > 1 ? "s" : "";
    return `${variant.duration_value} ${unitLabel}${plural} - ₹${variant.price}`;
  }
  if (variant.pricing_type === "sessions") {
    const rawMonths =
      variant.duration_value ??
      (variant.sessions_total && variant.weekly_days
        ? Math.round(variant.sessions_total / variant.weekly_days / 4)
        : null);
    const monthsLabel = rawMonths ? `${rawMonths} Month${rawMonths > 1 ? "s" : ""}` : "Session based";
    return `${monthsLabel} · ${variant.weekly_days || "—"} days/week · ${variant.sessions_total || "—"} Sessions - ₹${variant.price}`;
  }
  return `₹${variant.price}`;
};

export default function AddCouponModal({
  mode = "add",
  initialData = {},
  onSave,
}) {
  const { closeModal } = useModal();

  const [form, setForm] = useState({
    code: initialData.code || "",
    discount_type: normalizeDiscountType(initialData.discount_type),
    discount_value: initialData.discount_value ?? "",
    expiry_date: initialData.expiry_date
      ? initialData.expiry_date.split("T")[0]
      : "",
    start_date: initialData.start_date
      ? initialData.start_date.split("T")[0]
      : new Date().toISOString().split("T")[0],
    usage_limit: initialData.usage_limit ?? "",
  });

  const [packages, setPackages] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const loadPackages = async () => {
      setLoadingPackages(true);
      try {
        const { data, error } = await supabase
          .from("packages")
          .select(
            `
            uuid,
            title,
            package_variants (
              id,
              duration_value,
              duration_unit,
              pricing_type,
              price,
              weekly_days,
              sessions_total,
              is_active
            )
          `
          )
          .eq("is_active", true)
          .order("title", { ascending: true });

        if (error) throw error;
        setPackages(data || []);
      } catch (err) {
        console.error("Failed to load packages:", err);
        setPackages([]);
      } finally {
        setLoadingPackages(false);
      }
    };

    loadPackages();
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !initialData.id) return;

    const loadAssignments = async () => {
      try {
        const { data, error } = await supabase
          .from("coupon_package_variants")
          .select("package_variant_id")
          .eq("coupon_id", initialData.id);

        if (error) throw error;
        const variantIds = (data || []).map((row) => row.package_variant_id);
        setSelectedVariants(variantIds);
      } catch (err) {
        console.error("Failed to load coupon assignments:", err);
      }
    };

    loadAssignments();
  }, [mode, initialData.id]);

  const toggleVariant = (variantId) => {
    setSelectedVariants((prev) => {
      if (prev.includes(variantId)) return prev.filter((id) => id !== variantId);
      return [...prev, variantId];
    });
  };

  const togglePackage = (pkg) => {
    const activeVariants = pkg.package_variants?.filter((v) => v.is_active) || [];
    const variantIds = activeVariants.map((v) => v.id);
    const allSelected = variantIds.every((id) => selectedVariants.includes(id));

    if (allSelected) {
      setSelectedVariants((prev) => prev.filter((id) => !variantIds.includes(id)));
    } else {
      setSelectedVariants((prev) => {
        const next = [...prev];
        variantIds.forEach((id) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const selectAll = () => {
    const allVariantIds = packages.flatMap((pkg) =>
      (pkg.package_variants?.filter((v) => v.is_active) || []).map((v) => v.id)
    );
    setSelectedVariants(allVariantIds);
  };

  const clearAll = () => setSelectedVariants([]);

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return packages;

    return packages
      .map((pkg) => {
        const matchesPackage = pkg.title?.toLowerCase().includes(q);
        const filteredVariants =
          pkg.package_variants?.filter((variant) => {
            const label = formatVariantLabel(variant);
            const searchText = `${pkg.title} ${label}`.toLowerCase();
            return searchText.includes(q);
          }) || [];

        if (!matchesPackage && filteredVariants.length === 0) return null;
        return {
          ...pkg,
          package_variants: matchesPackage ? pkg.package_variants : filteredVariants,
        };
      })
      .filter(Boolean);
  }, [packages, searchQuery]);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const code = form.code.trim().toUpperCase();
    const discountType = form.discount_type;
    const discountValue = Number(form.discount_value);
    const startDate = form.start_date;
    const expiryDate = form.expiry_date;
    const usageLimit = form.usage_limit === "" ? null : Number(form.usage_limit);

    if (!code) {
      alert("Coupon code is required");
      return;
    }
    if (code.length < 4) {
      alert("Coupon code must be at least 4 characters");
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      alert("Coupon code can only contain letters, numbers, - or _");
      return;
    }
    if (!startDate) {
      alert("Start date is required");
      return;
    }
    if (!expiryDate) {
      alert("Expiry date is required");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(expiryDate);
    if (start > end) {
      alert("Expiry date must be after start date");
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      alert("Discount value must be greater than 0");
      return;
    }
    if (discountType === "percent" && discountValue > 100) {
      alert("Percentage discount must be between 1 and 100");
      return;
    }
    if (usageLimit !== null && (!Number.isFinite(usageLimit) || usageLimit <= 0)) {
      alert("Usage limit must be a positive number");
      return;
    }
    if (selectedVariants.length === 0) {
      alert("Please select at least one package variant");
      return;
    }

    const payload = {
      code,
      discount_type: discountType,
      discount_value: discountValue,
      start_date: startDate,
      expiry_date: expiryDate,
      is_active: mode === "edit" ? initialData.is_active ?? true : true,
      usage_limit: usageLimit,
    };

    setSaving(true);

    try {
      let couponId = initialData.id;

      if (mode === "edit") {
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("coupons")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        couponId = data?.id;
      }

      if (!couponId) {
        throw new Error("Coupon ID missing after save");
      }

      const deleteFromTable = async (tableName) => {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("coupon_id", couponId);
        if (error && error.code !== "PGRST205") {
          console.warn(`Failed to clear ${tableName}:`, error);
        }
      };

      await deleteFromTable("coupon_package_variants");
      await deleteFromTable("coupon_packages");

      const assignments = selectedVariants.map((variantId) => ({
        coupon_id: couponId,
        package_variant_id: variantId,
      }));

      const tryInsert = async (tableName) => {
        const { error } = await supabase.from(tableName).insert(assignments);
        return error;
      };

      let assignError = await tryInsert("coupon_package_variants");
      if (assignError?.code === "PGRST205" || /does not exist/i.test(assignError?.message || "")) {
        assignError = await tryInsert("coupon_packages");
      }
      if (assignError) throw assignError;

      onSave?.();
      closeModal();
    } catch (err) {
      console.error("Failed to save coupon:", err);
      alert("Failed to save coupon: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-3xl bg-card rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[95vh]">
        <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-card z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold">
            {mode === "edit" ? "Edit Coupon" : "Add Coupon"}
          </h2>
          <button
            onClick={closeModal}
            className="text-gray-500 text-xl leading-none hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="px-4 sm:px-6 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Coupon Code (e.g. FIT20)"
              value={form.code}
              onChange={(e) =>
                update("code", e.target.value.toUpperCase().replace(/\s/g, ""))
              }
              className="w-full border rounded-lg px-3 py-2 font-mono tracking-wide"
              required
            />
            <div className="space-y-1">
              <label className="text-xs text-white ml-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white ml-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => update("expiry_date", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className="w-full border rounded-lg px-3 py-2 bg-card text-white"
              value={form.discount_type}
              onChange={(e) => update("discount_type", e.target.value)}
            >
              {DISCOUNT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder={
                form.discount_type === "percent" ? "Discount %" : "Amount (₹)"
              }
              className="w-full border rounded-lg px-3 py-2 bg-card text-white"
              value={form.discount_value}
              onChange={(e) => update("discount_value", e.target.value)}
              required
            />
          </div>

          <input
            type="number"
            placeholder="Usage limit (optional)"
            value={form.usage_limit}
            onChange={(e) => update("usage_limit", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-card text-white"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">
                Applicable Package Variants *
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-gray-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full border rounded-lg px-3 py-2 text-left flex items-center justify-between"
            >
              <span className="text-sm text-white">
                {selectedVariants.length === 0
                  ? "Select packages or variants"
                  : `${selectedVariants.length} variant${selectedVariants.length !== 1 ? "s" : ""
                  } selected`}
              </span>
              <span className="material-symbols-outlined text-[20px] text-gray-500">
                expand_more
              </span>
            </button>

            {dropdownOpen && (
              <div className="border rounded-lg bg-card shadow-inner p-3 space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search packages or variants"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                {loadingPackages ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    Loading packages...
                  </div>
                ) : filteredPackages.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No packages found
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto border rounded-lg">
                    {filteredPackages.map((pkg) => {
                      const activeVariants =
                        pkg.package_variants?.filter((v) => v.is_active) || [];
                      if (activeVariants.length === 0) return null;

                      const variantIds = activeVariants.map((v) => v.id);
                      const allSelected = variantIds.every((id) =>
                        selectedVariants.includes(id)
                      );
                      const someSelected = variantIds.some((id) =>
                        selectedVariants.includes(id)
                      );

                      return (
                        <div key={pkg.uuid} className="border-b last:border-b-0">
                          <div className="bg-card px-4 py-3 flex items-center gap-3 sticky top-0 z-0">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(input) => {
                                if (input) input.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={() => togglePackage(pkg)}
                              className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                            <div className="flex-1 font-semibold text-sm text-white">
                              {pkg.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {activeVariants.length} variant
                              {activeVariants.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="divide-y">
                            {activeVariants.map((variant) => {
                              const isSelected = selectedVariants.includes(variant.id);
                              return (
                                <label
                                  key={variant.id}
                                  className={`flex items-center gap-3 px-4 py-3 pl-12 cursor-pointer hover:bg-gray-50 transition ${isSelected ? "bg-blue-50/50" : ""
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleVariant(variant.id)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <div className="flex-1 text-sm">
                                    {formatVariantLabel(variant)}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedVariants.length > 0 && (
                  <div className="text-xs text-blue-800 bg-blue-50 rounded px-3 py-2 border border-blue-100">
                    ✓ {selectedVariants.length} variant
                    {selectedVariants.length !== 1 ? "s" : ""} selected
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={closeModal}
            className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving..." : "Save Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}
