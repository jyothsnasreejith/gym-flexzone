import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";
import { openEmailClient, openWhatsAppClient } from "../utils/communicationHelpers";

export default function ExpiredMembersModal({ emailTemplates = [] }) {
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const [expiredMembers, setExpiredMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExpiredMembers = async () => {
      try {
        setLoading(true);

        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Helper to compute expiry date from joining_date (same as MembersList)
        const computeExpiryDate = (member) => {
          const variant = member.package_variants;
          if (!variant || variant.pricing_type !== "duration") return null;

          const baseDate = member.joining_date || member.created_at;
          if (!baseDate) return null;

          const start = new Date(baseDate);
          const unit = variant.duration_unit?.toLowerCase();
          const value = Number(variant.duration_value || 0);
          if (!value || !unit) return null;

          const expiry = new Date(start);
          if (unit === "month") {
            expiry.setMonth(expiry.getMonth() + value);
          } else if (unit === "year") {
            expiry.setFullYear(expiry.getFullYear() + value);
          } else if (unit === "day" || unit === "days") {
            expiry.setDate(expiry.getDate() + value);
          } else {
            return null;
          }
          return expiry.toISOString().slice(0, 10);
        };

        // 1. Get all members with packages - NO FILTERS
        const { data: pkgMembers } = await supabase
          .from("members")
          .select(
            `id,full_name,phone,email,joining_date,created_at,package_variant_id,package_variants(id,duration_value,duration_unit,pricing_type,price,packages(title))`
          )
          .eq("is_deleted", false);

        // Filter to expired based on computed expiry
        const memberMap = {};
        (pkgMembers || []).forEach(member => {
          const computedExpiry = computeExpiryDate(member);
          if (!computedExpiry) return;
          
          const expDate = new Date(computedExpiry);
          expDate.setHours(0, 0, 0, 0);
          
          if (expDate < todayDate) {
            const daysSinceExpiry = Math.floor((todayDate - expDate) / (1000 * 60 * 60 * 24));
            memberMap[member.id] = {
              ...member,
              end_date: computedExpiry,
              daysSinceExpiry,
              expiredAddOns: [],
            };
          }
        });

        // 2. Add-on-expired members from member_add_ons
        const { data: aoData, error: aoError } = await supabase
          .from("member_add_ons")
          .select(`
            member_id,
            end_date,
            add_ons ( name )
          `)
          .lt("end_date", today)
          .not("end_date", "is", null);

        if (aoError) {
          console.warn("Failed to load add-on expiries:", aoError.message);
        } else {
          // Group expired add-ons by member_id
          const expiredAddOnsByMember = {};
          (aoData || []).forEach(row => {
            if (!expiredAddOnsByMember[row.member_id]) {
              expiredAddOnsByMember[row.member_id] = [];
            }
            expiredAddOnsByMember[row.member_id].push({
              name: row.add_ons?.name || "Add-on",
              end_date: row.end_date,
            });
          });

          // For members not already in the map (no package expiry), fetch their details
          const addOnOnlyMemberIds = Object.keys(expiredAddOnsByMember).filter(
            id => !memberMap[id]
          );

          if (addOnOnlyMemberIds.length > 0) {
            const { data: aoMembers } = await supabase
              .from("members")
              .select("id, full_name, phone, email, end_date, joining_date, created_at, package_variant_id, package_variants(id, duration_value, duration_unit, pricing_type, price, packages(title))")
              .in("id", addOnOnlyMemberIds);

            (aoMembers || []).forEach(member => {
              // Use earliest add-on expiry as the display date
              const addOns = expiredAddOnsByMember[member.id] || [];
              const earliestExpiry = addOns.reduce((min, ao) =>
                !min || ao.end_date < min ? ao.end_date : min, null
              );
              const endDate = new Date(earliestExpiry);
              const daysSinceExpiry = Math.floor((todayDate - endDate) / (1000 * 60 * 60 * 24));
              memberMap[member.id] = {
                ...member,
                end_date: earliestExpiry,
                daysSinceExpiry,
                expiredAddOns: addOns,
              };
            });
          }

          // Attach expired add-on info to existing package-expired members too
          Object.keys(expiredAddOnsByMember).forEach(memberId => {
            if (memberMap[memberId]) {
              memberMap[memberId].expiredAddOns = expiredAddOnsByMember[memberId];
            }
          });
        }

        const merged = Object.values(memberMap).sort(
          (a, b) => new Date(b.end_date) - new Date(a.end_date)
        );

        console.log("ExpiredMembersModal - Total expired members found:", merged.length);
        console.log("ExpiredMembersModal - Package-expired members:", Object.values(memberMap).filter(m => !m.expiredAddOns?.length).length);
        console.log("ExpiredMembersModal - Members with add-ons:", Object.values(memberMap).filter(m => m.expiredAddOns?.length > 0).length);
        setExpiredMembers(merged);
      } catch (err) {
        console.error("Failed to load expired members:", err);
      } finally {
        setLoading(false);
      }
    };

    loadExpiredMembers();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getUrgencyBadge = (days) => {
    if (days <= 7) return { color: "bg-red-100 text-red-700", label: "Just Expired" };
    if (days <= 30) return { color: "bg-orange-100 text-orange-700", label: "Recently Expired" };
    return { color: "bg-gray-100 text-gray-700", label: "Long Expired" };
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">schedule</span>
              Expired Members
            </h2>
            <p className="text-sm text-white mt-1">
              {expiredMembers.length} member{expiredMembers.length !== 1 ? "s" : ""} need{expiredMembers.length === 1 ? "s" : ""} renewal
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
            <div className="text-center py-12 text-white">
              Loading expired members...
            </div>
          ) : expiredMembers.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[64px] text-green-300">
                check_circle
              </span>
              <p className="text-white mt-3">No expired memberships!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiredMembers.map((member) => {
                const urgency = getUrgencyBadge(member.daysSinceExpiry);
                const packageTitle = member.package_variants?.packages?.title || "No Package";

                return (
                  <div
                    key={member.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div 
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg cursor-pointer hover:shadow-inner"
                            onClick={() => { closeModal(); navigate(`/members/${member.id}`); }}
                            title="View Profile"
                          >
                            {member.full_name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <h3 
                              className="font-semibold text-lg cursor-pointer hover:text-red-400 transition-colors text-white"
                              onClick={() => { closeModal(); navigate(`/members/${member.id}`); }}
                            >
                              {member.full_name}
                            </h3>
                            <p className="text-sm text-gray-300">{member.phone || "No phone"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-15 text-sm text-white">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">
                              inventory_2
                            </span>
                             <span>
                               {packageTitle}
                               {member.package_variants?.duration_value && ` - ${member.package_variants.duration_value} ${member.package_variants.duration_unit}`}
                             </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">
                              event_busy
                            </span>
                            <span>
                              {member.expiredAddOns?.length > 0 && member.package_variants == null
                                ? "Add-on Expired:"
                                : "Package Expired:"}{" "}
                              {formatDate(member.end_date)}
                            </span>
                          </div>

                          {/* Show expired add-ons if any */}
                          {member.expiredAddOns?.length > 0 && (
                            <div className="col-span-full flex items-start gap-2 text-orange-400">
                              <span className="material-symbols-outlined text-[18px] mt-0.5">extension_off</span>
                              <div>
                                <span className="font-medium">Expired Add-ons: </span>
                                {member.expiredAddOns.map((ao, i) => (
                                  <span key={i}>
                                    {ao.name}
                                    <span className="text-xs text-gray-300 ml-1">
                                      ({formatDate(ao.end_date)})
                                    </span>
                                    {i < member.expiredAddOns.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${urgency.color}`}>
                          {urgency.label}
                        </div>
                        <p className="text-xs text-white mb-2">
                          {member.daysSinceExpiry} day{member.daysSinceExpiry !== 1 ? "s" : ""} ago
                        </p>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openWhatsAppClient(member, null, { end_date: member.end_date }, "expiry")}
                            disabled={!member.phone}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${member.phone
                              ? "bg-green-500 hover:bg-green-600 text-white"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            title={member.phone ? "Send WhatsApp reminder" : "No phone number"}
                          >
                            <span className="material-symbols-outlined text-[16px]">chat</span>
                            WhatsApp
                          </button>

                          <button
                            onClick={() => {
                              closeModal();
                              navigate(`/members/${member.id}/renew`);
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white shadow-sm"
                            title="Renew Membership"
                          >
                            <span className="material-symbols-outlined text-[16px]">sync</span>
                            Renew
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <p className="text-xs text-white">
            💡 Tip: Click "Send Reminder" to encourage membership renewal via WhatsApp
          </p>
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}