import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { paymentStatusClass } from "../../utils/style";
import { useToast } from "../../context/ToastContext";

export default function Billing() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingBillId, setEditingBillId] = useState(null);
    const [editingDate, setEditingDate] = useState("");
    const [updatingDateId, setUpdatingDateId] = useState(null);

    const startDateEdit = (bill) => {
        setEditingBillId(bill.id);
        setEditingDate((bill.billing_date || "").slice(0, 10));
    };

    const cancelDateEdit = () => {
        setEditingBillId(null);
        setEditingDate("");
    };

    const saveBillingDate = async (billId) => {
        if (!editingDate) {
            showToast("Please select a billing date", "error");
            return;
        }

        setUpdatingDateId(billId);

        const { error } = await supabase
            .from("bills")
            .update({ billing_date: editingDate })
            .eq("id", billId);

        if (error) {
            console.error("Failed to update billing date:", error);
            showToast("Failed to update billing date", "error");
            setUpdatingDateId(null);
            return;
        }

        setBills((prev) =>
            prev.map((bill) =>
                bill.id === billId ? { ...bill, billing_date: editingDate } : bill
            )
        );

        showToast("Billing date updated", "success");
        setUpdatingDateId(null);
        cancelDateEdit();
    };

    useEffect(() => {
        const loadBills = async () => {
            setLoading(true);

            const { data: billsData, error: billsError } = await supabase
                .from("bills")
                .select(`
                    id,
                    billing_date,
                    amount,
                    payment_mode,
                    notes,
                    payment_status,
                    members ( full_name ),
                    package_variant_id
                `)
                .order("billing_date", { ascending: false });

            if (billsError) {
                console.error("Failed to load bills:", billsError);
                setLoading(false);
                return;
            }

            const { data: variantsData, error: variantsError } = await supabase
                .from("package_variants")
                .select("id, duration_months, package_id, duration_unit, duration_value");

            if (variantsError) {
                console.error("Failed to load variants:", variantsError);
                setLoading(false);
                return;
            }

            const { data: packagesData, error: packagesError } = await supabase
                .from("packages")
                .select("id, title");

            if (packagesError) {
                console.error("Failed to load packages:", packagesError);
                setLoading(false);
                return;
            }

            const combinedBills = billsData.map(bill => {
                const variant = variantsData.find(v => v.id === bill.package_variant_id);
                if (!variant) {
                    return {
                        ...bill,
                        package_variant: {
                            package: {}
                        }
                    }
                };

                const pkg = packagesData.find(p => p.id === variant.package_id);
                return {
                    ...bill,
                    package_variant: {
                        ...variant,
                        package: pkg
                    }
                };
            });

            setBills(combinedBills || []);
            setLoading(false);
        };

        loadBills();
    }, []);

    return (
        <main className="max-w-6xl mx-auto p-4 sm:p-6 bg-navy">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Payment & Fee History</h1>
                    <p className="text-sm text-secondary mt-1">
                        Manage and track billing records.
                    </p>
                </div>

                <button
                    onClick={() => navigate("/billing/add")}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold w-full sm:w-auto"
                >
                    + Add Bill
                </button>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-base font-semibold">Transaction History</h2>
                </div>

                {loading ? (
                    <div className="p-6 text-sm text-secondary">Loading bills…</div>
                ) : bills.length === 0 ? (
                    <div className="p-6 text-sm text-secondary">
                        No billing records found.
                    </div>
                ) : (
                    <>
                        {/* DESKTOP TABLE */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800/50 text-xs uppercase text-secondary border-b">
                                    <tr>
                                        <th className="px-6 py-4">Member</th>
                                        <th className="px-6 py-4">Package</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Mode</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y">
                                    {bills.map((b) => (
                                        <tr key={b.id} className="hover:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium">
                                                {b.members?.full_name || "—"}
                                            </td>
                                            <td className="px-6 py-4 text-secondary">
                                                {b.package_variant?.package?.title
                                                    ? `${b.package_variant.package.title} (${b.package_variant.duration_value} ${b.package_variant.duration_unit})`
                                                    : "—"}
                                            </td>

                                            <td className="px-6 py-4 text-secondary">
                                                {editingBillId === b.id ? (
                                                    <input
                                                        type="date"
                                                        value={editingDate}
                                                        onChange={(e) => setEditingDate(e.target.value)}
                                                        className="border rounded-lg px-2 py-1 text-xs bg-card text-white"
                                                    />
                                                ) : (
                                                    b.billing_date
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-semibold">
                                                ₹{Number(b.amount).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 capitalize text-secondary">
                                                {b.payment_mode}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusClass(
                                                        b.payment_status
                                                    )}`}
                                                >
                                                    {b.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center gap-3">
                                                    {editingBillId === b.id ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => saveBillingDate(b.id)}
                                                                disabled={updatingDateId === b.id}
                                                                className="text-green-400 font-medium text-sm hover:underline disabled:opacity-60"
                                                            >
                                                                {updatingDateId === b.id ? "Saving..." : "Save"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelDateEdit}
                                                                disabled={updatingDateId === b.id}
                                                                className="text-secondary font-medium text-sm hover:underline disabled:opacity-60"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => startDateEdit(b)}
                                                                className="text-amber-300 font-medium text-sm hover:underline"
                                                            >
                                                                Edit Date
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/billing/${b.id}`)}
                                                                className="text-primary font-medium text-sm hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* MOBILE CARDS */}
                        <div className="sm:hidden divide-y">
                            {bills.map((b) => (
                                <div
                                    key={b.id}
                                    className="p-4 space-y-2 cursor-pointer"
                                    onClick={() => navigate(`/billing/${b.id}`)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">
                                                {b.package_variant?.package?.title
                                                    ? `${b.package_variant.package.title} (${b.package_variant.duration_value} ${b.package_variant.duration_unit})`
                                                    : "—"}
                                            </p>

                                            <p className="text-xs text-secondary">
                                                {editingBillId === b.id ? (
                                                    <input
                                                        type="date"
                                                        value={editingDate}
                                                        onChange={(e) => setEditingDate(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-1 border rounded-lg px-2 py-1 text-xs bg-card text-white"
                                                    />
                                                ) : (
                                                    b.billing_date
                                                )}
                                            </p>
                                        </div>
                                        <span
                                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusClass(
                                                b.payment_status
                                            )}`}
                                        >
                                            {b.payment_status}
                                        </span>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-secondary">Amount</span>
                                        <span className="font-semibold">
                                            ₹{Number(b.amount).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-secondary">Mode</span>
                                        <span className="capitalize">{b.payment_mode}</span>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-1">
                                        {editingBillId === b.id ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        saveBillingDate(b.id);
                                                    }}
                                                    disabled={updatingDateId === b.id}
                                                    className="text-green-400 text-xs font-medium"
                                                >
                                                    {updatingDateId === b.id ? "Saving..." : "Save"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        cancelDateEdit();
                                                    }}
                                                    disabled={updatingDateId === b.id}
                                                    className="text-secondary text-xs font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startDateEdit(b);
                                                }}
                                                className="text-amber-300 text-xs font-medium"
                                            >
                                                Edit Date
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );

}
