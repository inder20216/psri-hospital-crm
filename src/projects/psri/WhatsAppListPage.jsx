import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { psri } from '../../api/psri';
import { usePicklists } from '../../context/PicklistsContext';
import { resolveWhatsAppGroups, groupInviteLink } from './whatsappGroups';
import { WA_TEMPLATES, caseTemplates, buildWaMessage } from './waNotifications';
import { buildRepeatIndex, repeatTitle } from './repeatCalls';
import './Psri.css';

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
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

// Minimal RFC-4180 CSV reader: handles quoted fields, "" escapes and newlines
// inside quotes (case summaries often contain commas and line breaks).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const bool = v => v === '1' || String(v).toLowerCase() === 'true';

// The export's columns are snake_case DB names — map them onto the API shape
// the rest of the app reads (cases_row_to_api).
function parseCasesCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const idx = Object.fromEntries(rows[0].map((h, i) => [h, i]));
  const cell = (r, k) => (idx[k] == null ? '' : String(r[idx[k]] ?? ''));
  return rows.slice(1)
    .filter(r => r.length > 1 || cell(r, 'case_id') !== '')
    .map(r => ({
      id: cell(r, 'case_id'),
      contactName: cell(r, 'contact_name'),
      contactMobile: cell(r, 'contact_mobile'),
      callFor: cell(r, 'call_for'),
      typeOfEnquiry: cell(r, 'type_of_enquiry'),
      status: cell(r, 'status'),
      summary: cell(r, 'summary'),
      created: cell(r, 'created'),
      typeOfProcedure: cell(r, 'type_of_procedure'),
      nameOfProcedure: cell(r, 'name_of_procedure'),
      specialtyEnquiredFor: cell(r, 'specialty_enquired_for'),
      specialty: cell(r, 'specialty'),
      isCallback: bool(cell(r, 'is_callback')),
      isHighValue: bool(cell(r, 'is_high_value')),
    }));
}

// A "notification" is one case under one template — the same case can trigger
// more than one, so it is tracked per case + template.
const rowId = (c, key) => `${c.id}:${key}`;

// ── Group action buttons on this page ────────────────────────────────────────
// The button is a generic "Send in group" (the desk it targets is named in the
// tooltip) rather than the old per-desk "Open <Desk> →". Desks listed in
// HIDDEN_GROUP_BUTTONS get no button at all, and sending is not wired up yet so
// the buttons are disabled.
const SEND_IN_GROUP_LABEL = 'Send in group';
const HIDDEN_GROUP_BUTTONS = new Set(['highValueGeneral']);
const GROUP_SEND_ENABLED = false;

const COPIED_STORE = 'psri.wa.copied.v1';

