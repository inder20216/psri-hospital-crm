import { WA_TEMPLATES } from './waNotifications';

// ── Support contacts ─────────────────────────────────────────────────────────
// Fill these in and the Support page shows a big tap-to-open button for each
// one. Leave any of them empty ('') and that channel is simply hidden.
//
//   whatsapp : country code + number, digits only (no +, no spaces)
//              e.g. '919667224319'  ->  opens https://wa.me/919667224319
//   phone    : anything readable, e.g. '+91 96672 24319'  ->  opens tel:
//   email    : e.g. 'support@example.com'  ->  opens mailto:
//   hours    : free text, e.g. 'Mon–Sat, 9:00 am – 7:00 pm'
export const SUPPORT = {
  whatsapp: '',
  phone: '',
  email: '',
  hours: '',
};

const waHref = v => `https://wa.me/${String(v).replace(/\D/g, '')}`;
const telHref = v => `tel:${String(v).replace(/[^+\d]/g, '')}`;

export default function SupportPage() {
  const hasContact = Boolean(SUPPORT.whatsapp || SUPPORT.phone || SUPPORT.email);

  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">Support</h1>
          <p className="psri-subtitle">
            How to get help with the CRM, and how the WhatsApp notifications work.
          </p>
        </div>
      </div>

      {/* ── Contacting the team ── */}
      <section className="psri-sup-card">
        <h2 className="psri-sup-h">Reach the CRM support team</h2>

        {!hasContact && (
          <p className="psri-sup-hint">
            No support contact has been set up yet. Ask your administrator to fill in the
            <code> SUPPORT </code> details in <code>src/projects/psri/SupportPage.jsx</code>.
          </p>
        )}

        {hasContact && (
          <div className="psri-sup-rows">
            {SUPPORT.whatsapp && (
              <a
                className="psri-sup-row psri-sup-row--wa"
                href={waHref(SUPPORT.whatsapp)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="psri-sup-icon">💬</span>
                <span className="psri-sup-row-txt">
                  <strong>WhatsApp</strong>
                  <small>Usually the fastest way to reach us</small>
                </span>
                <span className="psri-sup-go">{SUPPORT.whatsapp} →</span>
              </a>
            )}

            {SUPPORT.phone && (
              <a className="psri-sup-row" href={telHref(SUPPORT.phone)}>
                <span className="psri-sup-icon">📞</span>
                <span className="psri-sup-row-txt">
                  <strong>Phone</strong>
                  <small>Call the support desk</small>
                </span>
                <span className="psri-sup-go">{SUPPORT.phone} →</span>
              </a>
            )}

            {SUPPORT.email && (
              <a className="psri-sup-row" href={`mailto:${SUPPORT.email}`}>
                <span className="psri-sup-icon">✉️</span>
                <span className="psri-sup-row-txt">
                  <strong>Email</strong>
                  <small>For anything that needs a screenshot attached</small>
                </span>
                <span className="psri-sup-go">{SUPPORT.email} →</span>
              </a>
            )}
          </div>
        )}

        {SUPPORT.hours && <p className="psri-sup-hours">Support hours: {SUPPORT.hours}</p>}
      </section>

      {/* ── The WhatsApp notification list ── */}
      <section className="psri-sup-card">
        <h2 className="psri-sup-h">How the WhatsApp notifications work</h2>
        <p className="psri-sup-lead">
          Open <strong>WhatsApp</strong> in the left rail. Every case that triggers a notification is
          listed under the notification it belongs to:
        </p>

        <ol className="psri-sup-list">
          {WA_TEMPLATES.map(t => (
            <li key={t.key}>
              <span className="psri-wa-chip-num psri-sup-num">{t.n}</span>
              <span><strong>{t.title}</strong> — {t.trigger}</span>
            </li>
          ))}
          <li>
            <span className="psri-wa-chip-num psri-sup-num">✓</span>
            <span><strong>Copied</strong> — the ones you have already copied</span>
          </li>
        </ol>

        <ol className="psri-sup-steps">
          <li>
            Open a notification and check the patient's name, number and concern against the case.
          </li>
          <li>
            Press <strong>Copy message</strong> — the wording for that notification goes to your
            clipboard, ready to paste.
          </li>
          <li>
            Press <strong>Send in group</strong> to open the WhatsApp group of the desk that should
            act on it, then paste the message there. (This button is switched on once WhatsApp
            sending is enabled for your desk.)
          </li>
          <li>
            The notification then moves to <strong>✓ Copied</strong>, so <strong>All</strong> only
            shows what is still waiting.
          </li>
          <li>
            Use the chips at the top to filter by notification, and the search box to look up a
            patient by name, mobile, or concern.
          </li>
          <li>
            On a laptop, <strong>📱 Open on phone</strong> shows a QR code — scan it to open the same
            page on your phone. <strong>↻ Refresh</strong> reloads the list.
          </li>
        </ol>
      </section>

      {/* ── Reporting a problem ── */}
      <section className="psri-sup-card">
        <h2 className="psri-sup-h">Reporting a problem</h2>
        <p className="psri-sup-lead">Please include these with your message — it saves a round trip:</p>
        <ul className="psri-sup-list psri-sup-list--plain">
          <li>What you were doing, and which page you were on.</li>
          <li>The <strong>Case ID</strong>, or the patient's name and mobile number.</li>
          <li>What you expected to happen, and what actually happened.</li>
          <li>A screenshot of the screen, if you can — this is why WhatsApp or email works better than a phone call for bugs.</li>
        </ul>
        <p className="psri-sup-note">
          To suggest a new value for a dropdown (or correct an existing one), use{' '}
          <strong>Suggestions</strong> in the left rail instead — those are reviewed and approved in
          the same place.
        </p>
      </section>
    </div>
  );
}
