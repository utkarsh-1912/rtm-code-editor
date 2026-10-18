const { sql } = require('./DatabaseClient');
const { plans } = require('../../src/shared/plans.json');

// Plan name for a user. past_due keeps access (Stripe retries the card); anything
// that is not active, trialing or past_due is treated as Free.
const effectivePlan = (user) => (user && ['active', 'trialing', 'past_due'].includes(user.plan_status) && plans[user.plan] ? user.plan : 'free');

async function getPlan(uid) {
    const rows = await sql`SELECT * FROM users WHERE auth_provider_id = ${uid}`;
    const user = rows[0];
    const plan = effectivePlan(user);
    return { user, plan, limits: plans[plan].limits };
}

async function getUsage(uid) {
    const rows = await sql`
        SELECT
          (SELECT COUNT(*) FROM projects p JOIN users u ON u.id = p.user_id WHERE u.auth_provider_id = ${uid})::int AS projects,
          (SELECT COUNT(*) FROM analytics_logs WHERE user_id = ${uid} AND action_type = 'AI_PROMPT' AND created_at >= date_trunc('day', now()))::int AS ai_today
    `;
    return { projects: rows[0].projects, aiToday: rows[0].ai_today };
}

async function applySubscription(s) {
    const rows = s.uid
        ? await sql`SELECT id FROM users WHERE auth_provider_id = ${s.uid}`
        : await sql`SELECT id FROM users WHERE stripe_customer_id = ${s.customerId}`;
    if (!rows.length) return null;
    const updated = await sql`
        UPDATE users SET plan = ${s.plan}, plan_status = ${s.status}, plan_interval = ${s.interval},
            plan_renews_at = ${s.renewsAt}, plan_cancel_at_period_end = ${s.cancelAtPeriodEnd},
            trial_ends_at = COALESCE(${s.trialEndsAt}, trial_ends_at),
            stripe_customer_id = ${s.customerId}, stripe_subscription_id = ${s.subscriptionId}
        WHERE id = ${rows[0].id} RETURNING *
    `;
    return updated[0];
}

async function setCustomer(uid, customerId) {
    await sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE auth_provider_id = ${uid} AND stripe_customer_id IS NULL`;
}

module.exports = { effectivePlan, getPlan, getUsage, applySubscription, setCustomer };
