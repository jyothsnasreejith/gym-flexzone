export const paymentStatusClass = (status) => {
  if (status === "Paid") return "bg-green-100 text-green-700";
  if (status === "Pending") return "bg-yellow-100 text-yellow-700";
  if (status === "Overdue") return "bg-red-100 text-red-700";
  return "bg-gray-200 text-gray-600";
};

/**
 * Formats "HH:MM:SS" or "HH:MM" to "HH:MM AM/PM"
 */
export const formatTime12h = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":");
  let hours = parseInt(h, 10);
  const minutes = m;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
};

export const formatBatch = (batch, start, end) => {
  if (start && end) {
    const s = formatTime12h(start);
    const e = formatTime12h(end);
    if (s && e) return `${s} – ${e}`;
  }
  return batch?.replace("-", " – ") || "—";
};
