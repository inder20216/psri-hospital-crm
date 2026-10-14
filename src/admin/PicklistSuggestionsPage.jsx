import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { psri } from '../api/psri';
import { useAuth } from '../context/AuthContext';
import { markSeen } from '../projects/psri/suggestionsSeen';
import './Admin.css';

const STATUS_TABS = [
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '',         label: 'All' },
];

function fmtWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PicklistSuggestionsPage() {
  const { currentUser, isAdmin } = useAuth();
  // Admins land on Pending (their actionable queue); everyone else lands on
  // All — they're just checking outcomes, and their own resolved items
  // otherwise wouldn't even be in `items` to mark seen below.
  const [status, setStatus] = useState(isAdmin ? 'pending' : '');
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [reviewingId, setReviewingId] = useState(0);
  const [editValues, setEditValues] = useState({}); // { [id]: corrected text } — Admin only, lets a typo get fixed before approving
  const [toast, setToast] = useState('');
  const [allPicklists, setAllPicklists] = useState({});   // { [listName]: [values] } — for the "existing options" reference and the duplicate check
  const [expandedListId, setExpandedListId] = useState(0); // which row's "existing options" panel is open
  const [expandedSearch, setExpandedSearch] = useState(''); // filter text inside that panel — the AI hint below can silently fail (external service), so this is the check that always works
  const [dupHints, setDupHints] = useState({});            // { [id]: likelyDuplicateOf string } from the same AI check the Cases form uses
  const dupChecked = useRef(new Set());                    // ids already sent through the duplicate check — avoid re-firing every render
  const [rejectingId, setRejectingId] = useState(0);       // which row's reject-reason box is open
  const [rejectReason, setRejectReason] = useState('');
  const [rejectExistingValue, setRejectExistingValue] = useState(''); // picked from the picklist — drives the auto-correct-the-case behaviour

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    psri.getPicklists().then(d => setAllPicklists(d?.picklists || {})).catch(() => {});
  }, []);

  const refresh = useCallback((s) => {
    setLoading(true);
    setLoadErr('');
    return psri.getPicklistSuggestions(s)
      .then(setItems)
      .catch(() => setLoadErr('Could not load suggestions. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(status); }, [status, refresh]);

  // Non-admins only ever see what they themselves suggested — so they can
  // check whether it was approved, rejected, or approved with a correction
  // — never anyone else's.
  const visibleItems = isAdmin ? items : items.filter(it => it.suggestedBy === currentUser?.id);

  // Opening this page is what "reads" a resolved suggestion — marks every
  // own, already-decided item seen so the rail's notification count clears.
  // Depends on `items`/`currentUser` directly (not `visibleItems`, a new
  // array every render) so this only runs when the data actually changes.
  useEffect(() => {
    if (isAdmin) return;
    const resolved = items.filter(it => it.suggestedBy === currentUser?.id && it.status !== 'pending');
    if (resolved.length) markSeen(resolved);
  }, [items, isAdmin, currentUser]);

  // Runs the same AI similarity check the Cases form already uses on the
  // suggest side, but now for the reviewer too — catches semantic
  // duplicates (Teeth Surgery vs. Dental Surgery, Nerve Surgery vs. Brain
  // Surgery) that look nothing alike as strings, so a TL doesn't have to
  // spot them by eye against a long existing list.
  useEffect(() => {
    if (!isAdmin) return;
    const toCheck = visibleItems.filter(it =>
      it.status === 'pending' && it.listName === 'Name of Procedure' && !dupChecked.current.has(it.id)
    );
    if (toCheck.length === 0) return;
    toCheck.forEach(it => dupChecked.current.add(it.id));
    toCheck.forEach(it => {
      psri.polishProcedureName({ value: it.value, existingValues: allPicklists['Name of Procedure'] || [] })
        .then(res => {
          if (res?.likelyDuplicateOf) setDupHints(h => ({ ...h, [it.id]: res.likelyDuplicateOf }));
        })
        .catch(() => {});
    });
  }, [visibleItems, isAdmin, allPicklists]);

  const review = async (item, approved, reason = '', existingValue = '') => {
    setReviewingId(item.id);
    try {
      const corrected = (editValues[item.id] || '').trim();
      const res = await psri.reviewPicklistSuggestion({
        id: item.id, approved,
        correctedValue: corrected && corrected !== item.value ? corrected : '',
        rejectionReason: reason,
        existingValue,
        reviewerId: currentUser?.id || '', reviewerName: currentUser?.name || '',
      });
      showToast(res.warning ? res.warning
        : approved ? 'Approved — now live in the picklist'
        : res.caseUpdated ? `Rejected — case updated to "${existingValue}"`
        : 'Rejected');
      setEditValues(v => { const next = { ...v }; delete next[item.id]; return next; });
      setRejectingId(0);
      setRejectReason('');
      setRejectExistingValue('');
      await refresh(status);
    } catch (err) {
      showToast(err.message || 'Could not save review. Please try again.');
    } finally {
      setReviewingId(0);
    }
  };

  // Reject is two steps: clicking the button opens an inline reason box
  // (startReject) instead of rejecting immediately — the agent who
  // suggested it needs to see WHY, not just that it was turned down.
  const startReject = (item) => { setRejectingId(item.id); setRejectReason(''); setRejectExistingValue(''); };
  const confirmReject = (item) => {
    if (!rejectReason.trim()) return;
    review(item, false, rejectReason.trim(), rejectExistingValue);
  };
  // Picking an existing value prefills a sensible reason — still editable
  // before confirming, in case the TL wants to word it differently.
  const pickExistingForReject = (value) => {
    setRejectExistingValue(value);
    if (value) setRejectReason(`Already covered by "${value}" — please use that instead.`);
  };

  return (
    <div className="admin-page">
      <div className="admin-top">
        <div>
          <h1 className="admin-title">Picklist Suggestions</h1>
          <p className="admin-subtitle">
            {isAdmin
              ? 'New values agents proposed from the Cases form (currently Name of Procedure) — correct a typo if needed, then approve to make it selectable for everyone, or reject.'
              : 'New values you proposed from the Cases form — see whether each was approved, corrected, or rejected.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={status === t.value ? 'admin-btn-primary' : 'admin-btn-ghost'}
            style={{ fontSize: 13 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadErr && <div className="admin-err-banner">{loadErr}</div>}

      {loading ? (
        <div className="admin-table-loading">Loading…</div>
      ) : visibleItems.length === 0 ? (
        <div className="admin-table-wrap" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
          No {status || ''} suggestions{isAdmin ? '' : ' from you'}.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>List</th>
                <th>Suggested Value</th>
                <th>Suggested By</th>
                <th>When</th>
                <th>Status</th>
                {isAdmin && status === 'pending' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(it => {
                const editable = isAdmin && it.status === 'pending';
                const existingForList = allPicklists[it.listName] || [];
                const isExpanded = expandedListId === it.id;
                return (
                <Fragment key={it.id}>
                <tr>
                  <td>{it.listName}</td>
                  <td style={{ fontWeight: 700 }}>
                    {editable ? (
                      <input
                        type="text"
                        value={editValues[it.id] ?? it.value}
                        onChange={e => setEditValues(v => ({ ...v, [it.id]: e.target.value }))}
                        style={{ minWidth: 200 }}
                      />
                    ) : it.value}
                    {it.caseContext && (
                      <div style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Case summary: {it.caseContext}
                      </div>
                    )}
                    {isAdmin && dupHints[it.id] && (
                      <div style={{ fontSize: 12, color: '#b45309', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>⚠ May already mean "{dupHints[it.id]}"</span>
                        <button
                          type="button" className="admin-btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => setEditValues(v => ({ ...v, [it.id]: dupHints[it.id] }))}
                        >
                          Use this instead
                        </button>
                      </div>
                    )}
                    {isAdmin && existingForList.length > 0 && (
                      <button
                        type="button" className="admin-btn-ghost" style={{ fontSize: 11, padding: '2px 6px', marginTop: 4 }}
                        onClick={() => { setExpandedListId(id => id === it.id ? 0 : it.id); setExpandedSearch(''); }}
                      >
                        {isExpanded ? 'Hide' : 'Show'} existing {it.listName} ({existingForList.length})
                      </button>
                    )}
                  </td>
                  <td>{it.suggestedByName || it.suggestedBy || '—'}</td>
                  <td>{fmtWhen(it.created)}</td>
                  <td>
                    {it.status === 'pending' && <span style={{ color: '#b45309', fontWeight: 700 }}>Pending</span>}
                    {it.status === 'approved' && <span style={{ color: '#15803d', fontWeight: 700 }}>Approved by {it.reviewedByName}</span>}
                    {it.status === 'rejected' && (
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                        Rejected by {it.reviewedByName}
                        {it.rejectionReason && <div style={{ fontWeight: 400, fontSize: 12, marginTop: 2 }}>Reason: {it.rejectionReason}</div>}
                      </span>
                    )}
                  </td>
                  {isAdmin && status === 'pending' && (
                    <td>
                      {rejectingId === it.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                          {existingForList.length > 0 && (
                            <select
                              value={rejectExistingValue}
                              onChange={e => pickExistingForReject(e.target.value)}
                              style={{ fontSize: 12 }}
                            >
                              <option value="">— This is a duplicate of… (optional) —</option>
                              {[...existingForList].sort((a, b) => a.localeCompare(b)).map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text" autoFocus placeholder="Why is this rejected?"
                            value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            style={{ fontSize: 12 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="admin-btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} disabled={!rejectReason.trim() || reviewingId === it.id} onClick={() => confirmReject(it)}>
                              Confirm Reject
                            </button>
                            <button className="admin-btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setRejectingId(0)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="admin-btn-primary" style={{ background: '#15803d', fontSize: 12, padding: '6px 10px' }} disabled={reviewingId === it.id} onClick={() => review(it, true)}>Approve</button>
                          <button className="admin-btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} disabled={reviewingId === it.id} onClick={() => startReject(it)}>Reject</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={isAdmin && status === 'pending' ? 6 : 5} style={{ background: '#f8fafc' }}>
                      <input
                        type="text" autoFocus placeholder={`Search ${existingForList.length} existing values…`}
                        value={expandedSearch} onChange={e => setExpandedSearch(e.target.value)}
                        style={{ fontSize: 12, marginBottom: 8, width: 260 }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
                        {existingForList
                          .filter(v => v.toLowerCase().includes(expandedSearch.trim().toLowerCase()))
                          .sort((a, b) => a.localeCompare(b))
                          .map(v => (
                            <span key={v} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: '#e2e8f0', color: '#334155' }}>{v}</span>
                          ))}
                        {expandedSearch.trim() && !existingForList.some(v => v.toLowerCase().includes(expandedSearch.trim().toLowerCase())) && (
                          <span className="cp-hint">No existing value matches "{expandedSearch.trim()}"</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
