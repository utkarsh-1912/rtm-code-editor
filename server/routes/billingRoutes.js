const express = require('express');
const router = express.Router();
const Billing = require('../services/BillingService');
const PlanRepository = require('../repositories/PlanRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');

const planView = ({ user, plan, limits }, usage) => ({
    plan,
    status: (user && user.plan_status) || null,
    interval: (user && user.plan_interval) || null,
    renewsAt: (user && user.plan_renews_at) || null,
    cancelAtPeriodEnd: Boolean(user && user.plan_cancel_at_period_end),
    trialEndsAt: (user && user.trial_ends_at) || null,
    hasCustomer: Boolean(user && user.stripe_customer_id),
    limits,
    usage,
    billingEnabled: Billing.configured(),
});

// Resolve the signed-in caller or answer 401.
async function caller(req, res) {
    const uid = await Billing.verifyFirebaseUser(req);
    if (!uid) { res.status(401).json({ error: 'Sign in again to continue' }); return null; }
    return uid;
}

router.get('/billing/status', async (req, res) => {
    try {
        const uid = await caller(req, res);
        if (!uid) return;
        const [info, usage] = await Promise.all([PlanRepository.getPlan(uid), PlanRepository.getUsage(uid)]);
        res.json(planView(info, usage));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load your plan' });
    }
});

router.post('/billing/checkout', async (req, res) => {
    try {
        const uid = await caller(req, res);
        if (!uid) return;
        const { plan = 'team', interval = 'month' } = req.body || {};
        if (!['month', 'year'].includes(interval)) return res.status(400).json({ error: 'Invalid billing interval' });
        const { user, plan: current } = await PlanRepository.getPlan(uid);
        if (!user) return res.status(404).json({ error: 'Account not found. Reload and try again.' });
        if (current !== 'free') return res.status(409).json({ error: 'You already have a paid plan. Use Manage billing to change it.' });
        const session = await Billing.createCheckout({ user, plan, interval });
        res.json({ url: session.url });
    } catch (err) {
        console.error('Checkout error:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    }
});

router.post('/billing/portal', async (req, res) => {
    try {
        const uid = await caller(req, res);
        if (!uid) return;
        const { user } = await PlanRepository.getPlan(uid);
        if (!user || !user.stripe_customer_id) return res.status(404).json({ error: 'No billing account yet' });
        const session = await Billing.createPortal(user.stripe_customer_id);
        res.json({ url: session.url });
    } catch (err) {
        console.error('Portal error:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Stripe calls this with the raw body; the signature is checked before anything is trusted.
router.post('/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
    if (!Billing.verifyWebhook(raw, req.headers['stripe-signature'])) return res.status(400).send('Bad signature');
    try {
        const event = JSON.parse(raw);
        const obj = event.data && event.data.object;
        if (event.type === 'checkout.session.completed' && obj && obj.client_reference_id && obj.customer) {
            await PlanRepository.setCustomer(obj.client_reference_id, obj.customer);
        } else if (event.type && event.type.startsWith('customer.subscription.') && obj) {
            const s = Billing.planFromSubscription(obj);
            const user = await PlanRepository.applySubscription(s);
            const started = event.type === 'customer.subscription.created' && s.plan !== 'free';
            if (user && started && s.status === 'trialing') {
                AnalyticsRepository.logActivity({ userId: user.auth_provider_id, actionType: 'TRIAL_STARTED', metadata: { interval: s.interval } }).catch(() => { });
            }
            const ended = event.type === 'customer.subscription.deleted';
            if (user && (started || ended)) {
                NotificationRepository.notifyUser(user.auth_provider_id, {
                    type: 'billing',
                    message: ended ? 'Your Team plan has ended. You are back on Free.' : 'Welcome to Team. Unlimited projects and AI are on.',
                    url: `${process.env.APP_URL || ''}/settings?section=billing`,
                }).catch(() => { });
            }
        }
        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Webhook failed'); // Stripe retries
    }
});

module.exports = router;
