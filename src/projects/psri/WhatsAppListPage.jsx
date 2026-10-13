import { useCallback, useEffect, useMemo, useState } from 'react';
import { psri } from '../../api/psri';
import { usePicklists } from '../../context/PicklistsContext';
import { resolveWhatsAppGroups, groupInviteLink } from './whatsappGroups';
import { WA_TEMPLATES, caseTemplates, buildWaMessage } from './waNotifications';
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

// The WhatsApp list — EVERY case, grouped under the four numbered templates
// from the process doc (a case can appear under more than one), plus the cases
// that trigger none of them.
export default function WhatsAppListPage() {
  const { getList } = usePicklists();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [filter, setFilter] = useState('');   // '' = all, else a template key
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

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

  const counts = useMemo(() => {
    const map = Object.fromEntries(WA_TEMPLATES.map(t => [t.key, 0]));
    rows.forEach(r => r.keys.forEach(k => { map[k] = (map[k] || 0) + 1; }));
    return map;
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filter === 'none') { if (r.keys.length > 0) return false; }
    else if (filter && !r.keys.includes(filter)) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = [r.c.contactName, r.c.contactMobile, r.c.summary, r.c.callFor]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, filter, query]);

  const unmatchedCount = useMemo(() => rows.filter(r => r.keys.length === 0).length, [rows]);

  const copyMessage = async (c, key) => {
    await copyText(buildWaMessage(key, c));
    setCopiedKey(`${c.id}:${key}`);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // One rendered row (used by both the numbered sections and the "no
  // notification" bucket). `key` is a template key, or 'none'.
  const renderCase = (c, groups, key) => (
    <article key={`${c.id}:${key}`} className="psri-wa-tpl-row">
      <div className="psri-wa-tpl-rowhead">
        <strong>{c.contactName || 'Unknown Contact'}</strong>
        <span className="cp-hint" style={{ margin: 0 }}>{fmtWhen(c.created)}</span>
      </div>
      <div className="psri-wa-tpl-meta">
        {c.contactMobile && <span className="cp-hint" style={{ margin: 0 }}>{c.contactMobile}</span>}
        {c.callFor && <span className="psri-badge">{c.callFor}</span>}
        {c.status && <span className="psri-badge">{c.status}</span>}
      </div>

      {key !== 'none' && <pre className="psri-wa-msg">{buildWaMessage(key, c)}</pre>}

      <div className="psri-wa-tpl-actions">
        {key !== 'none' && (
          <button type="button" className="psri-btn-ghost" onClick={() => copyMessage(c, key)}>
            {copiedKey === `${c.id}:${key}` ? 'Copied ✓' : 'Copy message'}
          </button>
        )}
        {key !== 'none' && groups.length === 0 && (
          <span className="cp-hint" style={{ margin: 0 }}>No department group mapped.</span>
        )}
        {key !== 'none' && groups.map(g => (
          g.url ? (
            <a
              key={g.id}
              className="psri-btn-primary"
              href={g.url}
              target="_blank"
              rel="noreferrer"
              title={`Open ${g.label} in WhatsApp`}
            >
              Open {g.label} →
            </a>
          ) : (
            <span key={g.id} className="psri-wa-nolink" title="Add this group in Admin → Picklists → WhatsApp Groups">
              {g.label}: link not set
            </span>
          )
        ))}
      </div>
    </article>
  );

  const visibleTemplates = WA_TEMPLATES.filter(t => !filter || filter === t.key);

  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">WhatsApp Notifications</h1>
          <p className="psri-subtitle">PSRI Hospital — every case, grouped by the notification it triggers</p>
        </div>
        <button type="button" className="psri-btn-ghost" onClick={refresh}>↻ Refresh</button>
      </div>

      {loadErr && <div className="psri-err-banner">{loadErr}</div>}

      <div className="psri-wa-legend">
        <button
          type="button"
          className={`psri-wa-chip${filter === '' ? ' active' : ''}`}
          onClick={() => setFilter('')}
        >
          All · {rows.length}
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
          className={`psri-wa-chip${filter === 'none' ? ' active' : ''}`}
          onClick={() => setFilter(f => (f === 'none' ? '' : 'none'))}
          title="Cases that do not trigger any of the four templates"
        >
          No notification · {unmatchedCount}
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
          {filtered.length} case{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <div className="psri-empty">Loading cases…</div>}

      {!loading && !loadErr && cases.length === 0 && (
        <div className="psri-empty">No cases yet — WhatsApp notifications appear here once a Case is submitted.</div>
      )}

      {!loading && !loadErr && cases.length > 0 && filtered.length === 0 && (
        <div className="psri-empty">No cases match this filter.</div>
      )}

      {!loading && visibleTemplates.map(t => {
        const list = filtered.filter(r => r.keys.includes(t.key));
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
              : list.map(({ c, groups }) => renderCase(c, groups, t.key))}
          </section>
        );
      })}

      {(filter === '' || filter === 'none') && (() => {
        const list = filtered.filter(r => r.keys.length === 0);
        if (list.length === 0 && !filter) return null;
        return (
          <section className="psri-wa-tpl">
            <div className="psri-wa-tpl-head">
              <span className="psri-wa-tpl-num psri-wa-tpl-num--muted">–</span>
              <div>
                <h2 className="psri-wa-tpl-title">No WhatsApp notification</h2>
                <p className="psri-wa-tpl-sub">Case matches none of the four templates · {list.length} case{list.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {list.length === 0
              ? <div className="psri-empty">Every case triggers at least one template.</div>
              : list.map(({ c, groups }) => renderCase(c, groups, 'none'))}
          </section>
        );
      })()}
    </div>
  );
}