// The address the QR code encodes: this same page, opened on a phone. In local
// dev window.location is localhost, which a phone cannot reach, so point at the
// deployed site instead.
const PROD_ORIGIN = 'https://inder20216.github.io/psri-hospital-crm';
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;
function pageUrlForQr() {
  if (typeof window === 'undefined') return '';
  const { hostname, pathname, search, hash, href } = window.location;
  if (LOCAL_HOST_RE.test(hostname)) return `${PROD_ORIGIN}${pathname}${search}${hash}`;
  return href;
}
function loadCopied() {
  try {
    const v = JSON.parse(localStorage.getItem(COPIED_STORE) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveCopied(list) {
  try { localStorage.setItem(COPIED_STORE, JSON.stringify(list)); } catch { /* private mode */ }
}

// The WhatsApp list — every case that triggers one of the four numbered
// templates. Copying a notification moves it to the "Copied" list and out of
// the main list.
export default function WhatsAppListPage() {
  const { getList } = usePicklists();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [filter, setFilter] = useState('');   // '' = all, 'copied', else a template key
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(loadCopied);
  const [flash, setFlash] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const flashTimer = useRef(null);

  // The QR encodes this page's live address. Recomputed each time it is opened
  // so it always matches the tab the admin is actually on.
  const openQr = useCallback(() => {
    setQrUrl(pageUrlForQr());
    setQrCopied(false);
    setShowQr(true);
  }, []);

  const copyQrLink = useCallback(async () => {
    await copyText(qrUrl);
    setQrCopied(true);
  }, [qrUrl]);

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadErr('');
    return psri.getCasesCsv()
      .then(text => {
        const all = parseCasesCsv(text);
        if (all.length === 0) throw new Error('empty');
        setCases(all);
      })
      .catch(() => psri.getCases()
        .then(res => setCases((res && res.cases) || []))
        .catch(() => setLoadErr('Could not load cases. Please try again.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // On a phone this page is meant to stand alone: mark the body so the CSS can
  // hide the left rail and the floating widgets (the QR code on the desktop
  // screen exists precisely so a phone can show just this list) and reflow the
  // page to full width.
  //
  // The test is the *device*, not just the width. A laptop with display scaling,
  // or simply a window that isn't maximised, can easily be narrower than a phone
  // in landscape — matching that on width alone would drop a laptop into phone
  // mode and take the rail and the QR button away from the person who needs to
  // scan the code. Requiring a touch screen (coarse pointer, no hover) keeps the
  // full-screen presentation on phones and tablets only.
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 1024px) and (pointer: coarse) and (hover: none)');
    const apply = () => document.body.classList.toggle('psri-wa-focus', phone.matches);
    apply();
    phone.addEventListener('change', apply);
    return () => {
      phone.removeEventListener('change', apply);
      document.body.classList.remove('psri-wa-focus');
    };
  }, []);

  // Esc closes the QR dialog.
  useEffect(() => {
    if (!showQr) return undefined;
    const onKey = e => { if (e.key === 'Escape') setShowQr(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQr]);

  const showFlash = useCallback(text => {
    setFlash(text);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 3000);
  }, []);

  // Tag each case with the templates it matches + the department group(s) to
  // notify, so a row can be copied and the right group opened in one click.
  const rows = useMemo(() => cases.map(c => ({
    c,
    keys: caseTemplates(c),
    groups: resolveWhatsAppGroups(c).map(g => ({
      ...g,
      url: groupInviteLink(g.id, getList, g.kind),
    })),
  })), [cases, getList]);

  const copiedSet = useMemo(() => new Set(copied), [copied]);

  // How many times this person has raised this same concern. Only cases that
  // belong to a repeat group get an entry, so the badge shows on 2nd+ calls.
  const repeats = useMemo(() => buildRepeatIndex(cases), [cases]);

  // The same repeats rolled up one row per repeated concern (not per case), so
  // a person who called seven times about one thing is one line here, not seven.
  // Built from every case, not just the ones that trigger a notification —
  // otherwise most repeats would never be visible anywhere.
  const repeatGroups = useMemo(() => {
    const byKey = new Map();
    cases.forEach(c => {
      const rep = repeats.get(c.id);
      if (!rep) return;
      let g = byKey.get(rep.key);
      if (!g) {
        g = {
          key: rep.key,
          concern: rep.concern,
          callFor: c.callFor,
          total: rep.total,
          contactName: c.contactName,
          contactMobile: c.contactMobile,
          entries: [],
        };
        byKey.set(rep.key, g);
      }
      g.entries.push({
        id: c.id,
        n: rep.n,
        date: rep.dates[rep.n - 1],
        status: c.status,
        callFor: c.callFor,
      });
    });
    return [...byKey.values()]
      .map(g => ({ ...g, entries: g.entries.sort((a, b) => a.n - b.n) }))
      // Busiest first — the query that keeps coming back is the one to act on.
      .sort((a, b) => b.total - a.total || String(a.concern).localeCompare(String(b.concern)));
  }, [cases, repeats]);

  const shownRepeatGroups = useMemo(() => {
    if (!query) return repeatGroups;
    const q = query.toLowerCase();
    return repeatGroups.filter(g => [g.contactName, g.contactMobile, g.concern]
      .map(v => String(v || '').toLowerCase()).join(' ').includes(q));
  }, [repeatGroups, query]);

  const repeatCallTotal = useMemo(
    () => repeatGroups.reduce((n, g) => n + g.total, 0),
    [repeatGroups],
  );

  // Only cases that trigger a template are listed — a case with no match has no
  // notification to send, so it simply is not shown.
  const activeRows = useMemo(() => rows.filter(r => r.keys.length > 0), [rows]);

  const searched = useMemo(() => activeRows.filter(r => {
    if (!query) return true;
    const q = query.toLowerCase();
    const hay = [r.c.contactName, r.c.contactMobile, r.c.summary, r.c.callFor]
      .map(v => String(v || '').toLowerCase()).join(' ');
    return hay.includes(q);
  }), [activeRows, query]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(WA_TEMPLATES.map(t => [t.key, 0]));
    rows.forEach(r => r.keys.forEach(k => { if (!copiedSet.has(rowId(r.c, k))) map[k] += 1; }));
    return map;
  }, [rows, copiedSet]);

  const allCount = useMemo(
    () => rows.filter(r => r.keys.some(k => !copiedSet.has(rowId(r.c, k)))).length,
    [rows, copiedSet],
  );

  // Copied notifications, newest case first (rows come from the CSV in date order).
  const copiedItems = useMemo(() => {
    const out = [];
    searched.forEach(r => r.keys.forEach(k => {
      if (copiedSet.has(rowId(r.c, k))) out.push({ c: r.c, groups: r.groups, key: k });
    }));
    return out;
  }, [searched, copiedSet]);

  const copiedCount = useMemo(
    () => rows.reduce((n, r) => n + r.keys.filter(k => copiedSet.has(rowId(r.c, k))).length, 0),
    [rows, copiedSet],
  );

  const markCopied = useCallback((c, key) => {
    const id = rowId(c, key);
    setCopied(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveCopied(next);
      return next;
    });
    showFlash('Copied ✓ — moved to the Copy list');
  }, [showFlash]);

  const restore = useCallback(id => {
    setCopied(prev => {
      const next = prev.filter(x => x !== id);
      saveCopied(next);
      return next;
    });
  }, []);

  const clearCopied = useCallback(() => {
    setCopied([]);
    saveCopied([]);
  }, []);

  const copyMessage = async (c, key) => {
    await copyText(buildWaMessage(key, c));
    markCopied(c, key);
  };

  // One rendered notification card. `isCopied` switches the primary action from
  // "Copy message" (which moves it to the Copy list) to "Restore".
  const renderCard = (c, groups, key, isCopied) => (
    <article key={rowId(c, key)} className="psri-wa-tpl-row">
      <div className="psri-wa-tpl-rowhead">
        <strong>{c.contactName || 'Unknown Contact'}</strong>
        <span className="cp-hint" style={{ margin: 0 }}>{fmtWhen(c.created)}</span>
      </div>
      <div className="psri-wa-tpl-meta">
        {c.contactMobile && <span className="cp-hint" style={{ margin: 0 }}>{c.contactMobile}</span>}
        {c.callFor && <span className="psri-badge">{c.callFor}</span>}
        {c.status && <span className="psri-badge">{c.status}</span>}
        {(() => {
          const rep = repeats.get(c.id);
          if (!rep) return null;
          return (
            <span className="psri-badge psri-badge--repeat" title={repeatTitle(rep)}>
              ↻ Call {rep.n} of {rep.total} about this
            </span>
          );
        })()}
      </div>

      <pre className="psri-wa-msg">{buildWaMessage(key, c)}</pre>

      <div className="psri-wa-tpl-actions">
        {isCopied ? (
          <>
            <button type="button" className="psri-btn-ghost" onClick={() => restore(rowId(c, key))}>
              ↺ Restore
            </button>
            <button type="button" className="psri-btn-ghost" onClick={() => copyText(buildWaMessage(key, c))}>
              Copy again
            </button>
          </>
        ) : (
          <button type="button" className="psri-btn-ghost" onClick={() => copyMessage(c, key)}>
            Copy message
          </button>
        )}

        {(() => {
          const visible = groups.filter(g => !HIDDEN_GROUP_BUTTONS.has(g.id));
          if (visible.length === 0) {
            return (
              <span className="cp-hint" style={{ margin: 0 }}>
                {groups.length > 0 ? 'Group for this notification is not set up yet.' : 'No department group mapped.'}
              </span>
            );
          }
          const many = visible.length > 1;
          return visible.map(g => (
            <span
              key={g.id}
              className="psri-wa-sendwrap"
              title={`Send to ${g.label}${g.url ? '' : ' — group link not set'}`}
            >
              <button type="button" className="psri-btn-primary" disabled={!GROUP_SEND_ENABLED}>
                {many ? `${SEND_IN_GROUP_LABEL} · ${g.label}` : SEND_IN_GROUP_LABEL}
              </button>
            </span>
          ));
        })()}
      </div>
    </article>
  );

  const isCopiedView = filter === 'copied';
  const isRepeatsView = filter === 'repeats';
  const visibleTemplates = WA_TEMPLATES.filter(t => !filter || filter === t.key);

  const shownCount = isRepeatsView
    ? shownRepeatGroups.length
    : isCopiedView
      ? copiedItems.length
      : (filter
        ? searched.filter(r => r.keys.includes(filter) && !copiedSet.has(rowId(r.c, filter))).length
        : allCount);

  const noNotifications = !loading && !loadErr && activeRows.length === 0;

  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">WhatsApp Notifications</h1>
          <p className="psri-subtitle">PSRI Hospital — cases grouped by the notification they trigger. Copying one files it under “Copied”. Repeated query lists what people keep coming back about.</p>
        </div>
      </div>

      {loadErr && <div className="psri-err-banner">{loadErr}</div>}

      <div className="psri-wa-legend">
        <button
          type="button"
          className={`psri-wa-chip${filter === '' ? ' active' : ''}`}
          onClick={() => setFilter('')}
        >
          All · {allCount}
        </button>
        {WA_TEMPLATES.map(t => (
          <button
            key={t.key}
            type="button"
            className={`psri-wa-chip${filter === t.key ? ' active' : ''}`}
            onClick={() => setFilter(f => (f === t.key ? '' : t.key))}
            title={t.trigger}
          >
            <span className="psri-wa-chip-num">{t.n}</span> {t.title} · {counts[t.key] || 0}
          </button>
        ))}
        <button
          type="button"
          className={`psri-wa-chip${isRepeatsView ? ' active' : ''}`}
          onClick={() => setFilter(f => (f === 'repeats' ? '' : 'repeats'))}
          title="The same person raising the same concern, under the same Call For, more than once"
        >
          <span className="psri-wa-chip-num">↻</span> Repeated query · {repeatGroups.length}
        </button>
        <button
          type="button"
          className={`psri-wa-chip${isCopiedView ? ' active' : ''}`}
          onClick={() => setFilter(f => (f === 'copied' ? '' : 'copied'))}
          title="Notifications you have already copied"
        >
          ✓ Copied · {copiedCount}
        </button>
        <button
          type="button"
          className="psri-wa-chip psri-wa-chip--action psri-qr-open-btn"
          onClick={openQr}
          title="Show a QR code to open this page on a phone"
        >
          📱 Open on phone
        </button>
        <button
          type="button"
          className="psri-wa-chip psri-wa-chip--action"
          onClick={refresh}
          title="Reload the case list"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="psri-search-row">
        <input
          className="psri-search-input"
          type="text"
          placeholder="Search by patient name, mobile, or concern…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span className="psri-count">
          {shownCount} {isCopiedView ? 'notification' : 'case'}{shownCount !== 1 ? 's' : ''}
        </span>
      </div>

      {flash && <div className="psri-wa-flash">{flash}</div>}

      {loading && <div className="psri-empty">Loading cases…</div>}

      {noNotifications && (
        <div className="psri-empty">No WhatsApp notifications yet — they appear here once a Case matches one of the four templates.</div>
      )}

      {!loading && !loadErr && !noNotifications && shownCount === 0 && (
        <div className="psri-empty">No notifications match this view.</div>
      )}

      {!loading && visibleTemplates.map(t => {
        const list = searched.filter(r => r.keys.includes(t.key) && !copiedSet.has(rowId(r.c, t.key)));
        if (list.length === 0 && !filter) return null; // hide empty sections in the "All" view
        return (
          <section key={t.key} className="psri-wa-tpl">
            <div className="psri-wa-tpl-head">
              <span className="psri-wa-tpl-num">{t.n}</span>
              <div>
                <h2 className="psri-wa-tpl-title">{t.title}</h2>
                <p className="psri-wa-tpl-sub">{t.recipient} · {list.length} case{list.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {list.length === 0
              ? <div className="psri-empty">No cases match this template.</div>
              : list.map(({ c, groups }) => renderCard(c, groups, t.key, false))}
          </section>
        );
      })}

      {/* Repeated query — one row per concern a person has raised more than
          once, busiest first. Not a notification: there is nothing to copy and
          send here, it is the "this keeps coming back" list. */}
      {(!filter || isRepeatsView) && (
        (() => {
          if (shownRepeatGroups.length === 0 && !isRepeatsView) return null; // hide when empty in the "All" view
          return (
            <section className="psri-wa-tpl">
              <div className="psri-wa-tpl-head">
                <span className="psri-wa-tpl-num psri-wa-tpl-num--muted">↻</span>
                <div>
                  <h2 className="psri-wa-tpl-title">Repeated query</h2>
                  <p className="psri-wa-tpl-sub">
                    Same person, same Call For, same concern, more than once · {repeatGroups.length} concern{repeatGroups.length !== 1 ? 's' : ''} · {repeatCallTotal} call{repeatCallTotal !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {shownRepeatGroups.length === 0
                ? (
                  <div className="psri-empty">
                    {query
                      ? 'No repeated query matches your search.'
                      : 'No repeated queries — nothing anyone has raised more than once about the same concern.'}
                  </div>
                )
                : shownRepeatGroups.map(g => (
                  <article key={g.key} className="psri-wa-tpl-row">
                    <div className="psri-wa-tpl-rowhead">
                      <strong>{g.contactName || 'Unknown Contact'}</strong>
                      {g.contactMobile && <span className="cp-hint" style={{ margin: 0 }}>{g.contactMobile}</span>}
                    </div>
                    <div className="psri-wa-tpl-meta">
                      {g.callFor && <span className="psri-badge">{g.callFor}</span>}
                      <span
                        className={`psri-badge psri-badge--repeat${g.total >= 4 ? ' psri-badge--hot' : ''}`}
                        title={`${g.total} calls about the same concern, same Call For`}
                      >
                        ↻ {g.total} call{g.total !== 1 ? 's' : ''} about this
                      </span>
                    </div>
                    <p className="psri-rq-concern">{g.concern}</p>
                    <ol className="psri-rq-calls">
                      {g.entries.map(e => (
                        <li key={e.id}>
                          <span className="psri-rq-n">{e.n}</span>
                          <span className="psri-rq-date">{e.date}</span>
                          {e.callFor && <span className="psri-badge">{e.callFor}</span>}
                          {e.status && <span className="psri-badge">{e.status}</span>}
                          <span className="psri-rq-id">{e.id}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
            </section>
          );
        })()
      )}

      {(!filter || isCopiedView) && (
        (() => {
          if (copiedItems.length === 0 && !isCopiedView) return null; // hide when empty in the "All" view
          return (
            <section className="psri-wa-tpl">
              <div className="psri-wa-tpl-head">
                <span className="psri-wa-tpl-num psri-wa-tpl-num--muted">✓</span>
                <div>
                  <h2 className="psri-wa-tpl-title">Copied</h2>
                  <p className="psri-wa-tpl-sub">Already copied — kept here for reference · {copiedItems.length} notification{copiedItems.length !== 1 ? 's' : ''}</p>
                </div>
                {copiedItems.length > 0 && (
                  <button type="button" className="psri-btn-ghost" style={{ marginLeft: 'auto' }} onClick={clearCopied}>
                    Clear list
                  </button>
                )}
              </div>
              {copiedItems.length === 0
                ? <div className="psri-empty">Nothing copied yet — press “Copy message” on a notification and it lands here.</div>
                : copiedItems.map(({ c, groups, key }) => renderCard(c, groups, key, true))}
            </section>
          );
        })()
      )}

      {showQr && (
        <div className="psri-modal-overlay" onClick={() => setShowQr(false)}>
          <div className="psri-modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="psri-modal-title">📱 Open on your phone</div>
            <div className="psri-qr-body">
              <div className="psri-qr-card">
                <QRCodeSVG
                  value={qrUrl || ' '}
                  size={208}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  title="Scan to open the WhatsApp list on your phone"
                />
              </div>
              <div className="psri-qr-url">{qrUrl}</div>
              <p className="psri-qr-note">
                Point your phone camera at this code to open the WhatsApp list on the phone.
                You will be asked to sign in with your PSRI account there.
              </p>
            </div>
            <div className="psri-modal-actions">
              <button type="button" className="psri-btn-ghost" onClick={() => setShowQr(false)}>
                Close
              </button>
              <button type="button" className="psri-btn-primary" onClick={copyQrLink}>
                {qrCopied ? 'Link copied ✓' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
