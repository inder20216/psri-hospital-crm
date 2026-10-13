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

// The WhatsApp list — every Case that triggers a department WhatsApp
// notification, grouped under the four numbered templates from the process doc.
export default function WhatsAppListPage() {
  const { getList } = usePicklists();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [filter, setFilter] = useState('');   // '' = all four, else a template key
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadErr('');
    return psri.getCases()
      .then(res => setCases((res && res.cases) || []))
      .catch(() => setLoadErr('Could not load cases. Please try again.'))
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
    if (filter && !r.keys.includes(filter)) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = [r.c.contactName, r.c.contactMobile, r.c.summary, r.c.callFor]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, filter, query]);

  const copyMessage = async (c, key) => {
    await copyText(buildWaMessage(key, c));
    setCopiedKey(`${c.id}:${key}`);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const visible = WA_TEMPLATES.filter(t => !filter || filter === t.key);

  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">WhatsApp Notifications</h1>
          <p className="psri-subtitle">PSRI Hospital — Cases that trigger a department WhatsApp message</p>
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

      {!loading && !loadErr && filtered.length === 0 && (
        <div className="psri-empty">
          {rows.length === 0
            ? 'No cases yet — WhatsApp notifications appear here once a Case is submitted.'
            : 'No cases match this filter.'}
        </div>
      )}

      {!loading && visible.map(t => {
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

            {list.length === 0 ? (
              <div className="psri-empty">No cases match this template.</div>
            ) : (
              list.map(({ c, groups }) => (
                <article key={c.id} className="psri-wa-tpl-row">
                  <div className="psri-wa-tpl-rowhead">
                    <strong>{c.contactName || 'Unknown Contact'}</strong>
                    <span className="cp-hint" style={{ margin: 0 }}>{fmtWhen(c.created)}</span>
                  </div>
                  <div className="psri-wa-tpl-meta">
                    {c.contactMobile && <span className="cp-hint" style={{ margin: 0 }}>{c.contactMobile}</span>}
                    {c.callFor && <span className="psri-badge">{c.callFor}</span>}
                    {c.status && <span className="psri-badge">{c.status}</span>}
                    {t.key === 'transplant' && <span className="psri-badge">Transplant</span>}
                  </div>

                  <pre className="psri-wa-msg">{buildWaMessage(t.key, c)}</pre>

                  <div className="psri-wa-tpl-actions">
                    <button
                      type="button"
                      className="psri-btn-ghost"
                      onClick={() => copyMessage(c, t.key)}
                    >
                      {copiedKey === `${c.id}:${t.key}` ? 'Copied ✓' : 'Copy message'}
                    </button>
                    {groups.length === 0 && <span className="cp-hint" style={{ margin: 0 }}>No department group mapped.</span>}
                    {groups.map(g => (
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
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
