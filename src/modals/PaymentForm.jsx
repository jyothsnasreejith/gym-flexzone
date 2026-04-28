import { useState } from "react";

export default function PaymentForm({ onSubmit, loading, error, bill }) {
  const [amount, setAmount] = useState(bill.amount);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [reference, setReference] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ amount, payment_mode: paymentMode, reference });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="mb-4">
        <label htmlFor="amount" className="block text-sm font-medium text-white">
          Amount
        </label>
        <input
          type="number"
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-card text-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="paymentMode" className="block text-sm font-medium text-white">
          Payment Mode
        </label>
        <select
          id="paymentMode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-card text-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="reference" className="block text-sm font-medium text-white">
          Reference (Optional)
        </label>
        <input
          type="text"
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-card text-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:bg-gray-400"
        >
          {loading ? "Recording..." : "Record Payment"}
        </button>
      </div>
    </form>
  );
}
