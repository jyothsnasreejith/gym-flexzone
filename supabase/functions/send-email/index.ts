import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const MAILTRAP_SENDING_URL = "https://send.api.mailtrap.io/api/send";
const MAILTRAP_SANDBOX_URL = "https://sandbox.api.mailtrap.io/api/send";

serve(async (req) => {
    // Handle health check
    if (req.method === 'GET') {
        return new Response(JSON.stringify({ status: "ok", message: "Send Email function is reachable" }), {
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
        });
    }

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
        const senderEmail = Deno.env.get("MAILTRAP_SENDER_EMAIL");
        const inboxId = Deno.env.get("MAILTRAP_INBOX_ID");

        if (!mailtrapToken || !senderEmail) {
            console.error("Missing Mailtrap configuration secrets.");
            return new Response(JSON.stringify({
                error: "Server configuration error",
                details: "Missing environment variables on server. Please set MAILTRAP_API_TOKEN and MAILTRAP_SENDER_EMAIL secrets."
            }), {
                status: 500,
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
            });
        }

        const apiUrl = inboxId ? `${MAILTRAP_SANDBOX_URL}/${inboxId}` : MAILTRAP_SENDING_URL;

        let bodyData;
        try {
            bodyData = await req.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
                status: 400,
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
            });
        }

        const { to, subject, body, name } = bodyData;

        if (!to || !subject || !body) {
            console.error("Missing required fields:", { to, subject, body: !!body });
            return new Response(JSON.stringify({ error: "Missing required fields: to, subject, body" }), {
                status: 400,
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
            });
        }

        console.log(`Attempting to send email to ${to} via ${inboxId ? 'Sandbox' : 'Transactional'} API`);

        const payload = {
            from: { email: senderEmail, name: "Flex Zone Gym" },
            to: [{ email: to, name: name || to }],
            subject: subject,
            text: body,
            category: "Manual Notification"
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${mailtrapToken}`,
                "Api-Token": mailtrapToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Mailtrap API Error (${response.status}):`, errorText);

            let userError = "Mailtrap API failure";
            if (response.status === 401) {
                userError = inboxId
                    ? "Unauthorized: The token is invalid for this Inbox ID."
                    : "Unauthorized: If you are using a Sandbox token, you must provide a MAILTRAP_INBOX_ID to use the correct API endpoint.";
            }

            return new Response(JSON.stringify({
                error: userError,
                status: response.status,
                details: errorText,
                apiUrlUsed: apiUrl
            }), {
                status: response.status === 401 ? 401 : 502,
                headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
            });
        }

        console.log("Email sent successfully!");
        return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
        });

    } catch (err) {
        console.error("Critical Send Email Error:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
        });
    }
});
