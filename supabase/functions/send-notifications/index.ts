import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const MAILTRAP_API_URL = "https://send.api.mailtrap.io/api/send";

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get("DB_URL");
        const serviceRoleKey = Deno.env.get("DB_SERVICE_ROLE_KEY");
        const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
        const senderEmail = Deno.env.get("MAILTRAP_SENDER_EMAIL");

        if (!supabaseUrl || !serviceRoleKey || !mailtrapToken || !senderEmail) {
            console.error("Missing configuration secrets.");
            return new Response(JSON.stringify({ error: "Missing config" }), { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const today = new Date().toISOString().split('T')[0];

        // Calculate dates
        const in2Days = new Date();
        in2Days.setDate(in2Days.getDate() + 2);
        const in2DaysStr = in2Days.toISOString().split('T')[0];

        const ago2Days = new Date();
        ago2Days.setDate(ago2Days.getDate() - 2);
        const ago2DaysStr = ago2Days.toISOString().split('T')[0];

        console.log(`Processing notifications for ${today}. Looking for due/expiry on ${in2DaysStr} and ${ago2DaysStr}`);

        // 1. Get Members for Expiry (2 days before and 2 days after)
        const { data: expiringMembers, error: expiryError } = await supabase
            .from("members")
            .select("id, full_name, email, end_date")
            .or(`end_date.eq.${in2DaysStr},end_date.eq.${ago2DaysStr}`)
            .not("email", "is", null);

        if (expiryError) throw expiryError;

        // 2. Get Bills Due (2 days before and 2 days after, unpaid or partial)
        const { data: dueBills, error: billsError } = await supabase
            .from("bills")
            .select(`
        id, 
        due_date, 
        amount, 
        payment_status,
        members (id, full_name, email)
      `)
            .or(`due_date.eq.${in2DaysStr},due_date.eq.${ago2DaysStr}`)
            .in("payment_status", ["unpaid", "partial"]);

        if (billsError) throw billsError;

        const notificationsSent = { expiry: 0, bills: 0 };

        // Send Expiry Emails
        for (const member of expiringMembers || []) {
            const isBefore = member.end_date === in2DaysStr;
            const subject = isBefore
                ? "Gym Membership Set to Expire Soon"
                : "Gym Membership Expired";
            const content = isBefore
                ? `Hi ${member.full_name}, your gym membership is set to expire on ${member.end_date} (in 2 days). Please renew soon to stay fit!`
                : `Hi ${member.full_name}, your gym membership expired on ${member.end_date} (2 days ago). We'd love to see you back!`;

            await sendMailtrapEmail(mailtrapToken, senderEmail, member.email, member.full_name, subject, content);
            notificationsSent.expiry++;
        }

        // Send Bill Emails
        for (const bill of dueBills || []) {
            const member = bill.members;
            if (!member || !member.email) continue;

            const isBefore = bill.due_date === in2DaysStr;
            const subject = isBefore ? "Payment Reminder - Flex Zone" : "Overdue Payment Notice";
            const content = isBefore
                ? `Hi ${member.full_name}, this is a friendly reminder that your payment of ₹${bill.amount} is due on ${bill.due_date} (in 2 days).`
                : `Hi ${member.full_name}, your payment of ₹${bill.amount} was due on ${bill.due_date} (2 days ago). Please settle it as soon as possible.`;

            await sendMailtrapEmail(mailtrapToken, senderEmail, member.email, member.full_name, subject, content);
            notificationsSent.bills++;
        }

        return new Response(JSON.stringify({
            success: true,
            sent: notificationsSent,
            timestamp: new Date().toISOString()
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        console.error("Notification Function Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});

async function sendMailtrapEmail(token: string, from: string, to: string, name: string, subject: string, text: string) {
    const payload = {
        from: { email: from, name: "Flex Zone Gym" },
        to: [{ email: to, name: name }],
        subject: subject,
        text: text,
        category: "Notification"
    };

    const response = await fetch(MAILTRAP_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`Mailtrap Error (${response.status}):`, error);
    } else {
        console.log(`Email sent to ${to}: ${subject}`);
    }
}
