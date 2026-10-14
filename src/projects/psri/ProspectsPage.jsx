import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { usePicklists } from '../../context/PicklistsContext';
import { useUsers } from '../../context/UsersContext';
import { useAuth } from '../../context/AuthContext';
import { useSparkTG } from '../../context/SparkTGContext';
import { psri } from '../../api/psri';
import './Psri.css';

const FIELD_LABELS = {
  call_status: 'Call Status',
  lead_status: 'Lead Status',
  final_status: 'Final Status',
  next_call_at: 'Next Call',
  remarks: 'Remarks',
  assigned_to: 'Assigned To',
};

function fmtWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

// Converts a stored MySQL datetime/timestamp into the value a
// <input type="datetime-local"> needs, and back again.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Date filter ─────────────────────────────────────────────────────────────
// Prospect dates arrive as "YYYY-MM-DD HH:MM:SS" from MySQL, so parse that
// shape explicitly — new Date() on a space-separated string is treated as local
// time in some browsers and UTC in others, which shifts a day at the edges.
function parseWhen(v) {
  if (!v) return null;
  const s = String(v).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2} /.test(s) ? s.replace(' ', 'T') : s);
  return isNaN(d.getTime()) ? null : d;
}

function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return ymd(d);
}

const DATE_FIELDS = [
  { key: 'created',       label: 'Created' },
  { key: 'firstCallDate', label: 'First call' },
  { key: 'lastCallAt',    label: 'Last call' },
  { key: 'nextCallAt',    label: 'Next call' },
];

const DATE_PRESETS = [
  { key: 'today', label: 'Today', from: 0,  to: 0 },
  { key: '7d',    label: '7 days', from: 6,  to: 0 },
  { key: '30d',   label: '30 days', from: 29, to: 0 },
];

function describeActivity(a) {
  switch (a.action) {
    case 'call_attempt': return `${a.agentName || 'Agent'} placed a call`;
    case 'created': return 'Prospect created from a new enquiry';
    case 'linked': return 'Another enquiry linked to this prospect';
    case 'auto_converted': return a.note || 'Lead converted';
    case 'status_change': {
      const label = FIELD_LABELS[a.fieldChanged] || a.fieldChanged;
      return `${a.agentName || 'Agent'} changed ${label}: "${a.oldValue || '—'}" → "${a.newValue || '—'}"`;
    }
    default: return a.note || a.action || 'Updated';
  }
}

function fmtDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// duration>0 alone misclassifies real missed calls (SparkTG reports ring
// time even on calls it disposition-tags "missed") — same override already
// applied in MissedCallsWidget/ProductivityPage; keep in sync with those.
function isCallAnswered(c) {
  if (/missed|no.?answer/i.test(c.disposition || '')) return false;
  return Number(c.durationSeconds) > 0;
}

function describeCall(c) {
  const dir = c.direction === 'inbound' ? '📥 Inbound' : '📤 Outbound';
  const outcome = isCallAnswered(c) ? 'Answered' : 'Missed';
  const dur = fmtDuration(c.durationSeconds);
  return `${dir} call — ${outcome}${dur ? ` (${dur})` : ''}`;
}

