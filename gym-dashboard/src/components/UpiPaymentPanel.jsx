import { QRCodeCanvas } from "qrcode.react";

const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

const isAndroid = () =>
  /Android/i.test(navigator.userAgent);

export default function UpiPaymentPanel({ amount }) {
  if (!amount || Number(amount) <= 0) return null;

  const upiId = "flexgym034@dlb";
  const payeeName = "FLEX GYM";

  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    payeeName
  )}&am=${Number(amount)}&cu=INR`;

  const upiApps = [
    {
      id: "gpay",
      label: "Google Pay",
      scheme: `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(
        payeeName
      )}&am=${Number(amount)}&cu=INR`,
    },
    {
      id: "phonepe",
      label: "PhonePe",
      scheme: `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(
        payeeName
      )}&am=${Number(amount)}&cu=INR`,
    },
    {
      id: "paytm",
      label: "Paytm",
      scheme: `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(
        payeeName
      )}&am=${Number(amount)}&cu=INR`,
    },
    {
      id: "bhim",
      label: "BHIM",
      scheme: upiLink, // fallback UPI handler
    },
  ];

  return (
    <div className="border rounded-xl p-4 bg-gray-50 space-y-4">
      <h3 className="font-semibold text-sm">UPI Payment</h3>

      {isIOS() ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 text-center">
            Choose your UPI app to pay ₹{Number(amount).toLocaleString()}
          </p>

          {upiApps.map(app => (
            <button
              key={app.id}
              onClick={() => (window.location.href = app.scheme)}
              className="w-full border bg-card hover:bg-gray-100 py-3 rounded-lg font-medium"
            >
              Pay with {app.label}
            </button>
          ))}

          <p className="text-xs text-gray-500 text-center">
            If the app is not installed, nothing will open.
          </p>
        </div>
      ) : isAndroid() ? (
        <>
          <button
            onClick={() => (window.location.href = upiLink)}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold"
          >
            Pay ₹{Number(amount).toLocaleString()} via UPI
          </button>

          <p className="text-xs text-gray-500 text-center">
            Opens your UPI app
          </p>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <QRCodeCanvas value={upiLink} size={220} />
          </div>

          <div className="text-center text-sm">
            <p className="text-gray-600">Scan to pay ₹{amount}</p>
            <p className="font-medium mt-1">{upiId}</p>
          </div>
        </>
      )}
    </div>
  );
}