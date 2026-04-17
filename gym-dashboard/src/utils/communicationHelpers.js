import { supabase, REAL_SUPABASE_URL } from "../supabaseClient";
import { generateInvoice } from "./generateInvoice";

const DEFAULT_TEMPLATES = {
    birthday: {
        subject: "Happy Birthday [MEMBER_NAME]! 🎉",
        content: "Dear [MEMBER_NAME],\n\nHappy Birthday! We wish you a fantastic day and a great year ahead. Stay fit and healthy!\n\nBest regards,\nFlex Zone Team"
    },
    fee: {
        subject: "Payment Reminder - Flex Zone",
        content: "Dear [MEMBER_NAME],\n\nThis is a friendly reminder regarding your outstanding balance of [AMOUNT_DUE] which was due on [DUE_DATE]. Please settle it at your earliest convenience.\n\nBest regards,\nFlex Zone Team"
    },
    expiry: {
        subject: "Your Membership has Expired",
        content: "Dear [MEMBER_NAME],\n\nYour gym membership expired on [EXPIRY_DATE]. We would love to have you continue your fitness journey with us. Please visit the reception for renewal.\n\nBest regards,\nFlex Zone Team"
    },
    upcoming_fee: {
        subject: "Upcoming Payment Reminder - Flex Zone",
        content: "Dear [MEMBER_NAME],\n\nThis is a friendly reminder that your gym fee of [AMOUNT_DUE] is due in 2 days ([DUE_DATE]). Kindly settle it to avoid any interruption.\n\nBest regards,\nFlex Zone Team"
    },
    upcoming_expiry: {
        subject: "Gym Membership Expiring Soon",
        content: "Dear [MEMBER_NAME],\n\nYour gym membership is expiring in 2 days on [EXPIRY_DATE]. We hope you've enjoyed your journey so far! Please visit us to renew and keep the momentum going.\n\nBest regards,\nFlex Zone Team"
    }
};

/**
 * Helper to replace placeholders in email templates
 */
export const fillTemplate = (template, member, extras = {}, type = "birthday") => {
    const actualTemplate = template || DEFAULT_TEMPLATES[type] || DEFAULT_TEMPLATES.birthday;
    let body = actualTemplate.content || "";
    let subject = actualTemplate.subject || "";

    const replacements = {
        "[MEMBER_NAME]": member.full_name || "",
        "[BIRTHDAY_DATE]": extras.birthdayDate || "",
        "[AMOUNT_DUE]": extras.balance ? `Rs.${Number(extras.balance).toLocaleString("en-IN")}` : "",
        "[EXPIRY_DATE]": extras.end_date ? new Date(extras.end_date).toLocaleDateString("en-GB") : "",
        "[DUE_DATE]": extras.due_date ? new Date(extras.due_date).toLocaleDateString("en-GB") : "",
        "[PACKAGE_NAME]": extras.packageName || "",
        "[STAFF_NAME]": "Team Flex Zone", // Default
    };

    Object.entries(replacements).forEach(([k, v]) => {
        body = body.replaceAll(k, v);
        subject = subject.replaceAll(k, v);
    });

    return { subject, body };
};


/**
 * Sends an email via Supabase Edge Function using Mailtrap
 */
export const openEmailClient = async (member, template, extras = {}, type = "birthday") => {
    if (!member.email) {
        alert("This member does not have an email address registered.");
        return;
    }

    const { subject, body } = fillTemplate(template, member, extras, type);

    try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const functionUrl = `${REAL_SUPABASE_URL}/functions/v1/send-email`;

        console.log("Sending request to:", functionUrl);

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey
            },
            body: JSON.stringify({
                to: member.email,
                name: member.full_name,
                subject: subject,
                body: body
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error("Function error:", result);
            let errorMsg = result.error || "Unknown error";
            if (result.details) {
                // Try to parse details if it's JSON from Mailtrap
                let detailStr = result.details;
                try {
                    const parsed = JSON.parse(result.details);
                    if (parsed.errors) detailStr = parsed.errors.join(", ");
                } catch (e) { }
                errorMsg += `: ${detailStr}`;
            }
            alert(`Failed to send email: ${errorMsg}`);
            return { success: false, error: result };
        }

        alert(`Email sent successfully to ${member.full_name}`);
        return { success: true, data: result };
    } catch (err) {
        console.error("Request failed:", err);
        alert(`Request failed: ${err.message || 'Check connection'}`);
        return { success: false, error: err };
    }
};

