import { useEffect, useMemo, useState } from "react";
import { useModal } from "../context/ModalContext";
import { useToast } from "../context/ToastContext";
import AddOfferModal from "../modals/AddOfferModal";
import AssignOfferModal from "../modals/AssignOfferModal";
import AddCouponModal from "../modals/AddCouponModal";
import { supabase } from "../supabaseClient";

const formatDiscount = (type, value) => {
  if (!type || value == null) return "—";
  const normalized = type.toLowerCase();
  if (normalized === "percent" || normalized === "percentage") {
    return `${value}%`;
  }
  if (normalized === "flat" || normalized === "fixed") {
    return `₹${value}`;
  }
  return value;
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN");
};

const parseDate = (d) => {
  if (!d) return null;
  if (typeof d === "string" && d.includes("T")) return new Date(d);
  return new Date(`${d}T00:00:00`);
};

const getCouponStatus = (coupon) => {
  if (coupon?.is_active === false) {
    return { label: "Disabled", tone: "disabled" };
  }

  const expiry = parseDate(coupon?.expiry_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiry && expiry < today) {
    return { label: "Expired", tone: "expired" };
  }

  const usageLimit =
    coupon?.usage_limit === null || coupon?.usage_limit === undefined
      ? null
      : Number(coupon.usage_limit);
  const redeemed = Number(coupon?.times_redeemed || 0);

  if (usageLimit !== null && redeemed >= usageLimit) {
    return { label: "Fully Redeemed", tone: "redeemed" };
  }

  return { label: "Active", tone: "active" };
};

