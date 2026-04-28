import { useEffect, useState, useMemo, useRef } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

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

const toDateInputValue = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export default function AssignPackageAndAddOnsModal({ isOpen, onClose, memberId, onSuccess }) {
  const [activeTab, setActiveTab] = useState("package");
  const [targets, setTargets] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [packageQuery, setPackageQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState(null);

  const [addOnOptions, setAddOnOptions] = useState([]);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState([]);
  const [addOnDates, setAddOnDates] = useState({});
  const [initialAddOnIds, setInitialAddOnIds] = useState([]);

  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !memberId) return;
    dataLoadedRef.current = false;

    const loadData = async () => {
      setLoading(true);

      const { data: mData, error: mErr } = await supabase
        .from("members")
        .select("id, full_name, package_variant_id")
        .eq("id", memberId)
        .single();

      if (mErr) {
        console.error("LOAD MEMBER ERROR:", mErr);
        onClose?.();
        return;
      }
      setMember(mData);
      setSelectedVariantId(mData.package_variant_id || "");

      const { data: pkgData } = await supabase
        .from("packages")
        .select(`
          id,
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
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (pkgData) {
        const rows = [];
        pkgData.forEach((pkg) => {
          (pkg.package_variants || [])
            .filter((v) => v.is_active)
            .forEach((v) => {
              const label = formatVariantLabel(v);
              rows.push({
                id: v.id,
                package_id: pkg.id,
                title: pkg.title,
                subtitle: label,
                price: v.price || 0,
                searchText: `${pkg.title} ${label}`,
              });
            });
        });
        setTargets(rows);
      }

      const { data: aoData, error: aoErr } = await supabase
        .from("add_ons")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      setAddOnOptions(aoData || []);

      const { data: existingAo } = await supabase
        .from("member_add_ons")
        .select("add_on_id, start_date, end_date")
        .eq("member_id", memberId);

      if (existingAo) {
        const ids = existingAo.map(r => String(r.add_on_id));
        const dates = {};
        existingAo.forEach(row => {
          const id = String(row.add_on_id);
          dates[id] = {
            start_date: toDateInputValue(row.start_date || new Date()),
            end_date: toDateInputValue(row.end_date)
          };
        });
        if (!dataLoadedRef.current) {
          setSelectedAddOnIds(ids);
        }
        setInitialAddOnIds([...ids]);
        setAddOnDates(prev => ({ ...dates, ...prev }));
        dataLoadedRef.current = true;
      }

      setLoading(false);
    };

    loadData();
  }, [isOpen, memberId]);

  const toggleAddOn = (id) => {
    if (!id) return;
    const key = String(id);

    setSelectedAddOnIds(prev => {
      const isSelected = prev.includes(key);
      let next;
      if (isSelected) {
        next = prev.filter(x => x !== key);
      } else {
        next = [...prev, key];
        if (!addOnDates[key]) {
          const addon = addOnOptions.find(a => String(a.id) === key);
          const today = new Date();
          const start = toDateInputValue(today);
          let end = start;

          if (addon?.duration_value && addon?.duration_unit) {
            const d = new Date(today);
            const val = Number(addon.duration_value);
            const unit = addon.duration_unit.toLowerCase();
            if (unit === "month") d.setMonth(d.getMonth() + val);
            else if (unit === "year") d.setFullYear(d.getFullYear() + val);
            else d.setDate(d.getDate() + val);
            end = toDateInputValue(d);
          }
          setAddOnDates(prevDates => ({ ...prevDates, [key]: { start_date: start, end_date: end } }));
        }
      }
      return next;
    });
  };

  const updateAddOnDate = (id, field, value) => {
    setAddOnDates(prev => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], [field]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      let packageChanged = false;
      let addOnsChanged = false;

      packageChanged = String(selectedVariantId || "") !== String(member.package_variant_id || "");

      const currentIds = [...selectedAddOnIds].sort();
      const startingIds = [...initialAddOnIds].sort();
      if (JSON.stringify(currentIds) !== JSON.stringify(startingIds)) {
        addOnsChanged = true;
      }

      if (!packageChanged && !addOnsChanged) {
        onClose?.();
        return;
      }

      // --- PACKAGE UPDATE ---
      if (packageChanged) {
        const selectedVariant = targets.find(t => String(t.id) === String(selectedVariantId));

        let newExpiryDate = null;
        if (selectedVariantId) {
          const { data: variantData } = await supabase
            .from("package_variants")
            .select("duration_value, duration_unit, pricing_type")
            .eq("id", selectedVariantId)
            .single();

          if (variantData && variantData.pricing_type === "duration") {
            const { duration_value, duration_unit } = variantData;
            const expiry = new Date(today);
            const value = Number(duration_value || 0);
            if (duration_unit === "month") expiry.setMonth(expiry.getMonth() + value);
            else if (duration_unit === "year") expiry.setFullYear(expiry.getFullYear() + value);
            else expiry.setDate(expiry.getDate() + value);
            newExpiryDate = expiry.toISOString().slice(0, 10);
          }
        }

        const { error: memberErr } = await supabase
          .from("members")
          .update({
            package_variant_id: selectedVariantId ? Number(selectedVariantId) : null,
            end_date: newExpiryDate
          })
          .eq("id", member.id);
        if (memberErr) throw memberErr;

        if (selectedVariantId) {
          await supabase.from("member_packages").insert({
            member_id: member.id,
            package_id: selectedVariant?.package_id,
            start_date: today,
            end_date: newExpiryDate,
            status: "active"
          });
        }

        // Archive only unpaid package bills when package changes
        const { data: unpaidPackageBills } = await supabase
          .from("bills")
          .select("id")
          .eq("member_id", member.id)
          .eq("bill_type", "package")
          .eq("is_current", true)
          .eq("payment_status", "unpaid");

        const unpaidPackageIds = (unpaidPackageBills || []).map(b => b.id);
        if (unpaidPackageIds.length > 0) {
          await supabase
            .from("bills")
            .update({ is_current: false })
            .in("id", unpaidPackageIds);
        }
      }

      // --- ADD-ONS UPDATE ---
      if (addOnsChanged) {
        const addedIds = selectedAddOnIds.filter(id => !initialAddOnIds.includes(id));
        const removedIds = initialAddOnIds.filter(id => !selectedAddOnIds.includes(id));

        // Delete existing add-on assignments
        await supabase.from("member_add_ons").delete().eq("member_id", member.id);

        // Insert updated add-on assignments
        const rows = selectedAddOnIds.map(id => ({
          member_id: member.id,
          add_on_id: String(id),
          start_date: addOnDates[String(id)]?.start_date || null,
          end_date: addOnDates[String(id)]?.end_date || null
        }));

        const validRows = rows.filter(r => r.add_on_id);

        if (validRows.length > 0) {
          const { error } = await supabase
            .from("member_add_ons")
            .insert(validRows);
          if (error) throw error;
        }

        // If add-ons were removed, archive their unpaid bills
        if (removedIds.length > 0) {
          const { data: unpaidAoBills } = await supabase
            .from("bills")
            .select("id")
            .eq("member_id", member.id)
            .eq("bill_type", "add_on")
            .eq("is_current", true)
            .eq("payment_status", "unpaid");

          const unpaidAoIds = (unpaidAoBills || []).map(b => b.id);
          if (unpaidAoIds.length > 0) {
            await supabase
              .from("bills")
              .update({ is_current: false })
              .in("id", unpaidAoIds);
          }
        }

        // Create a bill ONLY for newly added add-ons
        // KEY FIX: check if an unpaid bill for these add-ons already exists
        // to prevent duplicates if the modal is saved multiple times
        if (addedIds.length > 0) {
          const addedItems = addedIds
            .map(id => addOnOptions.find(a => String(a.id) === String(id)))
            .filter(Boolean);
          const newAddOnAmount = addedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          const addonNames = addedItems.map(a => a.name).join(", ");

          if (newAddOnAmount > 0) {
            const billDate = today;

            // Check for existing unpaid add-on bill with same amount to avoid duplicates
            const { data: existingUnpaidAo } = await supabase
              .from("bills")
              .select("id, base_amount")
              .eq("member_id", member.id)
              .eq("bill_type", "add_on")
              .eq("is_current", true)
              .eq("payment_status", "unpaid")
              .eq("base_amount", newAddOnAmount);

            // Only create if no matching unpaid bill exists
            if (!existingUnpaidAo || existingUnpaidAo.length === 0) {
              const { error: billError } = await supabase.from("bills").insert({
                member_id: member.id,
                bill_type: "add_on",
                base_amount: newAddOnAmount,
                discount_amount: 0,
                amount: newAddOnAmount,
                payable_amount: newAddOnAmount,
                payment_status: "unpaid",
                payment_mode: null,
                billing_date: billDate,
                due_date: billDate,
                is_current: true,
                // Use "Add-ons:" prefix so Fees.jsx can parse the name correctly
                notes: `Add-ons: ${addonNames}`,
              });
              if (billError) throw billError;
            }
          }
        }
      }

      await onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error("SAVE FAILED:", err);
      alert(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const filteredTargets = targets.filter((t) =>
    t.searchText?.toLowerCase().includes(packageQuery.trim().toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card rounded-xl shadow-xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="px-5 py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold truncate">Package & Add-Ons — {member?.full_name || "..."}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("package")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "package" ? "border-primary text-primary bg-primary/5" : "border-transparent text-gray-500 hover:bg-gray-50"
            }`}
          >
            Membership Package
          </button>
          <button
            onClick={() => setActiveTab("addons")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "addons" ? "border-primary text-primary bg-primary/5" : "border-transparent text-gray-500 hover:bg-gray-50"
            }`}
          >
            Add-Ons
          </button>
        </div>

        {/* BODY */}
        <div className="px-5 py-4 overflow-y-auto flex-1 h-96">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading details...</div>
          ) : activeTab === "package" ? (
            <div className="space-y-4">
              <input
                type="text"
                value={packageQuery}
                onChange={(e) => setPackageQuery(e.target.value)}
                placeholder="Search packages..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-card text-white"
              />
              <div className="border rounded-lg divide-y overflow-hidden bg-gray-50">
                {filteredTargets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      const strId = String(t.id);
                      const currentId = String(selectedVariantId || "");
                      if (strId === currentId) {
                        setSelectedVariantId("");
                      } else {
                        setSelectedVariantId(t.id);
                      }
                    }}
                    className={`p-3 cursor-pointer transition-colors ${
                      String(selectedVariantId) === String(t.id) ? "bg-card border-l-4 border-primary shadow-sm" : "hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{t.title}</div>
                      {String(selectedVariantId) === String(t.id) && (
                        <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Selected</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.subtitle}</div>
                  </div>
                ))}
                {filteredTargets.length === 0 && <div className="p-4 text-center text-sm text-gray-400">No packages found</div>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {addOnOptions.map((ao) => {
                const strId = String(ao.id);
                const isSelected = selectedAddOnIds.includes(strId);
                const dates = addOnDates[strId] || {};

                return (
                  <div
                    key={ao.id}
                    onClick={() => toggleAddOn(ao.id)}
                    className={`border rounded-xl p-3 transition-all cursor-pointer ${
                      isSelected ? "border-primary bg-primary/5 shadow-md" : "border-gray-200 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 h-6 w-6 rounded-md border flex items-center justify-center transition-all ${
                          isSelected ? "bg-primary border-primary shadow-sm" : "border-gray-300 bg-card"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold text-gray-900">{ao.name}</div>
                          {isSelected && (
                            <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Selected</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">₹{ao.amount} · {ao.duration_value} {ao.duration_unit}</div>

                        {isSelected && (
                          <div
                            className="mt-3 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Start Date</label>
                              <input
                                type="date"
                                value={dates.start_date || ""}
                                onChange={(e) => updateAddOnDate(ao.id, "start_date", e.target.value)}
                                className="w-full text-xs border rounded-md px-2 py-1.5 focus:border-primary outline-none bg-card text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">End Date</label>
                              <input
                                type="date"
                                value={dates.end_date || ""}
                                onChange={(e) => updateAddOnDate(ao.id, "end_date", e.target.value)}
                                className="w-full text-xs border rounded-md px-2 py-1.5 focus:border-primary outline-none bg-card text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {addOnOptions.length === 0 && <div className="text-center text-sm text-gray-400 py-10">No active add-ons available</div>}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
          <button
            disabled={saving || loading || (!selectedVariantId && selectedAddOnIds.length === 0)}
            onClick={handleSave}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all transform active:scale-95"
          >
            {saving ? "Saving Changes..." : "Save Selection"}
          </button>
        </div>
      </div>
    </div>
  );
}