/**
 * Opens the user's default WhatsApp client pre-filled with message content
 */
export const openWhatsAppClient = (member, template, extras = {}, type = "birthday") => {
    if (!member.phone) {
        alert("This member does not have a phone number registered.");
        return;
    }

    // Reuse the fillTemplate logic for WhatsApp as well
    const { body } = fillTemplate(template, member, extras, type);
    const phone = member.phone.replace(/\D/g, ""); // Remove non-digits

    // Ensure phone has country code (default to 91 if 10 digits)
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(body)}`;
    window.open(waUrl, "_blank");
};

/**
 * Shares an invoice using native sharing (if available) or falls back to WhatsApp
 * Adds a download parameter to the URL to force download on desktop.
 */
export const shareInvoice = async ({ member, packageInfo, bill, financials, isAddOnBill, siblingBills = [] }) => {
    try {
        const allBills = [bill, ...siblingBills];

        // Generate invoice and get public URL
        const invoiceUrl = await generateInvoice({
            member,
            packageInfo,
            bill,
            isAddOnBill,
            siblingBills,
        });

        // Calculate amounts consistently across ALL bills in this group
        const totalAmount = allBills.reduce((s, b) => s + Number(b.payable_amount ?? b.amount ?? b.base_amount ?? 0), 0);
        const totalPaid = allBills.reduce((s, b) => {
            const payments = Array.isArray(b.payments) ? b.payments : [];
            return s + (payments.filter(p => !['failed', 'cancelled'].includes(p.status?.toLowerCase()))
                .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0) || 0);
        }, 0);
        const balance = Math.max(totalAmount - totalPaid, 0);

        // Build Label list — always show actual items regardless of balance payment status
        const itemsList = allBills.map(b => {
           if (b.bill_type === 'add_on') {
              const aoNames = packageInfo.addOnNames;
              if (aoNames && aoNames.length > 0) return aoNames.join(", ");
              return b.notes?.split(":")[1]?.split("(")[0]?.trim() || "Add-on";
           }
           const pTitle = b.packages?.title || packageInfo.packageTitle || "Package";
           return `${packageInfo.duration || ""} ${pTitle}`.trim();
        });
        const combinedLabel = itemsList.join(" + ");
        const messageList = itemsList.map(item => `- ${item}`).join("\n");

        const maxDueDate = allBills.reduce((max, b) => {
            if (!b.due_date) return max;
            const d = new Date(b.due_date);
            return !max || d > max ? d : max;
        }, null);
        const expiryDateStr = maxDueDate ? maxDueDate.toLocaleDateString("en-GB") : "N/A";

        const totalDiscount = allBills.reduce((s, b) => s + Number(b.discount_amount || 0), 0);
        const subtotal = totalAmount + totalDiscount;

        const formatCurrency = (amt) => 
            amt.toLocaleString("en-IN", { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });

        const divider = "----------------------------";

        const message = `Hello ${member.full_name},\n\nYour invoice for *${combinedLabel}* is ready.\n\n*Billing Details*\n${divider}\n${messageList}\n- Expiry Date: ${expiryDateStr}\n\n- Bill Amount: Rs. ${formatCurrency(subtotal)}\n- Discount: Rs. ${formatCurrency(totalDiscount)}\n- Payable: Rs. ${formatCurrency(totalAmount)}\n\n- Amount Paid: Rs. ${formatCurrency(totalPaid)}\n- Balance Due: Rs. ${formatCurrency(balance)}\n${divider}\n\n*Please find your digital invoice here:*\n${invoiceUrl}\n\nThank you for choosing Flex Zone!\nStay Fit, Stay Healthy.`;

        // Implementation Note: We skip navigator.share because targeting a specific 
        // contact is not supported by the native Share API. Using wa.me ensures
        // the chat opens directly with the correct member.

        const phone = (member.phone || "").replace(/\D/g, "");
        if (phone && phone.length >= 10) {
            // Ensure phone has country code (default to 91 if 10 digits)
            const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

            // Open WhatsApp in a new tab
            window.open(whatsappUrl, "_blank");
            return { success: true, method: 'whatsapp' };
        } else {
            throw new Error("No valid phone number found for this member.");
        }

    } catch (error) {
        console.error("Critical Error in shareInvoice:", {
            message: error.message,
            stack: error.stack,
            fullError: error
        });
        throw error;
    }
};

