// src/pages/MemberFeeHistory.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

const MemberFeeHistory = () => {
  const { openModal, closeModal } = useModal();
  const [member, setMember] = useState(null);
  const [payments, setPayments] = useState([]);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: mData, error: memberError } = await supabase
          .from("members")
          .select("id, full_name, profile_image_url, package_variants(packages(title))")
          .eq("id", id)
          .single();

        if (memberError) throw memberError;

        if (mData) {
          setMember({
            memberId: mData.id,
            name: mData.full_name || "",
            packageName: mData.package_variants?.packages?.title || "",
            avatar: mData.profile_image_url || "",
          });
        }

        // Fetch add-on names
        const { data: aoRows } = await supabase
          .from("member_add_ons")
          .select("add_ons ( name )")
          .eq("member_id", id);
        const addOnNames = (aoRows || []).map(r => r.add_ons?.name).filter(Boolean);

        const { data: billsData } = await supabase
          .from("bills")
          .select("*, package_variants(packages(title))")
          .eq("member_id", id)
          .order("due_date", { ascending: false });

        const billIds = (billsData || []).map(b => b.id);
        const { data: pData } = await supabase
          .from("payments")
          .select("*")
          .in("bill_id", billIds);

        const mapped = (billsData || [])
          .filter(bill => bill.is_current !== false) // Hide archived
          .map((bill) => {
            const billPayments = (pData || []).filter(p => p.bill_id === bill.id);
            const totalPaid = billPayments.reduce((acc, p) => acc + (p.amount || p.amount_paid || 0), 0);
            const payable = Number(bill.payable_amount ?? bill.amount ?? 0);
            const remaining = Math.max(payable - totalPaid, 0);
            const status = remaining <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

            return {
              id: bill.id,
              packageName: bill.bill_type === "add_on" 
                ? (addOnNames.join(", ") || "Add-On")
                : (bill.package_variants?.packages?.title || "N/A"),
              date: bill.billing_date || bill.due_date || "",
              amountPaid: totalPaid,
              remaining: remaining,
              status: status,
            };
          })
          .filter(row => row.status !== "unpaid"); // Hide unpaid

        setPayments(mapped);
      } catch (err) {
        console.error("Failed to load member fee history", err);
      }
    };

    if (id) load();
  }, [id]);

  if (!member) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 mx-auto w-full bg-navy">

      {/* HEADER */}
      <div className="bg-card rounded-xl shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="bg-center bg-cover rounded-full size-16"
            style={{ backgroundImage: `url(${member.avatar})` }}
          ></div>

          <div>
            <h1 className="text-2xl font-bold text-white">{member.name}</h1>
            <p className="text-secondary text-sm">
              Member ID: {member.memberId} | Package: {member.packageName}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/members/${id}/edit`)}
          className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg font-semibold w-full sm:w-auto"
        >
          <span className="material-symbols-outlined">edit</span>
          Edit Profile
        </button>
      </div>

      {/* TITLE */}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
        <h2 className="text-xl font-bold text-white">Payment & Fee History</h2>

        <button
          className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg font-semibold w-full sm:w-auto"
        >
          <span className="material-symbols-outlined">add</span>
          New Payment
        </button>
      </div>

      {/* PAYMENT TABLE */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Package</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Amount Paid</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Remaining</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Actions</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-secondary">{p.packageName}</td>
                  <td className="px-4 py-3 text-secondary">{p.date}</td>
                  <td className="px-4 py-3 font-bold text-white">₹{p.amountPaid}</td>

                  <td className="px-4 py-3 font-semibold">
                    ₹{p.remaining}
                  </td>

                  <td className="px-4 py-3 text-sm">
                    {String(p.status).toLowerCase() === "paid" && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        Paid Full
                      </span>
                    )}

                    {String(p.status).toLowerCase() === "partial" && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                        Partial
                      </span>
                    )}

                    {String(p.status).toLowerCase() === "overdue" && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                        Overdue
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-primary font-semibold cursor-pointer">
                    {p.remaining === 0 ? (
                      <span>View Receipt</span>
                    ) : (
                      <span>Make Payment</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden">
          {payments.map((p) => (
            <div key={p.id} className="border-b p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-white">{p.packageName}</div>
                  <div className="text-sm text-secondary">{p.date}</div>
                </div>
                <div className="text-sm">
                  {String(p.status).toLowerCase() === "paid" && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      Paid Full
                    </span>
                  )}

                  {String(p.status).toLowerCase() === "partial" && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                      Partial
                    </span>
                  )}

                  {String(p.status).toLowerCase() === "overdue" && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                      Overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-secondary">Amount Paid</div>
                  <div className="font-bold text-white">₹{p.amountPaid}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary">Remaining</div>
                  <div className="font-semibold">₹{p.remaining}</div>
                </div>
              </div>
              <div className="mt-4 text-primary font-semibold cursor-pointer text-center border-t pt-4">
                {p.remaining === 0 ? (
                  <span>View Receipt</span>
                ) : (
                  <span>Make Payment</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default MemberFeeHistory;
