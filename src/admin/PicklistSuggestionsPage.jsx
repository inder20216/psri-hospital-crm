import { useState, useEffect, useCallback } from 'react';
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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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

  const review = async (item, approved) => {
    setReviewingId(item.id);
    try {
      const corrected = (editValues[item.id] || '').trim();
      const res = await psri.reviewPicklistSuggestion({
        id: item.id, approved,
        correctedValue: corrected && corrected !== item.value ? corrected : '',
        reviewerId: currentUser?.id || '', reviewerName: currentUser?.name || '',
      });
      showToast(res.warning ? res.warning : (approved ? 'Approved — now live in the picklist' : 'Rejected'));
      setEditValues(v => { const next = { ...v }; delete next[item.id]; return next; });
      await refresh(status);
    } catch (err) {
      showToast(err.message || 'Could not save review. Please try again.');
    } finally {
      setReviewingId(0);
    }
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
                return (
                <tr key={it.id}>
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
                  </td>
                  <td>{it.suggestedByName || it.suggestedBy || '—'}</td>
                  <td>{fmtWhen(it.created)}</td>
                  <td>
                    {it.status === 'pending' && <span style={{ color: '#b45309', fontWeight: 700 }}>Pending</span>}
                    {it.status === 'approved' && <span style={{ color: '#15803d', fontWeight: 700 }}>Approved by {it.reviewedByName}</span>}
                    {it.status === 'rejected' && <span style={{ color: '#b91c1c', fontWeight: 700 }}>Rejected by {it.reviewedByName}</span>}
                  </td>
                  {isAdmin && status === 'pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn-primary" style={{ background: '#15803d', fontSize: 12, padding: '6px 10px' }} disabled={reviewingId === it.id} onClick={() => review(it, true)}>Approve</button>
                        <button className="admin-btn-danger" style={{ fontSize: 12, padding: '6px 10px' }} disabled={reviewingId === it.id} onClick={() => review(it, false)}>Reject</button>
                      </div>
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
