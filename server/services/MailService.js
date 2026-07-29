const fetchRelay = async (url, body, apiKey) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const resBody = await res.text();
  return { status: res.status, body: resBody };
};

const getEmailTemplate = ({ title, message, ctaText, ctaUrl, inviterName, inviterPhoto, recipientEmail, isWelcome = false }) => {
  const logoUrl = "https://utkristi-colabs.onrender.com/utkristi-colabs.png";
  const inviterInitials = (inviterName || "U").charAt(0).toUpperCase();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 80px 0; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 40px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .header { padding: 64px 64px 48px; text-align: center; }
    .logo { height: 24px; width: auto; margin: 0 auto 48px; display: block; }
    .inviter-pill { display: inline-block; background: #f8fafc; padding: 10px 20px; border-radius: 100px; border: 1px solid #e2e8f0; margin: 0 auto 40px; text-align: center; }
    .avatar-mini { width: 28px; height: 28px; border-radius: 50%; background: #2563eb; color: #ffffff; display: inline-block; vertical-align: middle; font-size: 12px; font-weight: 800; line-height: 28px; margin-right: 12px; overflow: hidden; text-align: center; }
    .avatar-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .inviter-text { color: #475569; font-size: 13px; font-weight: 600; display: inline-block; vertical-align: middle; line-height: 28px; }
    .hero-title { color: #0f172a; font-size: 34px; font-weight: 800; margin: 0 0 20px; letter-spacing: -0.03em; line-height: 1.2; }
    .hero-subtitle { color: #64748b; font-size: 17px; margin: 0; line-height: 1.6; }
    .content { padding: 0 64px 64px; color: #334155; }
    .message-body { font-size: 18px; line-height: 1.9; color: #475569; margin-bottom: 56px; text-align: center; background: #f8fafc; padding: 48px; border-radius: 32px; border: 1px solid #f1f5f9; }
    .cta-area { text-align: center; margin-bottom: 64px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 24px 64px; border-radius: 24px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2); }
    .feature-grid { width: 100%; border-top: 1px solid #f1f5f9; padding-top: 64px; margin-top: 0; }
    .feature-item { width: 48%; display: inline-block; vertical-align: top; margin-bottom: 40px; box-sizing: border-box; }
    .feature-item-inner { padding-right: 20px; }
    .feature-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; line-height: 1.4; }
    .feature-icon { font-size: 20px; margin-bottom: 12px; display: block; }
    .feature-desc { font-size: 13px; color: #64748b; line-height: 1.7; }
    .footer { padding: 64px; text-align: center; background-color: #ffffff; border-top: 1px solid #f1f5f9; }
    .footer-links { margin-top: 40px; padding-top: 40px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 2.2; }
    .unsubscribe { color: #2563eb; text-decoration: none; font-weight: 600; }
    @media only screen and (max-width: 640px) {
      .wrapper { padding: 24px 0; }
      .main { border-radius: 0; border-left: none; border-right: none; }
      .header { padding: 56px 32px 40px; }
      .hero-title { font-size: 28px; }
      .content { padding: 0 32px 48px; }
      .message-body { padding: 32px; font-size: 16px; margin-bottom: 40px; }
      .cta-area { margin-bottom: 48px; }
      .btn { padding: 20px 48px; width: 100%; box-sizing: border-box; }
      .feature-item { width: 100%; display: block; margin-bottom: 32px; }
      .footer { padding: 48px 32px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <img src="${logoUrl}" alt="Utkristi Colabs" class="logo">
        ${!isWelcome ? `
        <div class="inviter-pill">
          <div class="avatar-mini">
            ${inviterPhoto ? `<img src="${inviterPhoto}" alt="${inviterName}">` : inviterInitials}
          </div>
          <span class="inviter-text">${inviterName || 'A teammate'} is inviting you</span>
        </div>
        ` : `
        <div class="inviter-pill" style="background: #f0fdf4; border-color: #dcfce7; color: #166534;">
          <span class="inviter-text" style="color: #166534; margin: 0;">🚀 System Onboarding Active</span>
        </div>
        `}
        <h1 class="hero-title">${title}</h1>
        <p class="hero-subtitle">The secure workspace where high-performance teams build together.</p>
      </div>
      <div class="content">
        <div class="message-body">
          ${message}
        </div>
        <div class="cta-area">
          <a href="${ctaUrl}" class="btn">${ctaText}</a>
        </div>
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-item-inner">
              <span class="feature-icon">⚡</span>
              <div class="feature-title">High-Speed Sync</div>
              <div class="feature-desc">Zero-latency collaborative engine optimized for rapid delivery and execution.</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-item-inner">
              <span class="feature-icon">🎥</span>
              <div class="feature-title">Live Video Mesh</div>
              <div class="feature-desc">Low-latency WebRTC streams with seamless screen sharing capabilities.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-links">
          Utkristi Colabs Enterprise Workspace<br>
          If you wish to manage email notifications, <a href="https://utkristi-colabs.onrender.com/unsubscribe?email=${encodeURIComponent(recipientEmail || '')}" class="unsubscribe">click here to unsubscribe</a>.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

async function sendMail({ to, subject, html, apiKey }) {
    const resendKey = apiKey || process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.log("No Resend API key configured. Email log:", { to, subject });
        return { success: false, reason: "No API Key" };
    }

    const payload = {
        from: "Utkristi Colabs <noreply@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
    };

    return await fetchRelay("https://api.resend.com/emails", payload, resendKey);
}

module.exports = {
    getEmailTemplate,
    sendMail,
    fetchRelay
};
