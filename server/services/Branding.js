// Custom branding (Enterprise only): a team's name, colour and logo on what candidates see —
// the meeting page, booking page and meeting emails. Checked against the team owner's plan
// every time it's shown, so it switches off by itself if the plan changes.
const { sql } = require('../repositories/DatabaseClient');
const PlanRepository = require('../repositories/PlanRepository');

const APP = () => process.env.APP_URL || 'http://localhost:5000';
const LOGO_MAX = 200 * 1024; // bytes of image data
const COLOR = /^#[0-9a-f]{6}$/i;

async function ownerHasBranding(org) {
    const owner = await sql`SELECT auth_provider_id FROM users WHERE id = ${org.owner_id}`;
    if (!owner[0]) return false;
    const { limits } = await PlanRepository.getPlan(owner[0].auth_provider_id);
    return !!limits?.branding;
}

// The branded team a host's new meetings use: one they own or administer, with branding set
// and an Enterprise plan. null when there isn't one.
async function brandOrgFor(uid) {
    const rows = await sql`
        SELECT o.* FROM organizations o
        JOIN organization_members om ON om.org_id = o.id
        JOIN users u ON u.id = om.user_id
        WHERE u.auth_provider_id = ${uid} AND om.role IN ('owner', 'admin')
          AND (o.brand_name IS NOT NULL OR o.brand_logo IS NOT NULL OR o.brand_color IS NOT NULL)
        ORDER BY o.id
    `;
    for (const org of rows) if (await ownerHasBranding(org)) return org.id;
    return null;
}

// What to show: { name, color, logo (public URL) } or null.
async function brandFor(orgId) {
    if (!orgId) return null;
    const rows = await sql`SELECT id, name, owner_id, brand_name, brand_color, brand_logo FROM organizations WHERE id = ${orgId}`;
    const org = rows[0];
    if (!org || !(await ownerHasBranding(org))) return null;
    if (!org.brand_name && !org.brand_logo && !org.brand_color) return null;
    return {
        name: org.brand_name || org.name,
        color: COLOR.test(org.brand_color || '') ? org.brand_color : null,
        logo: org.brand_logo ? `${APP()}/api/brand/${org.id}/logo` : null,
    };
}

// Validates a logo upload: a PNG, JPEG or WebP data URL (no SVG: it can carry scripts).
function cleanLogo(value) {
    if (value === null || value === '') return null;
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
    if (!m) throw Object.assign(new Error('Upload a PNG, JPEG or WebP image.'), { status: 400 });
    if (Buffer.byteLength(m[2], 'base64') > LOGO_MAX) throw Object.assign(new Error('Keep the logo under 200 KB.'), { status: 400 });
    return value;
}

async function logoImage(orgId) {
    const rows = await sql`SELECT brand_logo, owner_id FROM organizations WHERE id = ${Number(orgId) || 0}`;
    const org = rows[0];
    if (!org?.brand_logo || !(await ownerHasBranding(org))) return null;
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(org.brand_logo);
    return m ? { type: m[1], data: Buffer.from(m[2], 'base64') } : null;
}

module.exports = { brandOrgFor, brandFor, cleanLogo, logoImage, ownerHasBranding, COLOR };