const couponStatusClasses = {
  active: "bg-green-100 text-green-700",
  expired: "bg-amber-100 text-amber-700",
  redeemed: "bg-rose-100 text-rose-700",
  disabled: "bg-gray-200 text-secondary",
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

const Offers = () => {
  const { openModal } = useModal();
  const { showToast } = useToast();

  const [offers, setOffers] = useState([]);
  const [offerCounts, setOfferCounts] = useState({});
  const [offersLoading, setOffersLoading] = useState(true);

  const [coupons, setCoupons] = useState([]);
  const [couponAssignments, setCouponAssignments] = useState({});
  const [couponLoading, setCouponLoading] = useState(true);
  const [variantMap, setVariantMap] = useState({});

  const [activeTab, setActiveTab] = useState("offers");
  const [menuOpen, setMenuOpen] = useState(null);

  const fetchOffers = async () => {
    setOffersLoading(true);
    try {
      const { data: offerData, error: offerError } = await supabase
        .from("offers")
        .select("*")
        .order("created_at", { ascending: false });

      if (offerError) throw offerError;

      const { data: assignmentData, error: assignError } = await supabase
        .from("offer_assignments")
        .select("offer_id, target_type");

      if (assignError) throw assignError;

      const map = {};
      for (const row of assignmentData || []) {
        if (!map[row.offer_id]) map[row.offer_id] = { member: 0, package: 0 };
        map[row.offer_id][row.target_type]++;
      }

      setOffers(offerData || []);
      setOfferCounts(map);
    } catch (err) {
      console.error("Offers fetch failed:", err);
      setOffers([]);
      setOfferCounts({});
    } finally {
      setOffersLoading(false);
    }
  };

  const fetchCoupons = async () => {
    setCouponLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.error("No active session - that is why you get 403!");
        setCoupons([]);
        setCouponAssignments({});
        setVariantMap({});
        return;
      }

      const [
        { data: couponData, error: couponError },
        { data: packageData, error: packageError },
      ] = await Promise.all([
        supabase.from("coupons").select("*").order("created_at", { ascending: false }),
        supabase
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
          .order("title", { ascending: true }),
      ]);

      if (couponError) throw couponError;
      if (packageError) throw packageError;

      const nextVariantMap = {};
      const packageVariantMap = {};
      (packageData || []).forEach((pkg) => {
        packageVariantMap[pkg.uuid] = [];
        (pkg.package_variants || []).forEach((variant) => {
          nextVariantMap[variant.id] = {
            packageTitle: pkg.title,
            label: formatVariantLabel(variant),
          };
          packageVariantMap[pkg.uuid].push(variant.id);
        });
      });

      const assignmentMap = {};

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("coupon_package_variants")
        .select("coupon_id, package_variant_id");
      if (assignmentError) {
        console.warn("coupon_package_variants fetch failed:", assignmentError);
      }

      const { data: legacyAssignmentData, error: legacyAssignmentError } = await supabase
        .from("coupon_packages")
        .select("coupon_id, package_variant_id");
      if (legacyAssignmentError) {
        console.warn("coupon_packages fetch failed:", legacyAssignmentError);
      }

      const rows = [
        ...(assignmentData || []),
        ...(legacyAssignmentData || []),
      ];
      for (const row of rows) {
        if (!assignmentMap[row.coupon_id]) assignmentMap[row.coupon_id] = [];
        if (
          row.package_variant_id &&
          !assignmentMap[row.coupon_id].includes(row.package_variant_id)
        ) {
          assignmentMap[row.coupon_id].push(row.package_variant_id);
        }
      }

      if (rows.length === 0) {
        const { data: packageAssignments, error: packageAssignError } = await supabase
          .from("coupon_packages")
          .select("coupon_id, package_variant_id");

        if (!packageAssignError && packageAssignments?.length) {
          packageAssignments.forEach((row) => {
            if (!assignmentMap[row.coupon_id]) assignmentMap[row.coupon_id] = [];
            if (
              row.package_variant_id &&
              !assignmentMap[row.coupon_id].includes(row.package_variant_id)
            ) {
              assignmentMap[row.coupon_id].push(row.package_variant_id);
            }
          });
        } else if (packageAssignError) {
          console.warn(
            "coupon_packages package_variant_id lookup failed:",
            packageAssignError
          );
        }
      }

      setCouponAssignments(assignmentMap);
      setVariantMap(nextVariantMap);
      setCoupons(couponData || []);
    } catch (err) {
      console.error("Coupons fetch failed:", err);
      setCoupons([]);
      setCouponAssignments({});
      setVariantMap({});
    } finally {
      setCouponLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchCoupons();
  }, []);

  const generalOffers = useMemo(
    () =>
      offers.filter((offer) => {
        if (offer.has_coupon === true) return false;
        if (offer.has_coupon === false) return true;
        return !offer.coupon_code;
      }),
    [offers]
  );

  const toggleOfferStatus = async (offer) => {
    try {
      const { error } = await supabase
        .from("offers")
        .update({ is_active: !offer.is_active })
        .eq("id", offer.id);

      if (error) throw error;
      showToast(
        `Offer ${offer.is_active ? "disabled" : "enabled"}`,
        "success"
      );
      fetchOffers();
    } catch (err) {
      console.error(err);
      showToast("Failed to update status", "error");
    }
  };

  const deleteOffer = async (offer) => {
    if (!window.confirm(`Delete offer "${offer.title}"?`)) return;

    try {
      const { error } = await supabase
        .from("offers")
        .delete()
        .eq("id", offer.id);

      if (error) throw error;
      showToast("Offer deleted successfully", "success");
      fetchOffers();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete offer", "error");
    }
  };

  const toggleCouponStatus = async (coupon) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: !coupon.is_active })
        .eq("id", coupon.id);

      if (error) throw error;
      showToast(
        `Coupon ${coupon.is_active ? "disabled" : "enabled"}`,
        "success"
      );
      fetchCoupons();
    } catch (err) {
      console.error(err);
      showToast("Failed to update coupon status", "error");
    }
  };

  const deleteCoupon = async (coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;

    try {
      await supabase
        .from("coupon_package_variants")
        .delete()
        .eq("coupon_id", coupon.id);

      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", coupon.id);

      if (error) throw error;
      showToast("Coupon deleted successfully", "success");
      fetchCoupons();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete coupon", "error");
    }
  };

  const renderActionMenu = (type, id, items) => {
    const open = menuOpen?.type === type && menuOpen?.id === id;
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() =>
            setMenuOpen(open ? null : { type, id })
          }
          className="h-8 w-8 rounded-lg border border-slate-700/20 text-secondary hover:bg-slate-800/50"
          title="Actions"
        >
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-44 bg-card border rounded-xl shadow-lg py-1 z-20">
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setMenuOpen(null);
                }}
                className={`w-full px-3 py-2 text-sm flex items-center gap-2 text-left hover:bg-slate-800/50 ${
                  item.tone === "danger" ? "text-red-600" : "text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderOffersSection = (
    <div className="bg-card rounded-2xl border">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">General Offers</h2>
          <p className="text-xs text-secondary">
            {offersLoading ? "Loading..." : `${generalOffers.length} offers`}
          </p>
        </div>
        <button
          onClick={() =>
            openModal(<AddOfferModal mode="add" onSave={fetchOffers} />)
          }
          className="px-4 h-10 rounded-lg bg-primary text-white font-bold"
        >
          + Add Offer
        </button>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-xs uppercase text-secondary">
            <tr>
              <th className="px-5 py-3 text-left">Offer</th>
              <th className="px-5 py-3 text-left">Discount</th>
              <th className="px-5 py-3 text-left">Validity</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {offersLoading && (
              <tr>
                <td colSpan="5" className="py-6 text-center text-secondary">
                  Loading offers…
                </td>
              </tr>
            )}
            {!offersLoading && generalOffers.length === 0 && (
              <tr>
                <td colSpan="5" className="py-6 text-center text-secondary">
                  No offers yet.
                </td>
              </tr>
            )}
            {!offersLoading &&
              generalOffers.map((offer) => {
                const count = offerCounts[offer.id] || {
                  member: 0,
                  package: 0,
                };
                const menuItems = [
                  {
                    label: "Assign",
                    icon: "group_add",
                    onClick: () =>
                      openModal(
                        <AssignOfferModal offer={offer} onSaved={fetchOffers} />
                      ),
                  },
                  {
                    label: "Edit",
                    icon: "edit",
                    onClick: () =>
                      openModal(
                        <AddOfferModal
                          mode="edit"
                          initialData={offer}
                          onSave={fetchOffers}
                        />
                      ),
                  },
                  {
                    label: offer.is_active ? "Disable" : "Enable",
                    icon: offer.is_active ? "toggle_off" : "toggle_on",
                    onClick: () => toggleOfferStatus(offer),
                  },
                  {
                    label: "Delete",
                    icon: "delete",
                    tone: "danger",
                    onClick: () => deleteOffer(offer),
                  },
                ];

                return (
                  <tr key={offer.id} className="hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <div className="font-medium">{offer.title}</div>
                      <div className="text-xs text-secondary mt-0.5">
                        {count.member} members · {count.package} packages
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2 py-0.5 rounded badge-info font-semibold text-sm">
                        {formatDiscount(
                          offer.discount_type,
                          offer.discount_value
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-secondary">
                      {formatDate(offer.start_date)} – {formatDate(offer.end_date)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          offer.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-secondary"
                        }`}
                      >
                        {offer.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {renderActionMenu("offer", offer.id, menuItems)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3 p-4">
        {offersLoading && (
          <div className="text-center text-secondary">Loading offers…</div>
        )}
        {!offersLoading && generalOffers.length === 0 && (
          <div className="text-center text-secondary">No offers yet.</div>
        )}
        {!offersLoading &&
          generalOffers.map((offer) => {
            const count = offerCounts[offer.id] || { member: 0, package: 0 };
            const menuItems = [
              {
                label: "Assign",
                icon: "group_add",
                onClick: () =>
                  openModal(
                    <AssignOfferModal offer={offer} onSaved={fetchOffers} />
                  ),
              },
              {
                label: "Edit",
                icon: "edit",
                onClick: () =>
                  openModal(
                    <AddOfferModal
                      mode="edit"
                      initialData={offer}
                      onSave={fetchOffers}
                    />
                  ),
              },
              {
                label: offer.is_active ? "Disable" : "Enable",
                icon: offer.is_active ? "toggle_off" : "toggle_on",
                onClick: () => toggleOfferStatus(offer),
              },
              {
                label: "Delete",
                icon: "delete",
                tone: "danger",
                onClick: () => deleteOffer(offer),
              },
            ];

            return (
              <div key={offer.id} className="border rounded-xl p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{offer.title}</div>
                    <div className="text-xs text-secondary mt-0.5">
                      {count.member} members · {count.package} packages
                    </div>
                  </div>
                  {renderActionMenu("offer", offer.id, menuItems)}
                </div>
                <div className="mt-3 text-sm text-secondary">
                  {formatDiscount(offer.discount_type, offer.discount_value)}
                </div>
                <div className="text-xs text-secondary mt-1">
                  {formatDate(offer.start_date)} – {formatDate(offer.end_date)}
                </div>
                <span
                  className={`inline-flex mt-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    offer.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-secondary"
                  }`}
                >
                  {offer.is_active ? "Active" : "Disabled"}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );

  const renderCouponsSection = (
    <div className="bg-card rounded-2xl border">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Coupon Codes</h2>
          <p className="text-xs text-secondary">
            {couponLoading ? "Loading..." : `${coupons.length} coupons`}
          </p>
        </div>
        <button
          onClick={() =>
            openModal(<AddCouponModal mode="add" onSave={fetchCoupons} />)
          }
          className="px-4 h-10 rounded-lg bg-primary text-white font-bold"
        >
          + Add Coupon
        </button>
      </div>

      {couponLoading ? (
        <div className="py-8 text-center text-secondary">Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-secondary">
          <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">
            confirmation_number
          </span>
          <div className="text-sm font-medium">No coupon codes yet</div>
          <div className="text-xs text-gray-400 mt-1">
            Create a coupon to target specific packages.
          </div>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-xs uppercase text-secondary">
                <tr>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Discount</th>
                  <th className="px-5 py-3 text-left">Applies To</th>
                  <th className="px-5 py-3 text-left">Expiry</th>
                  <th className="px-5 py-3 text-left">Usage</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  const variantIds = couponAssignments[coupon.id] || [];
                  const labels = variantIds
                    .map((id) => {
                      const variant = variantMap[id];
                      return variant
                        ? `${variant.packageTitle} · ${variant.label}`
                        : "Unknown variant";
                    })
                    .filter(Boolean);
                  const redeemed = Number(coupon.times_redeemed || 0);
                  const menuItems = [
                    {
                      label: "Edit",
                      icon: "edit",
                      onClick: () =>
                        openModal(
                          <AddCouponModal
                            mode="edit"
                            initialData={coupon}
                            onSave={fetchCoupons}
                          />
                        ),
                    },
                    {
                      label: coupon.is_active ? "Disable" : "Enable",
                      icon: coupon.is_active ? "toggle_off" : "toggle_on",
                      onClick: () => toggleCouponStatus(coupon),
                    },
                    {
                      label: "Delete",
                      icon: "delete",
                      tone: "danger",
                      onClick: () => deleteCoupon(coupon),
                    },
                  ];

                  return (
                    <tr key={coupon.id} className="hover:bg-slate-800/50">
                      <td className="px-5 py-4">
                        <span className="px-2 py-1 text-xs font-mono rounded bg-blue-100 text-blue-700">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-block px-2 py-0.5 rounded badge-info font-semibold text-sm">
                          {formatDiscount(
                            coupon.discount_type,
                            coupon.discount_value
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium">
                          {variantIds.length} variant
                          {variantIds.length !== 1 ? "s" : ""}
                        </div>
                        {labels.length > 0 && (
                          <div className="text-xs text-secondary mt-0.5">
                            {labels.slice(0, 2).join(", ")}
                            {labels.length > 2
                              ? ` +${labels.length - 2} more`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-secondary">
                        {formatDate(coupon.expiry_date)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium">
                          {redeemed} used
                        </div>
                        <div className="text-xs text-secondary">
                          {coupon.usage_limit ? `of ${coupon.usage_limit}` : "No limit"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            couponStatusClasses[status.tone]
                          }`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {renderActionMenu("coupon", coupon.id, menuItems)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3 p-4">
            {coupons.map((coupon) => {
              const status = getCouponStatus(coupon);
              const variantIds = couponAssignments[coupon.id] || [];
              const labels = variantIds
                .map((id) => {
                  const variant = variantMap[id];
                  return variant
                    ? `${variant.packageTitle} · ${variant.label}`
                    : "Unknown variant";
                })
                .filter(Boolean);
              const redeemed = Number(coupon.times_redeemed || 0);
              const menuItems = [
                {
                  label: "Edit",
                  icon: "edit",
                  onClick: () =>
                    openModal(
                      <AddCouponModal
                        mode="edit"
                        initialData={coupon}
                        onSave={fetchCoupons}
                      />
                    ),
                },
                {
                  label: coupon.is_active ? "Disable" : "Enable",
                  icon: coupon.is_active ? "toggle_off" : "toggle_on",
                  onClick: () => toggleCouponStatus(coupon),
                },
                {
                  label: "Delete",
                  icon: "delete",
                  tone: "danger",
                  onClick: () => deleteCoupon(coupon),
                },
              ];

              return (
                <div key={coupon.id} className="border rounded-xl p-4 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="px-2 py-1 text-xs font-mono rounded bg-blue-100 text-blue-700 inline-block">
                        {coupon.code}
                      </span>
                      <div className="text-sm text-secondary">
                        {formatDiscount(coupon.discount_type, coupon.discount_value)}
                      </div>
                    </div>
                    {renderActionMenu("coupon", coupon.id, menuItems)}
                  </div>

                  <div className="mt-3 text-xs text-secondary">
                    Expires {formatDate(coupon.expiry_date)}
                  </div>

                  <div className="mt-2">
                    <div className="text-sm font-medium">
                      {variantIds.length} variant
                      {variantIds.length !== 1 ? "s" : ""}
                    </div>
                    {labels.length > 0 && (
                      <div className="text-xs text-secondary mt-0.5">
                        {labels.slice(0, 2).join(", ")}
                        {labels.length > 2
                          ? ` +${labels.length - 2} more`
                          : ""}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-secondary">
                    {redeemed} used ·{" "}
                    {coupon.usage_limit ? `Limit ${coupon.usage_limit}` : "No limit"}
                  </div>

                  <span
                    className={`inline-flex mt-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      couponStatusClasses[status.tone]
                    }`}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <main
      className="flex-1 p-6 bg-navy"
      onClick={() => setMenuOpen(null)}
    >
      <div className="mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">
              Offers & Coupons
            </h1>
            <p className="text-secondary">
              Manage promotions, discounts, and targeted coupon codes.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {renderOffersSection}
          {renderCouponsSection}
        </div>
      </div>
    </main>
  );
};

export default Offers;
