// Meeting emails: one per person, greeting them by name, with the details, calendar links and
// how to join. Inline styles and tables only, so it looks the same in Gmail, Outlook and phones.

const APP = () => process.env.APP_URL || 'http://localhost:5000';
// Mail apps fetch images from the internet, so a local address can't serve the logo.
const LOGO = () => `${/localhost|127\.0\.0\.1/.test(APP()) ? 'https://utkristi-colabs.onrender.com' : APP()}/icon-512.png`;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lines = (v) => esc(v).replace(/\r?\n/g, '<br>');

const validZone = (tz) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return 'UTC'; }
};
const dateText = (d, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(d));
const timeText = (d, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const zoneText = (tz) => tz.replace(/_/g, ' ');
const endOf = (m) => new Date(new Date(m.starts_at).getTime() + m.duration_min * 60000);
const length = (min) => (min % 60 === 0 ? `${min / 60} hour${min === 60 ? '' : 's'}` : min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

// "priya.sharma_92@x.com" -> "Priya Sharma"; falls back to the part before the @.
function nameFromEmail(email) {
    const local = String(email || '').split('@')[0];
    const words = local.split(/[._\-+]+/).filter((w) => /[a-z]/i.test(w)).map((w) => w.replace(/\d+/g, ''));
    const pretty = words.filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return pretty || local;
}

// The meeting page, carrying the person's name so the room greets them without asking.
const meetingUrl = (m, name) => `${APP()}/meet/${m.id}${name ? `?as=${encodeURIComponent(name)}` : ''}`;

const calDetails = (m) => `${m.description ? `${m.description}\n\n` : ''}Join: ${meetingUrl(m)}`;
const gDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const googleUrl = (m) => `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE', text: m.title, dates: `${gDate(m.starts_at)}/${gDate(endOf(m))}`, details: calDetails(m), location: meetingUrl(m),
})}`;
const outlookUrl = (m) => `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams({
    path: '/calendar/action/compose', rru: 'addevent', subject: m.title, startdt: new Date(m.starts_at).toISOString(),
    enddt: endOf(m).toISOString(), body: calDetails(m), location: meetingUrl(m),
})}`;
const icsUrl = (m) => `${APP()}/api/meetings/${encodeURIComponent(m.id)}/ics`;

const ACCESS = {
    public: 'Anyone with the link',
    invite: 'Invited people join directly; others knock',
    private: 'Invited people only (sign in with this email)',
};

// The app's light theme, for email (most mail apps show a light page): paper, navy ink, and
// a dark navy panel like the app's panes. Condensed uppercase Archivo headings, mono labels.
const T = {
    paper: '#F5F7FB', card: '#FCFDFF', raise: '#FFFFFF', ink: '#0E1A33', ink2: '#4F5B73', ink3: '#5B6880',
    line: '#E1E5EE', line2: '#C3C9D6', mark: '#2F62C9', pane: '#0A1326', paneInk: '#E6ECF7', paneInk2: '#A9B4C9',
    ok: '#16A34A', bad: '#DC2626', warn: '#D97706',
    display: "'Archivo', 'Helvetica Neue', Arial, sans-serif",
    text: "'Archivo', 'Inter', 'Helvetica Neue', Arial, sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
};

// What each kind of email says. `kind`: invite | updated | rescheduled | cancelled | removed | reminder
// `dot` is the status light (the app's ok / warn / bad colours, or the mark).
const KINDS = {
    invite: { tag: 'Invitation', dot: T.mark, subject: (m) => `Invitation: ${m.title}`, lead: (m) => `${m.host_name || 'Your host'} invited you to a call.`, cta: 'Open meeting' },
    updated: { tag: 'Updated', dot: T.mark, subject: (m) => `Updated: ${m.title}`, lead: (m) => `${m.host_name || 'Your host'} changed the meeting details.`, cta: 'Open meeting' },
    rescheduled: { tag: 'New time', dot: T.warn, subject: (m) => `Rescheduled: ${m.title}`, lead: (m) => `${m.host_name || 'Your host'} moved this meeting to a new time.`, cta: 'Open meeting' },
    cancelled: { tag: 'Cancelled', dot: T.bad, subject: (m) => `Cancelled: ${m.title}`, lead: (m) => `${m.host_name || 'Your host'} cancelled this meeting. You can remove it from your calendar.`, cta: null },
    removed: { tag: 'Removed', dot: T.ink3, subject: (m) => `You're no longer invited: ${m.title}`, lead: (m) => `${m.host_name || 'The host'} updated the guest list, and this meeting no longer includes you.`, cta: null },
    reminder: { tag: 'Starting soon', dot: T.ok, subject: (m) => `Starting soon: ${m.title}`, lead: () => 'Your meeting starts in about 10 minutes. The room is open now.', cta: 'Join now' },
};

const label = (text, extra = '') => `<div style="font-family:${T.mono};font-size:11px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:${T.ink3};${extra}">${text}</div>`;

const row = (name, value) => `
    <tr>
      <td style="padding:12px 0;width:116px;vertical-align:top;border-top:1px solid ${T.line};">${label(name, 'padding-top:4px;')}</td>
      <td style="padding:12px 0;vertical-align:top;border-top:1px solid ${T.line};font-family:${T.text};font-size:15px;line-height:1.5;color:${T.ink};">${value}</td>
    </tr>`;

const calButton = (href, text) => `<a href="${esc(href)}" style="display:inline-block;margin:0 6px 8px 0;padding:9px 14px;border:1px solid ${T.line2};border-radius:999px;font-family:${T.mono};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${T.ink};text-decoration:none;background:${T.raise};">${text}</a>`;

const step = (n, title, text) => `
    <tr>
      <td style="width:40px;vertical-align:top;padding:0 0 16px;font-family:${T.mono};font-size:12px;color:${T.ink3};">0${n}</td>
      <td style="vertical-align:top;padding:0 0 16px;font-family:${T.text};font-size:14px;line-height:1.55;color:${T.ink2};"><strong style="color:${T.ink};font-weight:600;">${title}</strong><br>${text}</td>
    </tr>`;

/**
 * Builds one meeting email. Returns { subject, html }.
 * @param m        meeting row (snake_case, as stored)
 * @param to       { email, name? } the person it's for
 * @param kind     see KINDS
 * @param previous the meeting before a reschedule (to show the old time)
 */
function meetingEmail(m, { to, kind = 'invite', previous = null }) {
    const k = KINDS[kind] || KINDS.invite;
    const tz = validZone(m.time_zone);
    const name = to?.name || nameFromEmail(to?.email);
    const first = name.split(' ')[0];
    const link = meetingUrl(m, name);
    const live = kind !== 'cancelled' && kind !== 'removed';
    const startText = `${dateText(m.starts_at, tz)}<br>${timeText(m.starts_at, tz)} &ndash; ${timeText(endOf(m), tz)} <span style="font-family:${T.mono};font-size:12px;color:${T.ink3};">${esc(zoneText(tz))}</span>`;
    const pz = previous ? validZone(previous.time_zone) : tz;
    const wasText = previous && new Date(previous.starts_at).getTime() !== new Date(m.starts_at).getTime()
        ? `<div style="margin-top:6px;font-family:${T.mono};font-size:12px;color:${T.ink3};"><span style="text-decoration:line-through;">${dateText(previous.starts_at, pz)}, ${timeText(previous.starts_at, pz)}</span> &nbsp;was</div>`
        : '';

    const details = [
        row('When', `${startText}${wasText}`),
        row('Length', length(m.duration_min)),
        row('Host', esc(m.host_name || 'Your host')),
        live ? row('Who can join', esc(ACCESS[m.access] || ACCESS.public)) : '',
        m.description ? row('Notes', `<span style="color:${T.ink2};">${lines(m.description)}</span>`) : '',
    ].join('');

    const howTo = live ? `
        <tr><td style="padding:28px 32px 8px;">
          ${label('How to join', 'margin-bottom:16px;')}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${step(1, 'Open the meeting link', kind === 'reminder' ? 'The room is open now. Use the button above.' : 'The Join button opens 10 minutes before the start. Until then you can add it to your calendar.')}
            ${step(2, 'Check your name', `You'll join as <strong style="color:${T.ink};">${esc(name)}</strong>. You can change it before entering.${m.access === 'private' ? ` This meeting is for invitees only, so sign in with ${esc(to?.email || 'this email')}.` : ' No account needed.'}`)}
            ${step(3, 'Allow camera and microphone', 'Your browser asks once when you join. Mute or turn the camera off at any time, share your screen, and code together in the same room.')}
          </table>
        </td></tr>` : '';

    const calendar = live && kind !== 'reminder' ? `
        <tr><td style="padding:24px 32px 0;">
          ${label(kind === 'invite' ? 'Add to calendar' : 'Update your calendar', 'margin-bottom:12px;')}
          ${calButton(googleUrl(m), 'Google')}${calButton(outlookUrl(m), 'Outlook')}${calButton(icsUrl(m), 'Apple / .ics')}
        </td></tr>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(k.subject(m))}</title>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${T.paper};font-family:${T.text};color:${T.ink};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(k.lead(m))} ${dateText(m.starts_at, tz)}, ${timeText(m.starts_at, tz)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.paper};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr><td style="padding:0 4px 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;padding-right:10px;"><img src="${LOGO()}" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;"></td>
            <td style="vertical-align:middle;font-family:${T.display};font-stretch:62%;font-weight:700;font-size:16px;line-height:1;letter-spacing:.02em;text-transform:uppercase;color:${T.ink};">Utkristi CoLabs</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${T.card};border:1px solid ${T.line};border-radius:22px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:${T.pane};padding:26px 32px 28px;border-radius:21px 21px 0 0;">
              <div style="font-family:${T.mono};font-size:11px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:${T.paneInk2};">
                <span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${k.dot};margin-right:8px;vertical-align:1px;"></span>${k.tag}
              </div>
              <h1 style="margin:16px 0 0;font-family:${T.display};font-stretch:62%;font-weight:700;font-size:40px;line-height:.92;letter-spacing:-.01em;text-transform:uppercase;color:${T.paneInk};${live ? '' : 'text-decoration:line-through;text-decoration-thickness:2px;'}">${esc(m.title)}</h1>
            </td></tr>
            <tr><td style="padding:24px 32px 6px;">
              <p style="margin:0;font-family:${T.text};font-size:15px;line-height:1.6;color:${T.ink2};">Hi ${esc(first)}, ${esc(k.lead(m))}</p>
            </td></tr>
            <tr><td style="padding:14px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${T.line};">
                ${details}
              </table>
            </td></tr>
            ${k.cta ? `
            <tr><td style="padding:24px 32px 0;">
              <a href="${esc(link)}" style="display:block;text-align:center;background:${T.ink};color:${T.paper};padding:15px 20px;border-radius:999px;font-family:${T.text};font-size:15px;font-weight:600;text-decoration:none;">${k.cta} &rarr;</a>
              <p style="margin:10px 0 0;font-family:${T.mono};font-size:11px;line-height:1.5;color:${T.ink3};text-align:center;word-break:break-all;">${esc(meetingUrl(m))}</p>
            </td></tr>` : ''}
            ${calendar}
            ${howTo}
            <tr><td style="padding:${live ? '4px' : '24px'} 32px 28px;">
              <p style="margin:0;padding-top:16px;border-top:1px solid ${T.line};font-family:${T.text};font-size:13px;line-height:1.6;color:${T.ink3};">${live
        ? `Can't make it? Let ${esc(m.host_name || 'the host')} know${m.host_email ? ` at <a href="mailto:${esc(m.host_email)}" style="color:${T.mark};text-decoration:none;">${esc(m.host_email)}</a>` : ''}.`
        : `Nothing else to do. ${m.host_email ? `Questions? Write to <a href="mailto:${esc(m.host_email)}" style="color:${T.mark};text-decoration:none;">${esc(m.host_email)}</a>.` : ''}`}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 8px 0;text-align:center;font-family:${T.mono};font-size:11px;line-height:1.8;color:${T.ink3};">
          ${esc(m.host_name || 'Someone')} added ${esc(to?.email || 'you')} to a meeting on Utkristi CoLabs.<br>
          <a href="${APP()}/unsubscribe?email=${encodeURIComponent(to?.email || '')}" style="color:${T.ink3};">Email settings</a> &middot; <a href="${APP()}/support" style="color:${T.ink3};">Help</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    return { subject: k.subject(m), html };
}

module.exports = { meetingEmail, nameFromEmail, meetingUrl };