// Merges the prospect's own activity log (status changes, remarks, system
// notes), its actual call history (inbound/outbound, from call_logs —
// matched by mobile, since that's the only link available), and the
// contact's full case history into one newest-first timeline, so the TL
// sees everything in one place instead of having to cross-reference three
// separate views. casesByTxn (keyed by callTxnId) attaches the actual
// enquiry/summary to whichever call created or discussed it, so that row
// shows what the query was about, not just "Inbound call — Answered".
// allCases covers the rest: every case for this contact, including ones
// from before the Prospects feature existed or whose call never got logged
// (fake/manual test callTxnIds, SparkTG gaps) — so a contact's full case
// history always shows here even when call-log matching finds nothing.
// Cases already surfaced via a matched call are skipped to avoid showing
// the same enquiry twice.
function buildTimeline(activity, calls, casesByTxn, allCases) {
  const shownCaseIds = new Set(Object.values(casesByTxn).map(c => c.id));
  const rows = [
    ...activity.map(a => ({ ts: a.created, kind: 'activity', key: `a${a.id}`, text: describeActivity(a) })),
    ...calls.map(c => {
      const linkedCase = casesByTxn[c.callTxnId];
      return {
        ts: c.startedAt,
        kind: 'call',
        key: `c${c.callTxnId}`,
        text: describeCall(c),
        recordingUrl: c.recordingUrl,
        queryDetails: linkedCase ? [linkedCase.typeOfEnquiry, linkedCase.summary].filter(Boolean).join(' — ') : '',
      };
    }),
    ...allCases.filter(c => !shownCaseIds.has(c.id)).map(c => ({
      ts: c.created,
      kind: 'case',
      key: `cs${c.id}`,
      text: `${c.callFor || c.typeOfCall || 'Case'}${c.status ? ' · ' + c.status : ''}`,
      queryDetails: [c.typeOfEnquiry, c.summary].filter(Boolean).join(' — '),
    })),
  ];
  return rows.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

const emptyEdit = { callStatus: '', leadStatus: '', finalStatus: '', nextCallAt: '', remarks: '', assignedTo: '' };

export default function ProspectsPage() {
  const { getList } = usePicklists();
  const { users } = useUsers();
  const { currentUser, isAdmin } = useAuth();
  const { dial, hasWidget, callState } = useSparkTG();
  const pendingCallProspect = useRef(null); // prospect id currently being dialed, awaiting SparkTG's real callId
  const loggedCallIds = useRef(new Set());  // guards against re-logging the same callId on later callState updates

  const [prospects, setProspects] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadErr, setLoadErr]     = useState('');
  const [selected, setSelected]   = useState(null);
  const [selectedIds, setSelectedIds]     = useState(new Set()); // bulk-assign checkboxes — Admin/Super Admin only
  const [bulkAssignTo, setBulkAssignTo]   = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [remarksOpenId, setRemarksOpenId] = useState(''); // which card's remarks popover is open, if any — agents only, admin sees remarks inline
  const [adminTab, setAdminTab]           = useState('New'); // Admin/Super Admin only: 'New' | 'New assigned' | 'Other'
  const [quickSelectCount, setQuickSelectCount] = useState('');
  // Date filter — applied to every tab, so it survives a tab change.
  const [dateField, setDateField]     = useState('created');
  const [dateFrom,  setDateFrom]      = useState('');
  const [dateTo,    setDateTo]        = useState('');
  const [datePreset, setDatePreset]   = useState('');
  const [edit, setEdit]           = useState(emptyEdit);
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState('');
  const [toast, setToast]         = useState('');
  const [activity, setActivity]         = useState([]);
  const [calls, setCalls]               = useState([]);
  const [casesByTxn, setCasesByTxn]     = useState({});
  const [linkedCases, setLinkedCases]   = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [playingKey, setPlayingKey]     = useState('');
  const audioRef = useRef(null);

  const toggleRecording = (row) => {
    const audio = audioRef.current;
    if (!audio || !row.recordingUrl) return;
    if (playingKey === row.key) {
      audio.pause();
      setPlayingKey('');
      return;
    }
    audio.src = row.recordingUrl;
    audio.play();
    setPlayingKey(row.key);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadErr('');
    return psri.getProspects('Followup')
      .then(setProspects)
      .catch(() => setLoadErr('Could not load prospects. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // "New" = nobody's worked it yet — same definition the card's own "New"
  // badge already uses (no lead status set). Admins get it as a tab filter
  // (so they can round-robin fresh leads); agents get it as the sort order
  // on their own assigned leads, so untouched ones always surface first.
  const isNewLead = (p) => !p.leadStatus;

  // "New assigned" = the same untouched lead, but an agent is already on it.
  // This is the queue that goes quiet: created, handed to someone, and never
  // picked up. Note it deliberately overlaps "New" — a lead is *both* fresh and
  // assigned — so "New" stays exactly what it was, and this is the subset that
  // has an owner to chase.
  const isNewAssignedLead = (p) => !p.leadStatus && !!p.assignedTo;

  const ADMIN_TABS = [
    { key: 'New',          label: 'New',          test: isNewLead },
    { key: 'New assigned', label: 'New assigned', test: isNewAssignedLead },
    { key: 'Other',        label: 'Other',        test: (p) => !isNewLead(p) },
  ];

  // Keeps a prospect when its chosen date sits inside the range. A prospect with
  // no value for the chosen field drops out — asking for "next call this week"
  // should not return the ones with no next call booked.
  const withinRange = useCallback((p) => {
    if (!dateFrom && !dateTo) return true;
    const d = parseWhen(p[dateField]);
    if (!d) return false;
    if (dateFrom) {
      const start = new Date(`${dateFrom}T00:00:00`);
      if (d < start) return false;
    }
    if (dateTo) {
      const end = new Date(`${dateTo}T00:00:00`);
      end.setHours(23, 59, 59, 999); // inclusive of the whole end day
      if (d > end) return false;
    }
    return true;
  }, [dateField, dateFrom, dateTo]);

  // Everyone the viewer is allowed to see, before any tab is applied. The date
  // filter narrows this, so the tab counts always reflect the chosen range.
  const inScope = useMemo(() => {
    const mine = isAdmin ? prospects : prospects.filter(p => p.assignedTo === currentUser?.id);
    return mine.filter(withinRange);
  }, [prospects, isAdmin, currentUser, withinRange]);

  const tabCounts = useMemo(() => Object.fromEntries(
    ADMIN_TABS.map(t => [t.key, inScope.filter(t.test).length]),
  ), [inScope]);

  const visibleProspects = useMemo(() => {
    if (isAdmin) {
      const tab = ADMIN_TABS.find(t => t.key === adminTab);
      return tab ? inScope.filter(tab.test) : inScope;
    }
    // Stable sort (spec-guaranteed since ES2019) — New-leads partition moves
    // to the front, already-attempted ones follow, each group keeping its
    // existing relative order.
    return [...inScope].sort((a, b) => (isNewLead(a) === isNewLead(b)) ? 0 : (isNewLead(a) ? -1 : 1));
  }, [inScope, isAdmin, adminTab]);

  const applyPreset = (preset) => {
    if (!preset) { setDateFrom(''); setDateTo(''); setDatePreset(''); return; }
    setDateFrom(daysAgo(preset.from));
    setDateTo(daysAgo(preset.to));
    setDatePreset(preset.key);
  };

  const handleQuickSelect = () => {
    const n = parseInt(quickSelectCount, 10);
    if (!n || n <= 0) return;
    setSelectedIds(new Set(visibleProspects.slice(0, n).map(p => p.id)));
  };

  const select = (p) => {
    setSelected(p);
    setEdit({
      callStatus: p.callStatus || '',
      leadStatus: p.leadStatus || '',
      finalStatus: p.finalStatus || '',
      nextCallAt: toLocalInput(p.nextCallAt),
      remarks: p.remarks || '',
      assignedTo: p.assignedTo || '',
    });
    setSaveErr('');
    setActivity([]);
    setCalls([]);
    setCasesByTxn({});
    setLinkedCases([]);
    setPlayingKey('');
    setRemarksOpenId('');
    if (audioRef.current) audioRef.current.pause();
    loadHistory(p);
  };

  // Loads the full timeline in stages: the prospect's own activity log,
  // its call history (searched by mobile — the only link call_logs has
  // back to a prospect), then — once we know which calls happened — the
  // actual cases those calls created/discussed, so each call row can show
  // what the query was about instead of just its duration/outcome. Also
  // pulls every case for this contact directly (same lookup Cases' own
  // Contact History panel uses) — call-log matching alone misses a lot in
  // practice: cases from before Prospects existed, or ones whose call was
  // never really logged (manual/test entries), so the contact's case
  // history would otherwise just be missing from here.
  const loadHistory = (p) => {
    setActivityLoading(true);
    Promise.all([
      psri.getProspectActivity(p.id),
      p.contactMobile ? psri.getCallLogs({ q: p.contactMobile, limit: 100 }) : Promise.resolve([]),
      p.contactMobile ? psri.getCases(p.contactMobile).then(res => res.cases || []).catch(() => []) : Promise.resolve([]),
    ])
      .then(([a, c, cs]) => {
        setActivity(a);
        setCalls(c);
        setLinkedCases(cs);
        const txnIds = c.map(x => x.callTxnId).filter(Boolean);
        if (txnIds.length === 0) return;
        return psri.getCases({ callTxnIds: txnIds.join(',') }).then(res => {
          const map = {};
          (res.cases || []).forEach(cs => { if (cs.callTxnId) map[cs.callTxnId] = cs; });
          setCasesByTxn(map);
        }).catch(() => {});
      })
      .finally(() => setActivityLoading(false));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveErr('');
    try {
      await psri.updateProspect({
        id: selected.id,
        agentId: currentUser?.id || '',
        agentName: currentUser?.name || '',
        callStatus: edit.callStatus,
        leadStatus: edit.leadStatus,
        finalStatus: edit.finalStatus,
        nextCallAt: edit.nextCallAt ? edit.nextCallAt.replace('T', ' ') + ':00' : '',
        remarks: edit.remarks,
        // Same auto-capture as Cases: whoever actually saves the update
        // becomes the assignee, reflecting who's currently working the
        // lead rather than a frozen original owner. Admins can reassign.
        assignedTo: isAdmin ? edit.assignedTo : (currentUser?.id || ''),
      });
      showToast('Prospect updated');
      await refresh();
      loadHistory(selected);
    } catch (err) {
      setSaveErr(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation(); // don't also open the detail panel
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Reassigns every checked lead in one pass. Only `assignedTo` is sent per
  // prospect — prospects_update() keeps every other field at its current
  // value when a key is omitted, so this never touches call status, remarks,
  // etc. on the leads it's reassigning.
  const handleBulkAssign = async () => {
    if (!bulkAssignTo || selectedIds.size === 0) return;
    setBulkAssigning(true);
    try {
      await Promise.all([...selectedIds].map(id => psri.updateProspect({
        id, assignedTo: bulkAssignTo,
        agentId: currentUser?.id || '', agentName: currentUser?.name || '',
      })));
      showToast(`${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} assigned`);
      setSelectedIds(new Set());
      setBulkAssignTo('');
      await refresh();
    } catch (err) {
      showToast(err.message || 'Could not assign leads — please try again.');
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleCall = (p) => {
    pendingCallProspect.current = p.id;
    dial(p.contactMobile, { origin: 'prospect', refId: p.id });
  };

  // The attempt is logged once SparkTG actually hands back a real call id
  // (origin 'prospect' tells DialerPanel to stay out of the way for this
  // call) rather than at the moment the button is clicked — so the log
  // entry — and the attempts counter — reflect a call that genuinely
  // reached the phone system, carrying its real transaction id, instead of
  // a button click that might never connect.
  useEffect(() => {
    if (!callState?.callId || callState.origin !== 'prospect' || !callState.refId) return;
    if (callState.refId !== pendingCallProspect.current) return;
    if (loggedCallIds.current.has(callState.callId)) return;
    loggedCallIds.current.add(callState.callId);
    psri.recordProspectCallAttempt({
      id: callState.refId,
      agentId: currentUser?.id || '',
      agentName: currentUser?.name || '',
      callTxnId: callState.callId,
    }).then(() => {
      refresh();
      if (selected?.id === callState.refId) loadHistory(selected);
    });
  }, [callState, currentUser, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="psri-page">
      {toast && <div className="psri-toast">{toast}</div>}

      <div className="psri-top">
        <div>
          <h1 className="psri-title">Prospects</h1>
          <p className="psri-subtitle">PSRI Hospital — Unconverted Enquiries</p>
        </div>
        <span className="psri-count">{visibleProspects.length} prospect{visibleProspects.length !== 1 ? 's' : ''}</span>
      </div>

      {loadErr && <div className="psri-err-banner">{loadErr}</div>}

      <div className="psri-layout">
        <div className="psri-list">
          {isAdmin && (
            <div className="psri-tabs">
              {ADMIN_TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={adminTab === tab.key ? 'psri-btn-primary' : 'psri-btn-ghost'}
                  onClick={() => { setAdminTab(tab.key); setQuickSelectCount(''); }}
                  title={tab.key === 'New assigned'
                    ? 'Created, assigned to an agent, and still untouched — nobody has set a lead status'
                    : undefined}
                >
                  {tab.label}
                  <span className="psri-tab-count">{tabCounts[tab.key] ?? 0}</span>
                </button>
              ))}
            </div>
          )}

          {/* Date filter — applies to every tab, so switching tabs keeps it. */}
          <div className="psri-date-filter">
            <select
              className="psri-date-select"
              value={dateField}
              onChange={e => setDateField(e.target.value)}
              aria-label="Which date to filter on"
            >
              {DATE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <label className="psri-date-range">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={e => { setDateFrom(e.target.value); setDatePreset(''); }}
              />
            </label>
            <label className="psri-date-range">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => { setDateTo(e.target.value); setDatePreset(''); }}
              />
            </label>
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.key}
                type="button"
                className={`psri-chip-btn${datePreset === preset.key ? ' active' : ''}`}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
            {(dateFrom || dateTo) && (
              <button type="button" className="psri-chip-btn" onClick={() => applyPreset(null)}>
                ✕ Clear
              </button>
            )}
          </div>

          {isAdmin && adminTab !== 'Other' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={quickSelectCount}
                onChange={e => setQuickSelectCount(e.target.value)}
                style={{ width: 90 }}
              />
              <button type="button" className="psri-btn-ghost" onClick={handleQuickSelect} style={{ fontSize: 13 }}>
                Select first {quickSelectCount || 'N'}
              </button>
            </div>
          )}

          {isAdmin && selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '10px 12px', marginBottom: 10, borderRadius: 10,
              background: 'var(--psri-bg-soft, #f1f5f9)', border: '1px solid var(--psri-border)',
            }}>
              <strong style={{ fontSize: 13 }}>{selectedIds.size} selected</strong>
              <select value={bulkAssignTo} onChange={e => setBulkAssignTo(e.target.value)} style={{ flex: '1 1 160px' }}>
                <option value="">Assign to…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              <button type="button" className="psri-btn-primary" disabled={!bulkAssignTo || bulkAssigning} onClick={handleBulkAssign}>
                {bulkAssigning ? 'Assigning…' : 'Assign'}
              </button>
              <button type="button" className="psri-btn-ghost" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          {loading && <div className="psri-empty">Loading prospects…</div>}
          {!loading && !loadErr && visibleProspects.length === 0 && (
            <div className="psri-empty">
              {isAdmin
                ? (adminTab === 'Other'
                  ? 'No in-progress leads right now.'
                  : `No ${adminTab === 'New assigned' ? 'assigned but untouched' : 'new'} leads right now.`)
                : 'No open prospects assigned to you right now.'}
              {(dateFrom || dateTo) && ' Try clearing the date filter.'}
            </div>
          )}
          {!loading && visibleProspects.map(p => {
            const noteText = p.remarks || p.originalSummary;
            const noteIsRemark = !!p.remarks;
            return (
            <div key={p.id} className={`psri-contact-card ${selected?.id === p.id ? 'active' : ''}`} onClick={() => select(p)} style={{ position: 'relative' }}>
              {isAdmin && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onClick={e => toggleSelect(p.id, e)}
                  onChange={() => {}}
                  style={{ marginRight: 4, cursor: 'pointer' }}
                />
              )}
              <div className="psri-avatar">{(p.contactName || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}</div>
              <div className="psri-contact-main">
                <div className="psri-contact-name">{p.contactName || 'Unknown Contact'}</div>
                <div className="psri-contact-meta">
                  <span>{p.contactMobile}</span>
                  <span className="psri-badge">{p.leadStatus || 'New'}</span>
                  {p.attempts > 0 && <span className="psri-badge">{p.attempts} attempt{p.attempts !== 1 ? 's' : ''}</span>}
                  {/* Icon toggle for agents — keeps every card the same height
                      regardless of remark length. Admins get the full text
                      inline below instead (next block): a TL assigning leads
                      needs to read it straight away, not click to expand
                      every single card while triaging a list. */}
                  {!isAdmin && noteText && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setRemarksOpenId(id => id === p.id ? '' : p.id); }}
                      title={noteIsRemark ? 'Remarks' : 'Original enquiry'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 2,
                        color: 'var(--psri-text-muted, #64748b)',
                      }}
                    >
                      {noteIsRemark ? '📝' : '📞'} {remarksOpenId === p.id ? '▴' : '▾'}
                    </button>
                  )}
                </div>
                {p.enquiryTypes && <div className="cp-hint" style={{ margin: '2px 0 0' }}>{p.enquiryTypes}</div>}
                {isAdmin && noteText && (
                  <div className="cp-hint" style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>
                    {noteIsRemark ? '📝 ' : '📞 '}{noteText}
                  </div>
                )}
                {isAdmin && (
                  <div className="cp-hint" style={{ margin: '2px 0 0' }}>
                    {p.assignedTo ? (users.find(u => u.id === p.assignedTo)?.name || 'Unknown agent') : 'Unassigned'}
                  </div>
                )}
              </div>
              {!isAdmin && remarksOpenId === p.id && noteText && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', left: 12, right: 12, zIndex: 20, marginTop: 4,
                    background: '#fff', border: '1px solid var(--psri-border)', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5,
                    maxHeight: 160, overflowY: 'auto',
                  }}
                >
                  <div className="cp-hint" style={{ margin: '0 0 4px', fontWeight: 700 }}>
                    {noteIsRemark ? 'Remarks' : 'Original enquiry (no remarks yet)'}
                  </div>
                  {noteText}
                </div>
              )}
            </div>
          );})}
        </div>

        <div className="psri-detail">
          {!selected ? (
            <div className="psri-detail-empty">
              <div className="psri-detail-empty-icon">🗂️</div>
              <p>Select a prospect to view and work the lead</p>
            </div>
          ) : (
            <div className="psri-detail-card">
              {saveErr && <div className="psri-err-banner">{saveErr}</div>}
              <div className="psri-detail-head">
                <div className="psri-avatar lg">{(selected.contactName || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}</div>
                <div>
                  <div className="psri-detail-name">{selected.contactName || 'Unknown Contact'}</div>
                  <span className="psri-badge">{selected.finalStatus || 'Followup'}</span>
                </div>
                {hasWidget && selected.contactMobile && (
                  <button className="psri-btn-primary" onClick={() => handleCall(selected)}>📞 Call</button>
                )}
              </div>

              <div className="psri-detail-grid">
                <div className="psri-detail-item"><span>Mobile</span><strong>{selected.contactMobile || '—'}</strong></div>
                <div className="psri-detail-item"><span>First Call Date</span><strong>{fmtDate(selected.firstCallDate)}</strong></div>
                <div className="psri-detail-item"><span>Attempts</span><strong>{selected.attempts || 0}</strong></div>
                <div className="psri-detail-item"><span>Last Call</span><strong>{fmtWhen(selected.lastCallAt)}</strong></div>
              </div>

              <div className="psri-side-card" style={{ marginTop: 16 }}>
                <div className="psri-side-card-title">History — Calls &amp; Status Changes</div>
                {activityLoading && <p className="cp-hint">Loading…</p>}
                {!activityLoading && activity.length === 0 && calls.length === 0 && linkedCases.length === 0 && (
                  <p className="cp-hint">No history yet — nothing logged for this lead.</p>
                )}
                {!activityLoading && (activity.length > 0 || calls.length > 0 || linkedCases.length > 0) && (
                  <div className="psri-side-results">
                    {buildTimeline(activity, calls, casesByTxn, linkedCases).map(row => (
                      <div key={row.key} className="psri-side-result-item" style={{ cursor: 'default' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.recordingUrl && (
                              <button
                                type="button"
                                onClick={() => toggleRecording(row)}
                                title={playingKey === row.key ? 'Pause recording' : 'Play recording'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1 }}
                              >
                                {playingKey === row.key ? '⏸️' : '▶️'}
                              </button>
                            )}
                            <span>{row.text}</span>
                          </span>
                          <span className="cp-hint" style={{ margin: 0, flexShrink: 0 }}>{fmtWhen(row.ts)}</span>
                        </div>
                        {row.queryDetails && (
                          <p className="cp-hint" style={{ margin: '4px 0 0', paddingLeft: row.recordingUrl ? 21 : 0 }}>{row.queryDetails}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <audio ref={audioRef} onEnded={() => setPlayingKey('')} style={{ display: 'none' }} />
              </div>

              <div className="psri-form" style={{ marginTop: 16 }}>
                <div className="psri-form-row">
                  <div className="psri-field">
                    <label>Call Status</label>
                    <select value={edit.callStatus} onChange={e => setEdit(f => ({ ...f, callStatus: e.target.value }))}>
                      <option value="">— Select —</option>
                      {getList('Call Status').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="psri-field">
                    <label>Lead Status</label>
                    <select value={edit.leadStatus} onChange={e => setEdit(f => ({ ...f, leadStatus: e.target.value }))}>
                      <option value="">— Select —</option>
                      {getList('Lead Status').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="psri-field">
                    <label>Final Status</label>
                    <select value={edit.finalStatus} onChange={e => setEdit(f => ({ ...f, finalStatus: e.target.value }))}>
                      {getList('Final Status').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="psri-form-row">
                  <div className="psri-field">
                    <label>Next Call Date &amp; Time</label>
                    <input type="datetime-local" value={edit.nextCallAt} onChange={e => setEdit(f => ({ ...f, nextCallAt: e.target.value }))} />
                  </div>
                  {isAdmin && (
                    <div className="psri-field">
                      <label>Assigned To</label>
                      <select value={edit.assignedTo} onChange={e => setEdit(f => ({ ...f, assignedTo: e.target.value }))}>
                        <option value="">— Unassigned —</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="psri-field">
                  <label>Remarks</label>
                  <textarea rows={3} value={edit.remarks} onChange={e => setEdit(f => ({ ...f, remarks: e.target.value }))} placeholder="Notes on this lead — why it hasn't converted, what to try next…" />
                </div>
              </div>

              <div className="psri-form-actions-sticky">
                <button type="button" className="psri-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
