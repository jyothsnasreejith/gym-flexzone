import { useState } from "react";
import { supabase } from "../supabaseClient";
import PaymentForm from "./PaymentForm";

export default function RecordPaymentModal({ bill, memberId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = async (paymentData) => {
    setLoading(true);
    setError(null);

    // 1. Insert into payments table
    const { error: insertError } = await supabase.from("payments").insert({
      bill_id: bill.id,
      member_id: memberId,
      amount_paid: Number(paymentData.amount),
      method: paymentData.payment_mode,
      notes: paymentData.reference || null,
      payment_date: new Date().toISOString().slice(0, 10),
      status: "completed",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // 2. Update the bill status
    const { error: updateError } = await supabase
      .from("bills")
      .update({
        payment_status: "paid",
        payment_mode: paymentData.payment_mode,
      })
      .eq("id", bill.id);

    if (updateError) {
      console.error("Failed to update bill status:", updateError);
      // We don't block the UI here since the payment record itself was successful
    }

    setLoading(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Record Payment</h2>
      <p className="mb-4">
        Recording payment for bill due on{" "}
        <strong>{new Date(bill.due_date).toLocaleDateString()}</strong>
      </p>
      <PaymentForm
        onSubmit={handlePayment}
        loading={loading}
        error={error}
        bill={bill}
      />
    </div>
  );
}
