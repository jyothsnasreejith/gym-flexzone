export function generateBills({
  memberId,
  totalAmount,
  joiningDate,
  durationValue,
  durationUnit,
}) {
  const bills = [];

  const months =
    durationUnit === "year"
      ? durationValue * 12
      : durationValue;

      
  if (!months || months <= 0) {
    throw new Error("Invalid package duration");
  }

  const monthlyAmount = Math.round(totalAmount / months);

  for (let i = 0; i < months; i++) {
    const dueDate = new Date(joiningDate);
    dueDate.setDate(dueDate.getDate() + i * 30);

    bills.push({
      member_id: memberId,
      billing_date: new Date().toISOString(),
      due_date: dueDate.toISOString(),
      base_amount: monthlyAmount,
      discount_amount: 0,
      payable_amount: monthlyAmount,
      amount: monthlyAmount,
      payment_status: "due",
      payment_mode: "unpaid",
    });
  }

  return bills;
}
