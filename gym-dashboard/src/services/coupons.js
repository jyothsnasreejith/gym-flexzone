import { supabase } from "@/lib/supabase";

export async function validateCoupon({
  couponCode,
  packageVariantId,
  price,
  memberId = null,
}) {
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_coupon_code: couponCode,
    p_package_variant_id: packageVariantId,
    p_variant_price: price,
    p_member_id: memberId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
