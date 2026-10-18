// Stripe billing over plain REST (no SDK): hosted Checkout for upgrades, the customer
// portal for changes and cancellations, and signed webhooks as the only writer of plan
// state. Card data never touches this server. Needs STRIPE_SECRET_KEY and
// STRIPE_WEBHOOK_SECRET; prices are created inline from src/shared/plans.json.
const crypto = require('crypto');
const catalogue = require('../../src/shared/plans.json');

const API = 'https://api.stripe.com/v1';
const configured = () => Boolean(process.env.STRIPE_SECRET_KEY);
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// Stripe wants form encoding with bracketed keys for nesting.
function encode(obj, prefix = '', out = new URLSearchParams()) {
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || v === null) continue;
        const key = prefix ? `${prefix}[${k}]` : k;
        if (typeof v === 'object') encode(v, key, out);
        else out.append(key, String(v));
    }
    return out;
}

async function stripe(path, body) {
    if (!configured()) {
        const err = new Error('Billing is not configured on this server');
        err.status = 503;
        throw err;
    }
    const res = await fetch(`${API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: body ? encode(body).toString() : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error?.message || `Stripe responded ${res.status}`);
        err.status = res.status >= 500 ? 502 : 400;
        throw err;
    }
    return data;
}

// Price in the smallest currency unit for a plan + interval.
function unitAmount(plan, interval) {
    const monthly = catalogue.plans[plan]?.monthly;
    if (!monthly) return null;
    return interval === 'year'
        ? Math.round(monthly * 12 * (1 - catalogue.yearlyDiscount)) * 100
        : monthly * 100;
}

async function createCheckout({ user, plan = 'team', interval = 'month' }) {
    const amount = unitAmount(plan, interval);
    if (!amount) {
        const err = new Error('That plan cannot be purchased online');
        err.status = 400;
        throw err;
    }
    // One free trial per customer: skip it once a Stripe customer exists for this user.
    const trial = !user.stripe_customer_id && !user.trial_ends_at ? catalogue.trialDays : undefined;
    return stripe('/checkout/sessions', {
        mode: 'subscription',
        client_reference_id: user.auth_provider_id,
        ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
        line_items: {
            0: {
                quantity: 1,
                price_data: {
                    currency: catalogue.currency.toLowerCase(),
                    unit_amount: amount,
                    recurring: { interval },
                    product_data: { name: `Utkristi CoLabs ${catalogue.plans[plan].name}` },
                },
            },
        },
        subscription_data: { metadata: { uid: user.auth_provider_id, plan, interval }, trial_period_days: trial },
        metadata: { uid: user.auth_provider_id },
        allow_promotion_codes: true,
        success_url: `${appUrl()}/settings?section=billing&billing=success`,
        cancel_url: `${appUrl()}/pricing?billing=cancelled`,
    });
}

const createPortal = (customerId) =>
    stripe('/billing_portal/sessions', { customer: customerId, return_url: `${appUrl()}/settings?section=billing` });

// Verify the Stripe-Signature header against the raw request body.
function verifyWebhook(rawBody, header, tolerance = 300) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !header) return false;
    const parts = header.split(',').map((p) => p.split('='));
    const t = Number((parts.find(([k]) => k === 't') || [])[1]);
    if (!t || Math.abs(Date.now() / 1000 - t) > tolerance) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    return parts.filter(([k]) => k === 'v1').some(([, sig]) => sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

// Map a Stripe subscription to the fields we store.
function planFromSubscription(sub) {
    const live = ['active', 'trialing', 'past_due'].includes(sub.status);
    const item = sub.items && sub.items.data && sub.items.data[0];
    return {
        plan: live ? ((sub.metadata && sub.metadata.plan) || 'team') : 'free',
        status: sub.status,
        interval: (item && item.price && item.price.recurring && item.price.recurring.interval) || (sub.metadata && sub.metadata.interval) || null,
        renewsAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        customerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id),
        subscriptionId: sub.id,
        uid: (sub.metadata && sub.metadata.uid) || null,
    };
}

// Identify the caller from a Firebase ID token (Authorization: Bearer ...). Payment
// endpoints must not trust a userId sent in the body.
async function verifyFirebaseUser(req) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const key = process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
    if (!token || !key) return null;
    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.users && data.users[0] && data.users[0].localId) || null;
    } catch {
        return null;
    }
}

module.exports = { configured, createCheckout, createPortal, verifyWebhook, planFromSubscription, verifyFirebaseUser, catalogue };
