import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBill = async () => {
      setLoading(true);

      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          id,
          billing_date,
          base_amount,
          discount_amount,
          amount,
          payment_mode,
          notes,
          created_at,
          members (
            full_name
          ),
          package_variant_id
        `)
        .eq("id", id)
        .single();

      if (billError) {
        console.error("Failed to load bill:", billError?.message, billError);
        setLoading(false);
        return;
      }
      
      if (!billData) {
        setLoading(false);
        return;
      }

      const { data: variantData, error: variantError } = await supabase
        .from("package_variants")
        .select("id, duration_value, duration_unit, price, package_id")
        .eq("id", billData.package_variant_id)
        .single();

      if (variantError) {
        console.error("Failed to load variant:", variantError);
        setBill(billData); // set bill without variant info
        setLoading(false);
        return;
      }

      const { data: packageData, error: packageError } = await supabase
        .from("packages")
        .select("id, title")
        .eq("id", variantData.package_id)
        .single();

      if (packageError) {
        console.error("Failed to load package:", packageError);
        // set bill with variant info but without package info
        setBill({ ...billData, package_variants: variantData });
        setLoading(false);
        return;
      }

      const combinedBill = {
        ...billData,
        package_variants: {
          ...variantData,
          packages: packageData
        }
      };

      setBill(combinedBill);
      setLoading(false);
    };

    loadBill();
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-6 text-sm text-secondary">
        Loading bill details…
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="max-w-3xl mx-auto p-6 text-sm text-secondary">
        Bill not found.
      </main>
    );
  }

  const packageTitle =
    bill.package_variants?.packages?.title || "—";

  const packageDuration =
    bill.package_variants?.duration_value && bill.package_variants?.duration_unit
      ? `${bill.package_variants.duration_value} ${bill.package_variants.duration_unit}`
      : "—";

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 bg-navy">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bill Details</h1>
          <p className="text-xs text-secondary mt-1">
            Bill ID: {bill.id}
          </p>
        </div>

        <button
          onClick={() => navigate("/billing")}
          className="text-sm font-medium text-primary hover:underline"
        >
          Back
        </button>
      </div>

      {/* MEMBER & PACKAGE */}
      <div className="bg-card border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-secondary">Member</p>
          <p className="font-semibold">
            {bill.members?.full_name || "—"}
          </p>
        </div>

        <div>
          <p className="text-xs text-secondary">Package</p>
          <p className="font-semibold">
            {packageTitle}
          </p>
          <p className="text-xs text-secondary">
            {packageDuration}
          </p>
        </div>
      </div>

      {/* AMOUNT BREAKDOWN */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-secondary">
          Amount Breakdown
        </h2>

        <div className="flex justify-between text-sm">
          <span className="text-secondary">Base Amount</span>
          <span>₹{bill.base_amount}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-secondary">Discount</span>
          <span className="text-red-600">
            − ₹{bill.discount_amount}
          </span>
        </div>

        <div className="border-t pt-2 flex justify-between font-semibold">
          <span>Final Amount Paid</span>
          <span>₹{bill.amount}</span>
        </div>
      </div>

      {/* PAYMENT INFO */}
      <div className="bg-card border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-secondary">Billing Date</p>
          <p className="font-medium">{bill.billing_date}</p>
        </div>

        <div>
          <p className="text-xs text-secondary">Payment Mode</p>
          <p className="font-medium capitalize">
            {bill.payment_mode}
          </p>
        </div>

        <div>
          <p className="text-xs text-secondary">Status</p>
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Paid
          </span>
        </div>
      </div>

      {/* NOTES */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase text-secondary mb-2">
          Notes
        </h2>
        <p className="text-sm text-white">
          {bill.notes || "No notes provided."}
        </p>
      </div>
    </main>
  );
}
