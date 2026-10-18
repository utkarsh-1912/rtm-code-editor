// OneSignal delivery: web/desktop push to a signed-in user (their Firebase uid is the
// OneSignal external_id) and transactional email as a fallback when Brevo is unavailable.
// Configure ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY; nothing is sent without them.
const API = "https://api.onesignal.com/notifications?c=";

const configured = () => Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);

async function post(body, channel) {
    if (!configured()) return { ok: false, reason: "OneSignal is not configured" };
    try {
        const res = await fetch(API + channel, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({ app_id: process.env.ONESIGNAL_APP_ID, ...body }),
        });
        const data = await res.json().catch(() => ({}));
        // OneSignal answers 200 with an "errors" field when nobody is subscribed.
        const failed = !res.ok || (data.errors && !data.id);
        return { ok: !failed, status: res.status, id: data.id, reason: failed ? JSON.stringify(data.errors || data) : undefined };
    } catch (err) {
        return { ok: false, reason: err.message };
    }
}

// Push to one signed-in user (all of their subscribed browsers/devices).
const pushToUser = (uid, { title = "Utkristi CoLabs", message, url, data }) => {
    if (!uid || !message) return Promise.resolve({ ok: false, reason: "Missing user or message" });
    return post({
        target_channel: "push",
        include_aliases: { external_id: [String(uid)] },
        headings: { en: title },
        contents: { en: message },
        ...(url ? { url } : {}),
        ...(data ? { data } : {}),
    }, "push");
};

// Email through OneSignal (needs a verified sender domain in the OneSignal dashboard).
const sendEmail = ({ to, subject, html }) => {
    const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (!list.length) return Promise.resolve({ ok: false, reason: "No recipient" });
    return post({
        target_channel: "email",
        include_email_tokens: list,
        email_subject: subject,
        email_body: html,
        ...(process.env.ONESIGNAL_FROM_EMAIL ? { email_from_address: process.env.ONESIGNAL_FROM_EMAIL } : {}),
        ...(process.env.ONESIGNAL_FROM_NAME ? { email_from_name: process.env.ONESIGNAL_FROM_NAME } : {}),
    }, "email");
};

module.exports = { configured, pushToUser, sendEmail };
