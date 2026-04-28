import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../context/ToastContext";

// ─── helpers ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const calcEndDate = (startDate, variant) => {
  if (!variant || variant.pricing_type !== "duration") return null;
  const base = new Date(startDate);
  const val = Number(variant.duration_value || 0);
  const unit = (variant.duration_unit || "").toLowerCase();
  if (unit === "month") base.setMonth(base.getMonth() + val);
  else if (unit === "year") base.setFullYear(base.getFullYear() + val);
  else if (unit === "day" || unit === "days") base.setDate(base.getDate() + val);
  return base.toISOString().slice(0, 10);
};

const calcAddOnEndDate = (startDate, addon) => {
  if (!addon?.duration_value || !addon?.duration_unit) return startDate;
  const base = new Date(startDate);
  const val = Number(addon.duration_value || 0);
  const unit = (addon.duration_unit || "").toLowerCase();
  if (unit === "month") base.setMonth(base.getMonth() + val);
  else if (unit === "year") base.setFullYear(base.getFullYear() + val);
  else if (unit === "day" || unit === "days") base.setDate(base.getDate() + val);
  return base.toISOString().slice(0, 10);
};

const fmt = (dateStr) =>
  dateStr ? new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// ─── sub-components ──────────────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="bg-card rounded-xl border p-5 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-secondary flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function RenewMember() {
  const { id } = useParams();
  const memberId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // ── remote data ──
  const [member, setMember] = useState(null);
  const [packages, setPackages] = useState([]);
  const [allAddOns, setAllAddOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── selections ──
  const [selectedVariantId, setSelectedVariantId] = useState(""); // string
  const [selectedAddOnIds, setSelectedAddOnIds] = useState(new Set()); // Set<string>
  const [addOnDates, setAddOnDates] = useState({}); // { [id]: { start_date, end_date } }

  // ── derived: find selected variant object ──
  const selectedVariant = useMemo(() => {
    for (const pkg of packages) {
      const v = (pkg.package_variants || []).find((v) => String(v.id) === String(selectedVariantId));
      if (v) return { ...v, _pkg: pkg };
    }
    return null;
  }, [packages, selectedVariantId]);

  const newEndDate = useMemo(
    () => (selectedVariant ? calcEndDate(today(), selectedVariant) : null),
    [selectedVariant]
  );

  const packageDurationLabel = useMemo(() => {
    if (!selectedVariant) return "";
    if (selectedVariant.pricing_type === "duration") {
      const unit = selectedVariant.duration_unit === "month" ? "month" : "year";
      return `${selectedVariant.duration_value} ${unit}${Number(selectedVariant.duration_value || 0) > 1 ? "s" : ""}`;
    }
    if (selectedVariant.pricing_type === "sessions") {
      return `${selectedVariant.duration_value} month${Number(selectedVariant.duration_value || 0) > 1 ? "s" : ""} · ${selectedVariant.weekly_days} days/week · ${selectedVariant.sessions_total} sessions`;
    }
    return "Session based";
  }, [selectedVariant]);

  const packagePrice = selectedVariant ? Number(selectedVariant.price || 0) : 0;
  const addOnTotal = useMemo(() => {
    let sum = 0;
    for (const id of selectedAddOnIds) {
      const ao = allAddOns.find((a) => String(a.id) === String(id));
      if (ao) sum += Number(ao.amount || 0);
    }
    return sum;
  }, [selectedAddOnIds, allAddOns]);
  const grandTotal = packagePrice + addOnTotal;

  const selectedAddOnDetails = useMemo(() => {
    return [...selectedAddOnIds].map((id) => {
      const addon = allAddOns.find((a) => String(a.id) === String(id));
      const dates = addOnDates[String(id)] || {};
      const durationLabel =
        addon?.duration_value && addon?.duration_unit
          ? `${addon.duration_value} ${addon.duration_unit}`
          : "Custom";
      return {
        id,
        name: addon?.name || "Add-On",
        price: Number(addon?.amount || 0),
        durationLabel,
        expiry: dates.end_date || "—",
      };
    });
  }, [selectedAddOnIds, allAddOns, addOnDates]);

  // ─── LOAD ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Number.isFinite(memberId)) return;

    const load = async () => {
      setLoading(true);

      // 1. Member basics
      const { data: m, error: mErr } = await supabase
        .from("members")
        .select("id, full_name, phone, email, end_date, package_variant_id, joining_date")
        .eq("id", memberId)
        .single();

      if (mErr || !m) {
        showToast("Failed to load member", "error");
        navigate(-1);
        return;
      }
      setMember(m);

      // 2. Existing add-ons
      const { data: mao } = await supabase
        .from("member_add_ons")
        .select("add_on_id, start_date, end_date")
        .eq("member_id", memberId);

      const existingIds = new Set((mao || []).map((r) => String(r.add_on_id)));
      setSelectedAddOnIds(existingIds);

      // Pre-fill add-on dates with fresh dates from today
      const initDates = {};
      for (const row of mao || []) {
        initDates[String(row.add_on_id)] = {
          start_date: today(),
          end_date: row.end_date || today(),
        };
      }
      setAddOnDates(initDates);

      // 3. Packages
      const { data: pkgs } = await supabase
        .from("packages")
        .select(
          "id, title, is_student_offer, package_variants(id, price, pricing_type, duration_value, duration_unit, weekly_days, sessions_total, is_active)"
        )
        .eq("is_active", true);
      setPackages(pkgs || []);

      // Set current package variant as pre-selected
      if (m.package_variant_id) {
        setSelectedVariantId(String(m.package_variant_id));
      }

      // 4. Add-ons list
      const { data: aos } = await supabase
        .from("add_ons")
        .select("id, name, amount, duration_value, duration_unit, is_active")
        .order("created_at", { ascending: false });
      setAllAddOns(aos || []);

      // Refresh add-on end dates now that we have addon metadata
      const refreshedDates = {};
      for (const row of mao || []) {
        const ao = (aos || []).find((a) => String(a.id) === String(row.add_on_id));
        const start = today();
        const end = ao ? calcAddOnEndDate(start, ao) : (row.end_date || today());
        refreshedDates[String(row.add_on_id)] = { start_date: start, end_date: end };
      }
      setAddOnDates(refreshedDates);

      setLoading(false);
    };

    load();
  }, [memberId]);

  // ─── TOGGLE ADD-ON ────────────────────────────────────────────────────────────
  const toggleAddOn = (addonId, addonMeta) => {
    const key = String(addonId);
    setSelectedAddOnIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setAddOnDates((d) => { const { [key]: _, ...rest } = d; return rest; });
      } else {
        next.add(key);
        const start = today();
        const end = calcAddOnEndDate(start, addonMeta);
        setAddOnDates((d) => ({ ...d, [key]: { start_date: start, end_date: end } }));
      }
      return next;
    });
  };

  const updateAddOnStartDate = (key, newStart, addonMeta) => {
    const end = calcAddOnEndDate(newStart, addonMeta);
    setAddOnDates((d) => ({ ...d, [key]: { start_date: newStart, end_date: end } }));
  };

  // ─── SUBMIT ──────────────────────────────────────────────────────────────────
  const handleRenew = async () => {
    if (saving) return;

    if (!selectedVariantId && selectedAddOnIds.size === 0) {
      showToast("Please select a package or at least one add-on.", "error");
      return;
    }

    setSaving(true);
    try {
      const todayStr = today();
      const newVariantId = selectedVariantId ? Number(selectedVariantId) : null;

      // 0. Archive ALL previous current bills [FRESH START FOR NEW CYCLE]
      await supabase
        .from("bills")
        .update({ is_current: false })
        .eq("member_id", memberId)
        .eq("is_current", true);

      // 1. Recalculate end_date
      let endDate = null;
      if (selectedVariant && selectedVariant.pricing_type === "duration") {
        endDate = calcEndDate(todayStr, selectedVariant);
      }

      // 1.1 Calculate max end_date across package and all add-ons
      let maxTotalEndDate = endDate;
      for (const aoId in addOnDates) {
        if (!selectedAddOnIds.has(String(aoId))) continue;
        const aoEnd = addOnDates[aoId]?.end_date;
        if (aoEnd && (!maxTotalEndDate || aoEnd > maxTotalEndDate)) {
          maxTotalEndDate = aoEnd;
        }
      }

      // 2. Update members table
      const { error: memberErr } = await supabase
        .from("members")
        .update({
          package_variant_id: newVariantId,
          status: "Active",
          ...(maxTotalEndDate ? { end_date: maxTotalEndDate } : {}),
        })
        .eq("id", memberId);

      if (memberErr) throw new Error("Failed to update member: " + memberErr.message);

      // 3. Assign to member_packages via RPC (same as EditMember)
      if (newVariantId) {
        const { error: assignError } = await supabase.rpc("assign_member_package", {
          p_member_id: memberId,
          p_package_variant_id: newVariantId,
          p_start_date: todayStr,
        });
        if (assignError) {
          console.error("assign_member_package error:", assignError);
          // non-fatal — continue
        }
      }

      // 5. Re-insert member_add_ons with fresh dates
      await supabase.from("member_add_ons").delete().eq("member_id", memberId);

      const addOnIdArr = [...selectedAddOnIds];
      if (addOnIdArr.length > 0) {
        const rows = addOnIdArr.map((aoId) => ({
          member_id: memberId,
          add_on_id: aoId,
          start_date: addOnDates[aoId]?.start_date || todayStr,
          end_date: addOnDates[aoId]?.end_date || todayStr,
        }));
        const { error: aoErr } = await supabase.from("member_add_ons").insert(rows);
        if (aoErr) console.error("member_add_ons insert failed:", aoErr);
      }

      // 6. Create renewal bill (Combined - Unpaid)
      const addOnNamesStr = selectedAddOnDetails.map(a => a.name).join(", ");
      const pkgTitle = selectedVariant?._pkg?.title || "Package";
      const notes = `${pkgTitle}${addOnNamesStr ? " + " + addOnNamesStr : ""} renewed.`;

      await supabase.from("bills").insert({
        member_id: memberId,
        package_id: selectedVariant?._pkg?.id || null,
        package_variant_id: newVariantId,
        base_amount: grandTotal,
        payable_amount: grandTotal,
        amount: 0,
        discount_amount: 0,
        payment_status: "unpaid",
        bill_type: "package",
        billing_date: todayStr,
        due_date: todayStr,
        is_current: true,
        notes: notes,
      });

      showToast("Membership renewed successfully!", "success");
      navigate("/billing", { state: { memberId } });
    } catch (err) {
      console.error("Renewal failed:", err);
      showToast(err.message || "Renewal failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-secondary animate-pulse">Loading renewal details…</div>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-800/30 transition"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Renew Membership</h1>
          <p className="text-sm text-secondary mt-0.5">
            {member.full_name} · {member.phone || "—"}
          </p>
        </div>
      </div>

      {/* CURRENT STATUS BANNER */}
      <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-red-400">event_busy</span>
          <div>
            <p className="text-sm font-semibold text-red-300">
              {member.end_date && new Date(member.end_date) < new Date()
                ? "Membership Expired"
                : "Membership Active"}
            </p>
            <p className="text-xs text-red-400">
              {member.end_date ? `Expired on ${fmt(member.end_date)}` : "No expiry date set"}
            </p>
          </div>
        </div>
        {newEndDate && (
          <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/40 rounded-lg px-4 py-2">
            <span className="material-symbols-outlined text-green-400 text-[18px]">event_available</span>
            <div>
              <p className="text-xs text-green-300 font-medium">New Expiry</p>
              <p className="text-sm font-bold text-green-200">{fmt(newEndDate)}</p>
            </div>
          </div>
        )}
      </div>

      {/* PACKAGE SELECTION */}
      <Section title="Choose Package" icon="card_membership">
        {packages.length === 0 ? (
          <p className="text-sm text-gray-400">No packages available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const isSelected = (pkg.package_variants || []).some(
                (v) => String(v.id) === String(selectedVariantId)
              );
              return (
                <div
                  key={pkg.id}
                  className={`rounded-xl overflow-hidden transition-all ${
                    isSelected
                      ? "border-2 border-primary shadow-lg shadow-primary/10"
                      : "border border-slate-700/20 hover:border-primary/50"
                  }`}
                >
                  {/* card header */}
                  <div
                    className={`px-4 py-3 text-center font-bold text-sm ${
                      isSelected ? "bg-primary text-white" : "bg-card text-white"
                    }`}
                  >
                    {pkg.title}
                    {pkg.is_student_offer && (
                      <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-yellow-400 text-yellow-900 border border-yellow-500/30 shadow-sm">
                        Students Offer
                      </span>
                    )}
                  </div>

                  {/* variants */}
                  <div className="p-3 space-y-2">
                    {(pkg.package_variants || [])
                      .filter((v) => v.is_active)
                      .map((v) => {
                        const checked = String(selectedVariantId) === String(v.id);
                        return (
                          <label
                            key={v.id}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition ${
                              checked
                                ? "border-primary bg-primary/5"
                                : "border-transparent hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {v.pricing_type === "duration" && (
                                  <>
                                    {v.duration_value}{" "}
                                    {v.duration_unit === "month" ? "Month" : "Year"}
                                    {v.duration_value > 1 ? "s" : ""}
                                  </>
                                )}
                                {v.pricing_type === "sessions" && (
                                  <>
                                    {v.duration_value} Month{v.duration_value > 1 ? "s" : ""} ·{" "}
                                    {v.weekly_days} days/week · {v.sessions_total} Sessions
                                  </>
                                )}
                              </span>
                              <span className="text-sm font-semibold text-white">₹{v.price}</span>
                            </div>
                            <input
                              type="radio"
                              name="package_variant"
                              checked={checked}
                              onClick={() => {
                                if (checked) setSelectedVariantId(""); // deselect
                              }}
                              onChange={() => {
                                if (!checked) setSelectedVariantId(String(v.id));
                              }}
                              className="text-primary focus:ring-primary"
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ADD-ON SELECTION */}
      {allAddOns.length > 0 && (
        <Section title="Add-Ons" icon="extension">
          <div className="space-y-3">
            {allAddOns
              .filter((a) => a.is_active !== false || selectedAddOnIds.has(String(a.id)))
              .map((addon) => {
                const key = String(addon.id);
                const checked = selectedAddOnIds.has(key);
                const dates = addOnDates[key] || {};
                return (
                  <div key={addon.id} className="rounded-lg border overflow-hidden">
                    <label
                      className={`flex items-center justify-between p-3 cursor-pointer transition ${
                        checked ? "border-primary bg-primary/5" : "bg-slate-800/50 hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{addon.name}</span>
                        <span className="text-xs text-secondary">
                          {addon.duration_value} {addon.duration_unit} · ₹
                          {Number(addon.amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddOn(addon.id, addon)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </label>

                    {checked && (
                      <div className="px-3 py-2 bg-card border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-secondary block mb-1">Start Date</label>
                          <input
                            type="date"
                            value={dates.start_date || ""}
                            onChange={(e) => updateAddOnStartDate(key, e.target.value, addon)}
                            className="w-full h-9 border rounded-lg px-2 text-sm bg-card text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-secondary block mb-1">
                            Expiry Date (auto-calculated)
                          </label>
                          <input
                            type="date"
                            value={dates.end_date || ""}
                            readOnly
                            disabled
                            className="w-full h-9 border rounded-lg px-2 text-sm bg-slate-700 text-secondary cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {/* FEE SUMMARY */}
      {(selectedVariantId || selectedAddOnIds.size > 0) && (
        <div className="bg-gradient-to-br from-primary/5 to-navy border border-primary/20 rounded-xl px-5 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-secondary mb-3">
            Fee Summary
          </h3>
          <div className="space-y-3 text-sm">
            {selectedVariantId && (
              <div className="rounded-lg border border-slate-700/20 bg-card p-3">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">
                    {selectedVariant?._pkg?.title || "Package"}
                  </span>
                  <span className="font-semibold">Rs.{packagePrice.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-xs text-secondary mt-1">
                  Duration: {packageDurationLabel || "—"}
                </div>
                <div className="text-xs text-secondary">
                  Expiry: {newEndDate ? fmt(newEndDate) : "—"}
                </div>
              </div>
            )}

            {selectedAddOnDetails.length > 0 && (
              <div className="space-y-2">
                {selectedAddOnDetails.map((addon) => (
                  <div key={addon.id} className="rounded-lg border border-slate-700/20 bg-card p-3">
                    <div className="flex items-center justify-between text-white">
                      <span className="font-semibold">{addon.name}</span>
                      <span className="font-semibold">Rs.{addon.price.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-xs text-secondary mt-1">
                      Duration: {addon.durationLabel}
                    </div>
                    <div className="text-xs text-secondary">
                      Expiry: {addon.expiry !== "—" ? fmt(addon.expiry) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-white border-t pt-2 mt-2">
              <span>Total (outstanding)</span>
              <span className="text-primary">Rs.{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Collect payment from the Fees section to generate the bill.
          </p>
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 pb-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 border rounded-xl text-sm font-medium text-white hover:bg-slate-800/50 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleRenew}
          disabled={saving || (!selectedVariantId && selectedAddOnIds.size === 0)}
          className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              Renewing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">sync</span>
              Renew Membership
            </>
          )}
        </button>
      </div>
    </div>
  );
}
