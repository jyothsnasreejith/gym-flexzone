export const paidLikeStatuses = ["success", "paid", "completed"];
export const countableStatuses = ["success", "paid", "completed", "partial"];

export const normalizePaymentStatus = (raw) => {
  const status = String(raw || "").toLowerCase();
  if (paidLikeStatuses.includes(status)) return "paid";
  if (status === "partial") return "partial";
  if (status === "pending") return "pending";
  if (status === "unpaid") return "unpaid";
  return "unknown";
};

export const isPaidLike = (raw) => normalizePaymentStatus(raw) === "paid";

export const isCountable = (raw) =>
  countableStatuses.includes(String(raw || "").toLowerCase());
