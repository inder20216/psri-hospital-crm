// Tracks, per-browser, which picklist-suggestion outcomes an agent has
// already looked at — {id: status} in localStorage. Lets the rail show "you
// have 2 new suggestion results" and have that badge actually clear once
// they open the page, instead of staying lit forever or needing a
// server-side "read" flag for what's a purely cosmetic notification.
const KEY = 'psri_suggestions_seen';

function readSeen() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function countUnseen(items) {
  const seen = readSeen();
  return items.filter(it => seen[it.id] !== it.status).length;
}

export function markSeen(items) {
  try {
    const seen = readSeen();
    items.forEach(it => { seen[it.id] = it.status; });
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch { /* storage unavailable — badge just won't clear, not worth failing over */ }
}
