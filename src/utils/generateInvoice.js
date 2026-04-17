import jsPDF from "jspdf";
import { supabase, REAL_SUPABASE_URL } from "../supabaseClient";

/* =========================
   SAFE HELPERS
========================= */
function cleanNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function formatMoney(v) {
  return `Rs.${cleanNumber(v).toFixed(2)}`;
}
function formatDate(d) {
  if (!d) return "--";
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return "--";
  const y = String(dateObj.getFullYear()).slice(-2);
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${day}/${m}/${y}`;
}

function extractAddOnNames(notes) {
  if (!notes) return null;
  
  // Pattern 1: "+ Add-ons: name1, name2"
  const match1 = notes.match(/\+\s*Add-ons?:\s*(.+)/i);
  if (match1) return match1[1].trim();
  
  // Pattern 2: "Add-ons: name1, name2"
  const match2 = notes.match(/Add-ons?:\s*(.+)/i);
  if (match2) return match2[1].trim();
  
  // Pattern 3: "Add-On: name"
  const match3 = notes.match(/Add-On:\s*(.+?)(?:\(|,|$)/i);
  if (match3) return match3[1].trim();
  
  return null;
}

function calculateExpiryDate(billingDate, durationString) {
  if (!durationString || !billingDate) return null;
  
  const baseDate = new Date(billingDate);
  if (isNaN(baseDate.getTime())) return null;
  
  // Parse duration string like "30 days", "1 month", "3 months", etc.
  const parts = durationString.trim().split(/\s+/);
  if (parts.length < 2) return null;
  
  const value = Number(parts[0]);
  const unit = parts[1].toLowerCase();
  
  if (isNaN(value) || value <= 0) return null;
  
  const expiry = new Date(baseDate);
  if (unit === "month" || unit === "months") {
    expiry.setMonth(expiry.getMonth() + value);
  } else if (unit === "year" || unit === "years") {
    expiry.setFullYear(expiry.getFullYear() + value);
  } else if (unit === "day" || unit === "days") {
    expiry.setDate(expiry.getDate() + value);
  } else {
    return null;
  }
  
  return formatDate(expiry);
}

function loadImageSafe(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

/* =========================
   MAIN FUNCTION
 ========================= */
export const generateInvoice = async ({ member, packageInfo, bill, isAddOnBill, siblingBills = [] }) => {
  const allBills = [bill, ...siblingBills];
  const doc = new jsPDF({ unit: "pt" });

  /* ---------- PAGE ---------- */
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, W, H, "F");
  doc.setTextColor(255, 255, 255);

  /* ---------- DATA NORMALIZATION ---------- */
  const totalAmount = allBills.reduce((s, b) => s + cleanNumber(b.payable_amount ?? b.amount ?? b.base_amount), 0);
  const totalPaid = allBills.reduce((s, b) => {
    const payments = Array.isArray(b.payments) ? b.payments : [];
    return s + (payments.reduce((ps, p) => ps + cleanNumber(p.amount_paid), 0) || 0);
  }, 0);
  const totalBalance = Math.max(totalAmount - totalPaid, 0);

  const invoiceNo = bill.invoice_no || `INV${bill.id}`;
  const invoiceDate = bill.billing_date ? new Date(bill.billing_date) : (bill.created_at ? new Date(bill.created_at) : new Date());
  const invoiceDateText = isNaN(invoiceDate.getTime()) ? formatDate(new Date()) : formatDate(invoiceDate);

  /* ---------- LOGO ---------- */
  const logo = await loadImageSafe(`${import.meta.env.BASE_URL}logo.png`);
  if (logo) {
    doc.addImage(logo, "PNG", 48, 36, 36, 36);
  }

  /* ---------- HEADER ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Flex Zone", 90, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("+919447372770", 90, 74);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Invoice No: ${invoiceNo}`, W - 48, 56, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${invoiceDateText}`, W - 48, 74, {
    align: "right",
  });

  /* ---------- BILL TO ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bill to:", 48, 130);

  doc.setFont("helvetica", "normal");
  doc.text(member.full_name, 48, 150);

  /* ---------- ITEMS HEADER ---------- */
  doc.setFillColor(45, 45, 45);
  doc.rect(48, 175, W - 96, 32, "F");

  doc.setTextColor(200, 200, 200);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Items", 60, 196);
  doc.text("Expiry", W / 2 - 80, 196, { align: "center" });
  doc.text("Package Price", W / 2 + 20, 196, { align: "right" });
  doc.text("Remaining", W - 60, 196, { align: "right" });

  /* ---------- ITEM ROWS ---------- */
  let currentY = 236;
  doc.setTextColor(255, 255, 255);

  const lineItems = [];

  allBills.forEach((itemBill) => {
    const itemIsAddOn = itemBill.bill_type === "add_on";
    // Calculate package expiry from billing_date + package duration
    const billingDate = itemBill.billing_date || itemBill.due_date;
    const pkgExpiry = packageInfo?.duration
      ? calculateExpiryDate(billingDate, packageInfo.duration)
      : (itemBill.due_date ? formatDate(itemBill.due_date) : "--");

    // Helper: calculate per-add-on expiry using its own duration
    const getAddOnExpiry = (ao) => {
      if (ao.duration_value && ao.duration_unit) {
        const durStr = `${ao.duration_value} ${ao.duration_unit}`;
        return calculateExpiryDate(billingDate, durStr) || pkgExpiry;
      }
      return pkgExpiry;
    };

    // 1. ADD PACKAGE ITEM (if applicable)
    if (!itemIsAddOn) {
      const addOns = packageInfo?.addOnItems || [];
      
      // Use original package price from packageInfo (not from bill which may have discounts applied)
      const originalPackagePrice = cleanNumber(packageInfo?.price || 0);
      
      // Calculate remaining payment for package (proportion of total remaining based on original prices)
      const addOnTotal = addOns.reduce((sum, ao) => sum + cleanNumber(ao.amount), 0);
      const totalOriginalPrice = originalPackagePrice + addOnTotal;
      const itemRatio = totalOriginalPrice > 0 ? originalPackagePrice / totalOriginalPrice : 0;
      const remainingAmount = itemRatio * totalBalance;
      
      lineItems.push({
        name: `${itemBill.packages?.title || packageInfo.packageTitle || "Package"} - ${packageInfo.duration || ""}`,
        expiry: pkgExpiry,
        originalPrice: originalPackagePrice,
        remainingPayment: Math.max(0, remainingAmount),
        isPackage: true
      });
    }

    // 2. ADD ADD-ON ITEMS (using filtered addOnItems from packageInfo)
    const addOns = packageInfo?.addOnItems || [];
    
    // Calculate total original price for ratio basis
    const originalPackagePrice = !itemIsAddOn && packageInfo?.price ? cleanNumber(packageInfo.price) : 0;
    const addOnTotalPrice = addOns.reduce((sum, ao) => sum + cleanNumber(ao.amount), 0);
    const totalOriginalPrice = originalPackagePrice + addOnTotalPrice;
    
    if (!itemIsAddOn && addOns.length > 0) {
      addOns.forEach(ao => {
        const aoAmount = cleanNumber(ao.amount);
        const itemRatio = totalOriginalPrice > 0 ? aoAmount / totalOriginalPrice : 0;
        const remainingAmount = itemRatio * totalBalance;
        
        lineItems.push({
          name: `Add-On: ${ao.name}`,
          expiry: getAddOnExpiry(ao),
          originalPrice: aoAmount,
          remainingPayment: Math.max(0, remainingAmount),
          isAddOn: true
        });
      });
    } else if (itemIsAddOn) {
      // Standalone add-on bill: use filtered addOnItems if available, else extract from notes
      if (addOns.length > 0) {
        addOns.forEach(ao => {
          const aoAmount = cleanNumber(ao.amount);
          const itemRatio = addOnTotalPrice > 0 ? aoAmount / addOnTotalPrice : 0;
          const remainingAmount = itemRatio * totalBalance;
          
          lineItems.push({
            name: `Add-On: ${ao.name}`,
            expiry: getAddOnExpiry(ao),
            originalPrice: aoAmount,
            remainingPayment: Math.max(0, remainingAmount),
            isAddOn: true
          });
        });
      } else {
        // Fallback: extract from notes
        const addOnLabel = extractAddOnNames(itemBill.notes) || "Add-On";
        const aoAmount = cleanNumber(itemBill.payable_amount ?? itemBill.amount ?? itemBill.base_amount);
        
        lineItems.push({
          name: `Add-On: ${addOnLabel}`,
          expiry: pkgExpiry,
          originalPrice: aoAmount,
          remainingPayment: totalBalance,
          isAddOn: true
        });
      }
    } else {
      // Combined bill fallback: extract add-on names from notes
      const aoNames = extractAddOnNames(itemBill.notes);
      if (aoNames) {
        aoNames.split(",").map(s => s.trim()).forEach(name => {
          lineItems.push({
            name: `Add-On: ${name}`,
            expiry: pkgExpiry,
            originalPrice: 0,
            remainingPayment: 0,
            isAddOn: true
          });
        });
      }
    }
  });

  // Render the line items
  lineItems.forEach((li) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    
    // Draw Name
    doc.text(li.name, 60, currentY, { maxWidth: (W / 2) - 80 });

    // Draw Expiry
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(li.expiry, W / 2 - 80, currentY, { align: "center" });

    // Draw Package Price
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const originalPriceText = typeof li.originalPrice === "number" ? formatMoney(li.originalPrice) : li.originalPrice;
    doc.text(originalPriceText, W / 2 + 20, currentY, { align: "right" });

    // Draw Remaining Payment
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const remainingText = typeof li.remainingPayment === "number" ? formatMoney(li.remainingPayment) : li.remainingPayment;
    doc.text(remainingText, W - 60, currentY, { align: "right" });

    currentY += 24;
  });

  currentY += 10;

  /* ---------- DIVIDER ---------- */
  doc.setDrawColor(60, 60, 60);
  doc.line(48, currentY + 10, W - 48, currentY + 10);
  let y = Math.max(currentY + 40, 300);

  /* ---------- PAYMENT INFO ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Payment information", 48, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(bill.payment_mode || bill.payment_method || "—", 48, y + 18);

  /* ---------- TOTALS (RIGHT) ---------- */
  const RX = W - 48;

  const row = (label, value) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(label, RX - 180, y);

    doc.setFont("helvetica", "bold");
    doc.text(value, RX, y, { align: "right" });

    y += 26;
  };

  const overallBase = allBills.reduce((s, b) => s + cleanNumber(b.base_amount || b.amount), 0);
  const overallDisc = allBills.reduce((s, b) => s + cleanNumber(b.discount_amount), 0);

  row("Subtotal", formatMoney(overallBase));
  if (overallDisc > 0) {
    row("Discount", `-${formatMoney(overallDisc)}`);
  }
  row("Total payable", formatMoney(totalAmount));
  row("Amount received", formatMoney(totalPaid));
  row("Balance", formatMoney(totalBalance));

  /* ---------- NOTES ---------- */
  const cleanedNotes = bill.notes
    ? bill.notes.replace(/\[REF_REWARD:(\d+(\.\d+)?)\]/g, "").trim()
    : "";

  const displayNotes = extractAddOnNames(cleanedNotes)
    ? `Add-Ons included: ${extractAddOnNames(cleanedNotes)}`
    : cleanedNotes;

  if (displayNotes) {
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes:", 48, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(displayNotes, 48, y + 14, { maxWidth: W - 96 });
  }

  /* ---------- FOOTER ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Flex Zone", W / 2, H - 96, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "This invoice is computer generated no signature required",
    W / 2,
    H - 72,
    { align: "center" }
  );

  /* ---------- UPLOAD ---------- */
  const blob = doc.output("blob");
  const filename = `invoices/${member.id}_${bill.id}_${Date.now()}.pdf`;

  const { error } = await supabase.storage
    .from("gym-invoices")
    .upload(filename, blob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    console.error("Supabase Storage Upload Error:", {
        bucket: "gym-invoices",
        filename,
        error
    });
    throw new Error(`Failed to upload invoice to storage: ${error.message || 'Unknown storage error'}`);
  }

  const { data } = supabase.storage
    .from("gym-invoices")
    .getPublicUrl(filename);

  let publicUrl = data.publicUrl;
  if (import.meta.env.DEV && REAL_SUPABASE_URL && typeof window !== 'undefined') {
    publicUrl = publicUrl.replace(`${window.location.origin}/supabase-api`, REAL_SUPABASE_URL);
  }

  return publicUrl;

};
