/* Repeat-call detection.
 *
 * A "repeat" is the same person raising the same concern more than once — the
 * thing a front desk needs to see before they call back, because the 3rd call
 * about the same problem deserves a different response to the 1st.
 *
 * Matching rule: same mobile number + same concern text, compared
 * case/punctuation/whitespace-insensitively, so "Guest wants Dr. Nripen
 * appointment!" and "guest wants dr nripen appointment" are one concern.
 *
 * Two cases with the same concern but different people are deliberately NOT a
 * repeat: "Appointment booked" from nine different patients is not nine calls
 * about one problem.
 *
 * Cases with no mobile or no concern text cannot be matched and are skipped.
 */

/** Normalised key for a case, or '' when the case can't be matched. */
export function repeatKey(c) {
  const mobile = String(c?.contactMobile || '').replace(/\D/g, '');
  const concern = normalizeConcern(c?.summary);
  if (!mobile || !concern) return '';
  return `${mobile}|${concern}`;
}

/** Lower-case, drop punctuation, collapse whitespace. */
export function normalizeConcern(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function timeValue(created) {
  const t = Date.parse(String(created || '').replace(' ', 'T'));
  return Number.isNaN(t) ? null : t;
}

function formatDate(created) {
  const t = timeValue(created);
  if (t === null) return 'date unknown';
  return new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Index every case by how many times this person has raised this concern.
 *
 * Returns a Map keyed by case id — present only for cases that belong to a
 * repeat group (so a first-time call simply has no entry):
 *   { n, total, dates, concern }
 * where `n` is which call this case is (1 = the first) and `total` is how many
 * calls there have been about this concern.
 */
export function buildRepeatIndex(cases) {
  const groups = new Map();

  (cases || []).forEach((c, i) => {
    const key = repeatKey(c);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: c.id, created: c.created, i });
  });

  const index = new Map();

  groups.forEach((entries, key) => {
    if (entries.length < 2) return; // only a genuine repeat is worth flagging

    // Oldest call first, so `n` reads naturally. Cases with no usable date keep
    // their original order and sort last.
    const ordered = [...entries].sort((a, b) => {
      const at = timeValue(a.created);
      const bt = timeValue(b.created);
      if (at === null && bt === null) return a.i - b.i;
      if (at === null) return 1;
      if (bt === null) return -1;
      return at - bt;
    });

    const dates = ordered.map(e => formatDate(e.created));
    ordered.forEach((e, n) => {
      index.set(e.id, {
        key,
        n: n + 1,
        total: ordered.length,
        dates,
        concern: key.split('|')[1],
      });
    });
  });

  return index;
}

/** Title text for the repeat badge: lists when this concern was raised. */
export function repeatTitle(rep) {
  if (!rep) return '';
  const when = rep.dates.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return `This concern has come up ${rep.total} times:\n${when}`;
}