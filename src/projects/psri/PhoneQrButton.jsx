import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// The address the QR encodes: this same page, opened on a phone. In local dev
// window.location is localhost, which a phone cannot reach, so point at the
// deployed site instead.
const PROD_ORIGIN = 'https://inder20216.github.io/psri-hospital-crm';
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

export function pageUrlForQr() {
  if (typeof window === 'undefined') return '';
  const { hostname, pathname, search, hash, href } = window.location;
  if (LOCAL_HOST_RE.test(hostname)) return `${PROD_ORIGIN}${pathname}${search}${hash}`;
  return href;
}

// Copy text, with a fallback for browsers that block the async clipboard.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

/**
 * "Open on phone" — a button that reveals a QR code for the current page, so
 * the same list can be scanned open on a phone instead of typed out.
 *
 * Shared by the WhatsApp Notifications page and Prospects so both encode the
 * address the admin is actually looking at (including the tab, when it is in
 * the URL). Clicking a button is a user gesture, so "Copy link" is allowed.
 */
export default function PhoneQrButton({ className = '', label = '📱 Open on phone', title = 'Show a QR code to open this page on a phone', note }) {
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Recomputed on open so it always matches the page/tab it was pressed on.
  const open = useCallback(() => {
    setUrl(pageUrlForQr());
    setCopied(false);
    setShow(true);
  }, []);

  const copyLink = useCallback(async () => {
    await copyText(url);
    setCopied(true);
  }, [url]);

  // Esc closes the dialog.
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShow(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  return (
    <>
      <button type="button" className={className} onClick={open} title={title}>
        {label}
      </button>

      {show && (
        <div className="psri-modal-overlay" onClick={() => setShow(false)}>
          <div className="psri-modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="psri-modal-title">📱 Open on your phone</div>
            <div className="psri-qr-body">
              <div className="psri-qr-card">
                <QRCodeSVG
                  value={url || ' '}
                  size={208}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  title="Scan to open this page on your phone"
                />
              </div>
              <div className="psri-qr-url">{url}</div>
              <p className="psri-qr-note">
                {note || 'Point your phone camera at this code to open this page on the phone. You will be asked to sign in with your PSRI account there.'}
              </p>
            </div>
            <div className="psri-modal-actions">
              <button type="button" className="psri-btn-ghost" onClick={() => setShow(false)}>
                Close
              </button>
              <button type="button" className="psri-btn-primary" onClick={copyLink}>
                {copied ? 'Link copied ✓' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}