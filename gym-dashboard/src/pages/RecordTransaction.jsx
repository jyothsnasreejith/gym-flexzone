import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function RecordTransaction() {
  const [type, setType] = useState("expense");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    date: "",
    amount: "",
    method: "Cash",
    notes: "",
  });

  const onChange = (k) => (e) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  /* ===============================
     SUBMIT (MIGRATED TO SUPABASE)
  =============================== */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const table = type === "income" ? "payments" : "expenses";

      let payload = {
        amount: Number(form.amount),
        payment_mode: form.method,
        remark: form.notes,
        payment_date: form.date,
      };

      if (type === "expense") {
        payload = {
          amount: Number(form.amount),
          payment_mode: form.method,
          remark: form.notes,
          expense_at: `${form.date}T12:00:00`,
          expense_type: "Other", // Default for manual entry
        };
      } else {
        // For payments, we also need amount_paid for some triggers/logic
        payload.amount_paid = Number(form.amount);
      }

      const { error } = await supabase
        .from(table)
        .insert(payload);

      if (error) throw error;

      alert("Transaction recorded successfully");
      setForm({ date: "", amount: "", method: "Cash", notes: "" });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-8 bg-navy">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col gap-3 pb-6">
          <h1 className="text-white text-3xl font-black leading-tight">
            Record Transaction
          </h1>
          <p className="text-secondary">
            Log income or expense transactions manually.
          </p>
        </div>

        {/* MAIN CARD */}
        <div className="bg-card rounded-xl shadow-sm border border-slate-700/20">

          {/* TABS */}
          <div className="border-b border-slate-700/20 p-4">
            <div className="flex space-x-6">

              <button
                onClick={() => setType("expense")}
                className={`py-2 px-1 border-b-2 font-semibold ${type === "expense"
                    ? "border-red-500 text-red-500"
                    : "border-transparent text-secondary"
                  }`}
              >
                Record Expense
              </button>

              <button
                onClick={() => setType("income")}
                className={`py-2 px-1 border-b-2 font-semibold ${type === "income"
                    ? "border-green-500 text-green-500"
                    : "border-transparent text-secondary"
                  }`}
              >
                Record Income
              </button>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* DATE */}
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  required
                  className="form-input w-full rounded-lg bg-card text-white"
                  value={form.date}
                  onChange={onChange("date")}
                />
              </div>

              {/* AMOUNT */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  className="form-input w-full rounded-lg bg-card text-white"
                  placeholder="5000"
                  value={form.amount}
                  onChange={onChange("amount")}
                />
              </div>

              {/* METHOD */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payment Method
                </label>
                <select
                  className="form-select w-full rounded-lg bg-card text-white"
                  value={form.method}
                  onChange={onChange("method")}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Card</option>
                </select>
              </div>
            </div>

            {/* NOTES */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Notes / Description
              </label>
              <textarea
                rows="3"
                className="form-textarea w-full rounded-lg bg-card text-white"
                placeholder="Optional notes for this transaction"
                value={form.notes}
                onChange={onChange("notes")}
              />
            </div>

            {/* SUBMIT */}
            <div className="flex justify-end pt-4 border-t">
              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-3 rounded-lg text-white font-bold ${type === "income"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-red-500 hover:bg-red-600"
                  }`}
              >
                {submitting ? "Saving..." : "Record Transaction"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
