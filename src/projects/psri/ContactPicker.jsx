import { useState, useEffect, useRef, useCallback } from 'react';
import { psri } from '../../api/psri';
import { usePicklists } from '../../context/PicklistsContext';
import { useDependencies } from '../../context/DependenciesContext';
import { useUsers } from '../../context/UsersContext';
import { useAuth } from '../../context/AuthContext';
import { COUNTRIES, findCountry } from '../../data/countries';
import { INDIA_STATES, INDIA_STATE_NAMES } from '../../data/indiaStates';
import './Psri.css';

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Master', 'Baby'];

function fullNumber(isd, num) { return num ? `${isd} ${num}` : ''; }

function titleCase(s) {
  return (s || '').trim().replace(/\s+/g, ' ').replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Value-to-value dependency lookup (e.g. Source=Digital → Sub Source=Google), with a
// fallback to the flat base picklist if no dependency pairs exist yet for that value.
function getDependentOptions(getDependentValues, getList, subField, mainField, mainValue) {
  const specific = getDependentValues(subField, mainField, mainValue);
  if (specific.length > 0) return specific;
  return getList(subField);
}

const quickEmptyForm = {
  salutation: 'Mr.', name: '', age: '',
  mobileIsd: '+91', mobile: '', altMobileIsd: '+91', altMobile: '', altMobile2Isd: '+91', altMobile2: '', landlineIsd: '+91', landline: '',
  email: '',
  country: 'IN', state: '', city: '',
  contactType: '', source: '', subSource: '', language: 'English',
  assignedTo: '', notes: '',
};

function PhoneField({ label, required, isdValue, numValue, onIsdChange, onNumChange, error }) {
  return (
    <div className="psri-field" style={{ minWidth: 220 }}>
      <label>{label} {required && <span className="req">*</span>}</label>
      <div className="psri-phone-row">
        <select className="psri-isd-select" value={isdValue} onChange={e => onIsdChange(e.target.value)}>
          {COUNTRIES.map(c => <option key={c.iso2} value={c.isd}>{c.isd} {c.name}</option>)}
        </select>
        <input
          type="tel"
          maxLength={10}
          value={numValue}
          onChange={e => onNumChange(e.target.value.replace(/\D/g, ''))}
          className={error ? 'err' : ''}
          placeholder="Number"
        />
      </div>
      {error && <p className="psri-err-msg">{error}</p>}
    </div>
  );
}

// Shared by Cases & Leads — search for an existing contact, or quick-add a new one inline.
// onSelect receives the contact object: { id, name, mobile, ... }
// Ensures a contact's existing value (even an old/legacy one not in the picklist) is never silently dropped
function withCurrentValue(list, current) {
  if (!current || list.includes(current)) return list;
  return [...list, current];
}

export default function ContactPicker({ onSelect, selected, initialQuery = '', autoOpenQuickAdd = false }) {
  const { getList } = usePicklists();
  const { getDependentValues } = useDependencies();
  const { users } = useUsers();
  const { currentUser, isAdmin } = useAuth();
  const [query, setQuery]       = useState(initialQuery);
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickForm, setQuickForm]       = useState(quickEmptyForm);
  const [quickErrors, setQuickErrors]   = useState({});
  const [quickSaving, setQuickSaving]   = useState(false);
  const [quickErr, setQuickErr]         = useState('');
  // Non-null while the modal is editing the already-selected contact in
  // place, rather than adding a new one — lets the agent fix a placeholder
  // name/details right from the Case screen without losing the call's Txn
  // ID / called number (those live in the Case form, untouched by this).
  const [editingContactId, setEditingContactId] = useState(null);
  // Non-null while the agent has said "this unmatched caller is actually an
  // existing contact" (triggered from the auto-opened Quick Add for a call
  // with no match) — holds the phone number to attach once they pick which
  // existing contact it belongs to. Search behaves normally in this mode;
  // picking a result attaches instead of just selecting.
  const [attachPhone, setAttachPhone]   = useState(null);
  const [attaching,   setAttaching]     = useState(false);
  const [attachErr,   setAttachErr]     = useState('');
  const debounceRef   = useRef(null);
  const autoOpenedRef = useRef(false);

  // Only true for the exact flow this is meant for: DialerPanel auto-opening
  // Quick Add because an incoming/outgoing call's number matched no contact.
  // initialQuery is fixed at mount (see useState below), so later edits to
  // the search box can't accidentally turn this on for an unrelated search.
  const isUnmatchedCallPhone = autoOpenQuickAdd && /^\d{10}$/.test(initialQuery.trim());

  const openQuickAdd = useCallback((prefillMobile) => {
    const mobileSeed = prefillMobile || query.trim();
    setEditingContactId(null);
    setQuickForm({
      ...quickEmptyForm,
      name: mobileSeed && /^\d+$/.test(mobileSeed) ? '' : (prefillMobile ? '' : mobileSeed),
      mobile: /^\d{10}$/.test(mobileSeed) ? mobileSeed : '',
      // Whoever's adding this contact owns it by default — a regular agent
      // can't reassign it away (see the field's disabled state below); an
      // admin still can, if they need to hand it to someone else.
      assignedTo: currentUser?.id || '',
    });
    setQuickErrors({}); setQuickErr('');
    setShowQuickAdd(true);
  }, [query, currentUser]);

  const openEditContact = () => {
    setEditingContactId(selected.id);
    setQuickForm({
      salutation: selected.salutation || 'Mr.', name: selected.name || '', age: selected.age || '',
      mobileIsd: selected.mobileIsd || '+91', mobile: selected.mobile || '',
      altMobileIsd: selected.altMobileIsd || '+91', altMobile: selected.altMobile || '',
      altMobile2Isd: selected.altMobile2Isd || '+91', altMobile2: selected.altMobile2 || '',
      landlineIsd: selected.landlineIsd || '+91', landline: selected.landline || '',
      email: selected.email || '',
      country: selected.country || 'IN', state: selected.state || '', city: selected.city || '',
      contactType: selected.contactType || '', source: selected.source || '', subSource: selected.subSource || '',
      language: selected.language || 'English', assignedTo: selected.assignedTo || '', notes: selected.notes || '',
    });
    setQuickErrors({}); setQuickErr('');
    setShowQuickAdd(true);
  };

  // A second person calling from the same registered number (e.g. a family
  // member on the patient's own phone) — not the same person as `selected`,
  // so this creates a NEW contact (editingContactId stays null), pre-filled
  // with everything that's genuinely shared (phone, source, patient type,
  // address...) so the agent only has to change what's actually different,
  // starting with the name.
  const openAddAnotherContact = () => {
    setEditingContactId(null);
    setQuickForm({
      salutation: 'Mr.', name: '', age: '',
      mobileIsd: selected.mobileIsd || '+91', mobile: selected.mobile || '',
      altMobileIsd: selected.altMobileIsd || '+91', altMobile: selected.altMobile || '',
      altMobile2Isd: selected.altMobile2Isd || '+91', altMobile2: selected.altMobile2 || '',
      landlineIsd: selected.landlineIsd || '+91', landline: selected.landline || '',
      email: '',
      country: selected.country || 'IN', state: selected.state || '', city: selected.city || '',
      contactType: selected.contactType || '', source: selected.source || '', subSource: selected.subSource || '',
      language: selected.language || 'English',
      // Not copied from the source contact — whoever's adding this new
      // person owns it, same as a plain Quick Add.
      assignedTo: currentUser?.id || '',
      notes: '',
    });
    setQuickErrors({}); setQuickErr('');
    setShowQuickAdd(true);
  };

  // Agent recognises the unmatched caller as someone already in the system —
  // switch from "add a new contact" to "find the existing one", keeping the
  // call's number around to attach once they pick it.
  const switchToAttachExisting = () => {
    setShowQuickAdd(false);
    setAttachErr('');
    setAttachPhone(quickForm.mobile || initialQuery.trim());
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  // Saves the incoming call's number into the first free alternate-number
  // slot on the chosen existing contact, then proceeds as if that contact
  // had matched the call to begin with.
  const attachAndSelect = async (c) => {
    setAttaching(true);
    setAttachErr('');
    const slot = !c.altMobile ? 'altMobile' : !c.altMobile2 ? 'altMobile2' : !c.landline ? 'landline' : null;
    if (!slot) {
      setAttachErr('This contact already has every alternate number slot filled — edit the contact to free one up first.');
      setAttaching(false);
      return;
    }
    const isdKey = slot === 'landline' ? 'landlineIsd' : `${slot}Isd`;
    const updated = { ...c, [slot]: attachPhone, [isdKey]: c.mobileIsd || '+91' };
    try {
      await psri.updateContact(updated);
      setAttachPhone(null);
      onSelect(updated);
    } catch (err) {
      setAttachErr(err.message || 'Could not attach this number to the contact');
    } finally {
      setAttaching(false);
    }
  };

  // Auto-open the Quick Add modal when the caller has no contact record
  useEffect(() => {
    if (autoOpenQuickAdd && searched && !searching && results.length === 0 && !showQuickAdd && !autoOpenedRef.current && !attachPhone) {
      autoOpenedRef.current = true;
      openQuickAdd();
    }
  }, [autoOpenQuickAdd, searched, searching, results.length, showQuickAdd, openQuickAdd, attachPhone]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearched(false); setSearchErr(''); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      setSearchErr('');
      psri.getContacts(query.trim())
        .then(res => { setResults(res.contacts || []); setSearched(true); })
        .catch(() => { setResults([]); setSearched(true); setSearchErr('Could not search contacts. Please try again, or add a new contact below.'); })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleQuickCountryChange = (iso2) => {
    const c = findCountry(iso2);
    setQuickForm(f => ({
      ...f, country: iso2, state: '', city: '',
      mobileIsd: c.isd, altMobileIsd: c.isd, altMobile2Isd: c.isd, landlineIsd: c.isd,
    }));
  };

  const validateQuick = () => {
    const e = {};
    if (!quickForm.name.trim()) e.name = 'Name is required';
    if (!/^\d{10}$/.test(quickForm.mobile.trim())) e.mobile = 'Valid 10-digit mobile is required';
    if (!quickForm.contactType) e.contactType = 'Select a contact type';
    if (quickForm.age && (Number(quickForm.age) < 0 || Number(quickForm.age) > 130)) e.age = 'Enter a valid age';
    // Only enforced when correcting an existing contact (editingContactId
    // set), not on a fresh Quick Add — a live call shouldn't be held up by
    // these, but a second, deliberate touch to fix up the contact's details
    // should actually finish the job rather than leave them still blank.
    // Also reject the auto-log sentinel values themselves ("Not Connected" /
    // "Unable to Connect") — a contact auto-created from an unanswered
    // callback starts with these already filled in on purpose, so a plain
    // blank check alone wouldn't catch it; the agent must pick something real.
    if (editingContactId) {
      if (!quickForm.contactType || quickForm.contactType === 'Not Connected') e.contactType = 'Update the contact type';
      if (!quickForm.source || quickForm.source === 'Unable to Connect') e.source = 'Select a real source';
      if (!quickForm.subSource || quickForm.subSource === 'Unable to Connect') e.subSource = 'Select a real sub source';
      if (quickForm.name.trim() === 'Not Disclosed') e.name = 'Enter the caller\'s actual name';
    }
    return e;
  };

  const quickStateOptions = quickForm.country === 'IN' ? INDIA_STATE_NAMES : [];
  const quickCityOptions  = quickForm.country === 'IN' && quickForm.state ? (INDIA_STATES[quickForm.state] || []) : [];

  const handleQuickSave = async (ev) => {
    ev?.preventDefault();
    const errs = validateQuick();
    if (Object.keys(errs).length) { setQuickErrors(errs); return; }
    // Belt-and-suspenders alongside the disabled select above — a non-admin
    // creating a new contact always carries their own id for assignedTo,
    // regardless of what's sitting in state. Only on create: editing an
    // existing contact must NOT silently reassign it away from whoever it's
    // currently with just because a non-admin fixed an unrelated typo.
    const cleaned = {
      ...quickForm,
      name: titleCase(quickForm.name),
      assignedTo: (isAdmin || editingContactId) ? quickForm.assignedTo : (currentUser?.id || ''),
    };
    setQuickSaving(true);
    setQuickErr('');
    try {
      if (editingContactId) {
        await psri.updateContact({ ...cleaned, id: editingContactId });
        // Preserve the contact's original `created` timestamp (editing isn't
        // creating) — CasesPage uses that timestamp's recency, not a session
        // flag, to decide whether to nudge the agent to double-check details,
        // so it keeps working correctly across page reloads/new tabs.
        onSelect({ ...cleaned, id: editingContactId, created: selected.created });
      } else {
        const res = await psri.addContact(cleaned);
        // No `created` comes back from addContact's response, so stamp one
        // client-side (close enough to the server's) — CasesPage reads this
        // to know the contact is fresh-off-Quick-Add.
        onSelect({ ...cleaned, id: res.id, created: new Date().toISOString() });
      }
      setShowQuickAdd(false);
      setEditingContactId(null);
      setQuery('');
      setResults([]);
    } catch (err) {
      setQuickErr(err.message || 'Could not save contact');
    } finally {
      setQuickSaving(false);
    }
  };

  // Rendered from both branches below (selected-contact card AND the search
  // UI) — it must NOT live inside only one of those two `return`s, or
  // there's no way to ever display it while the other branch is active.
  // That was the actual bug: clicking Edit while a contact was selected set
  // showQuickAdd=true correctly, but the early-return for the "selected"
  // branch below meant the code that renders this modal was never reached —
  // the popup silently couldn't show until something (e.g. Change) switched
  // the component over to the other branch, at which point the already-set
  // state suddenly rendered, looking like Change had triggered it.
  const quickAddModal = showQuickAdd && (
        <div className="psri-modal-overlay" onClick={() => !quickSaving && setShowQuickAdd(false)}>
          <div className="psri-modal cp-quick-add-modal" onClick={e => e.stopPropagation()}>
            <div className="psri-modal-title">{editingContactId ? 'Edit Contact' : 'Quick Add Contact'}</div>
            {quickErr && <div className="psri-err-banner">{quickErr}</div>}
            <div className="psri-form">

              <div className="psri-form-section-label">Identity</div>
              <div className="psri-form-row">
                <div className="psri-field" style={{ flex: '0 0 100px' }}>
                  <label>Salutation</label>
                  <select value={quickForm.salutation} onChange={e => setQuickForm(f => ({ ...f, salutation: e.target.value }))}>
                    {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="psri-field" style={{ flex: 1 }}>
                  <label>Full Name <span className="req">*</span></label>
                  <input
                    type="text"
                    value={quickForm.name}
                    onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))}
                    className={quickErrors.name ? 'err' : ''}
                  />
                  {quickErrors.name && <p className="psri-err-msg">{quickErrors.name}</p>}
                </div>
                <div className="psri-field" style={{ flex: '0 0 90px' }}>
                  <label>Age</label>
                  <input
                    type="number"
                    min="0" max="130"
                    value={quickForm.age}
                    onChange={e => setQuickForm(f => ({ ...f, age: e.target.value }))}
                    className={quickErrors.age ? 'err' : ''}
                  />
                  {quickErrors.age && <p className="psri-err-msg">{quickErrors.age}</p>}
                </div>
              </div>

              <div className="psri-form-section-label">Contact Information</div>
              <div className="psri-form-row">
                <PhoneField
                  label="Mobile" required
                  isdValue={quickForm.mobileIsd} numValue={quickForm.mobile}
                  onIsdChange={v => setQuickForm(f => ({ ...f, mobileIsd: v }))}
                  onNumChange={v => setQuickForm(f => ({ ...f, mobile: v }))}
                  error={quickErrors.mobile}
                />
                <PhoneField
                  label="Alternate Mobile"
                  isdValue={quickForm.altMobileIsd} numValue={quickForm.altMobile}
                  onIsdChange={v => setQuickForm(f => ({ ...f, altMobileIsd: v }))}
                  onNumChange={v => setQuickForm(f => ({ ...f, altMobile: v }))}
                />
                <PhoneField
                  label="Alternate Mobile 2"
                  isdValue={quickForm.altMobile2Isd} numValue={quickForm.altMobile2}
                  onIsdChange={v => setQuickForm(f => ({ ...f, altMobile2Isd: v }))}
                  onNumChange={v => setQuickForm(f => ({ ...f, altMobile2: v }))}
                />
                <PhoneField
                  label="Alternate Landline"
                  isdValue={quickForm.landlineIsd} numValue={quickForm.landline}
                  onIsdChange={v => setQuickForm(f => ({ ...f, landlineIsd: v }))}
                  onNumChange={v => setQuickForm(f => ({ ...f, landline: v }))}
                />
              </div>
              <div className="psri-field">
                <label>Email</label>
                <input type="email" value={quickForm.email} onChange={e => setQuickForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
              </div>

              <div className="psri-form-section-label">Address</div>
              <div className="psri-form-row">
                <div className="psri-field">
                  <label>Country</label>
                  <select value={quickForm.country} onChange={e => handleQuickCountryChange(e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.iso2} value={c.iso2}>{c.name} ({c.isd})</option>)}
                  </select>
                </div>
                <div className="psri-field">
                  <label>State</label>
                  {quickForm.country === 'IN' ? (
                    <select value={quickForm.state} onChange={e => setQuickForm(f => ({ ...f, state: e.target.value, city: '' }))}>
                      <option value="">— Select —</option>
                      {quickStateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={quickForm.state} onChange={e => setQuickForm(f => ({ ...f, state: e.target.value }))} placeholder="State / Province" />
                  )}
                </div>
                <div className="psri-field">
                  <label>City</label>
                  {quickForm.country === 'IN' && quickForm.state ? (
                    <select value={quickForm.city} onChange={e => setQuickForm(f => ({ ...f, city: e.target.value }))}>
                      <option value="">— Select —</option>
                      {quickCityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={quickForm.city} onChange={e => setQuickForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                  )}
                </div>
              </div>

              <div className="psri-form-section-label">Classification &amp; Assignment</div>
              <div className="psri-form-row">
                <div className="psri-field">
                  <label>Contact Type <span className="req">*</span></label>
                  <select
                    value={quickForm.contactType}
                    onChange={e => setQuickForm(f => ({ ...f, contactType: e.target.value }))}
                    className={quickErrors.contactType ? 'err' : ''}
                  >
                    <option value="">— Select —</option>
                    {getList('Contact Type').map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {quickErrors.contactType && <p className="psri-err-msg">{quickErrors.contactType}</p>}
                </div>
                <div className="psri-field">
                  <label>Source of Information {editingContactId && <span className="req">*</span>}</label>
                  <select
                    value={quickForm.source}
                    onChange={e => setQuickForm(f => ({ ...f, source: e.target.value, subSource: '' }))}
                    className={quickErrors.source ? 'err' : ''}
                  >
                    <option value="">— Select —</option>
                    {getList('Source of Information').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {quickErrors.source && <p className="psri-err-msg">{quickErrors.source}</p>}
                </div>
                <div className="psri-field">
                  <label>Sub Source of Information {editingContactId && <span className="req">*</span>}</label>
                  <select
                    value={quickForm.subSource}
                    disabled={!quickForm.source}
                    onChange={e => setQuickForm(f => ({ ...f, subSource: e.target.value }))}
                    className={quickErrors.subSource ? 'err' : ''}
                  >
                    <option value="">{quickForm.source ? '— Select —' : '— Select Source first —'}</option>
                    {quickForm.source ? getDependentOptions(getDependentValues, getList, 'Sub Source of Information', 'Source of Information', quickForm.source).map(s => <option key={s} value={s}>{s}</option>) : null}
                  </select>
                  {quickErrors.subSource && <p className="psri-err-msg">{quickErrors.subSource}</p>}
                </div>
                <div className="psri-field">
                  <label>Language Preference</label>
                  <select value={quickForm.language} onChange={e => setQuickForm(f => ({ ...f, language: e.target.value }))}>
                    <option value="">— Select —</option>
                    {getList('Language').map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="psri-field">
                  <label>Contact Assigned To</label>
                  <select
                    value={quickForm.assignedTo}
                    onChange={e => setQuickForm(f => ({ ...f, assignedTo: e.target.value }))}
                    disabled={!isAdmin}
                    title={!isAdmin ? 'Contacts you add are assigned to you' : undefined}
                  >
                    <option value="">— Unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              </div>

              <div className="psri-field">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={quickForm.notes}
                  onChange={e => setQuickForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional context about this contact…"
                />
              </div>

              <div className="psri-modal-actions">
                {!editingContactId && isUnmatchedCallPhone && (
                  <button type="button" className="psri-btn-ghost" onClick={switchToAttachExisting} disabled={quickSaving} style={{ marginRight: 'auto' }}>
                    Not a new contact? Attach this number to an existing contact
                  </button>
                )}
                <button type="button" className="psri-btn-ghost" onClick={() => { setShowQuickAdd(false); setEditingContactId(null); }} disabled={quickSaving}>Cancel</button>
                <button type="button" className="psri-btn-primary" onClick={handleQuickSave} disabled={quickSaving}>
                  {editingContactId ? (quickSaving ? 'Saving…' : 'Save Changes') : (quickSaving ? 'Creating…' : 'Create & Select')}
                </button>
              </div>
            </div>
          </div>
        </div>
  );

  if (selected) {
    return (
      <>
        <div className="cp-selected">
          <div className="psri-avatar">{(selected.name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}</div>
          <div className="cp-selected-info">
            <div className="cp-selected-name">{selected.salutation} {selected.name}</div>
            <div className="cp-selected-meta">{fullNumber(selected.mobileIsd || '+91', selected.mobile)}</div>
          </div>
          <button type="button" className="psri-btn-ghost" onClick={openEditContact}>Edit</button>
          <button type="button" className="psri-btn-ghost" onClick={openAddAnotherContact}>+ Add Another Contact</button>
          <button type="button" className="psri-btn-ghost" onClick={() => onSelect(null)}>Change</button>
        </div>
        {quickAddModal}
      </>
    );
  }

  return (
    <div className="cp-wrap">
      {attachPhone && (
        <div className="cp-hint" style={{ marginBottom: 8 }}>
          Attaching <strong>{attachPhone}</strong> to an existing contact — search by name below, then pick the right one.
          {' '}<button type="button" className="psri-btn-ghost" onClick={() => { const phone = attachPhone; setAttachPhone(null); setAttachErr(''); openQuickAdd(phone); }} disabled={attaching}>Cancel — add as new contact instead</button>
        </div>
      )}
      {attachErr && <p className="psri-err-msg">{attachErr}</p>}
      <input
        className="psri-search-input"
        style={{ maxWidth: 'none', width: '100%' }}
        type="text"
        placeholder="Search contact by name, mobile, or email…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
        disabled={attaching}
      />

      {(searching || attaching) && <div className="cp-hint">{attaching ? 'Attaching…' : 'Searching…'}</div>}

      {!searching && !attaching && searched && results.length > 0 && (
        <div className="cp-results">
          {results.map(c => (
            <div key={c.id} className="cp-result-item" onClick={() => (attachPhone ? attachAndSelect(c) : onSelect(c))}>
              <div className="psri-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                {(c.name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}
              </div>
              <div>
                <div className="cp-result-name">{c.salutation} {c.name}</div>
                <div className="cp-result-meta">{fullNumber(c.mobileIsd, c.mobile)} {c.contactType && `· ${c.contactType}`}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && !attaching && searched && results.length === 0 && (
        <div className="cp-no-results">
          {searchErr && <p className="psri-err-msg">{searchErr}</p>}
          <p>No contact found for "{query}"</p>
          {!attachPhone && <button type="button" className="psri-btn-primary" onClick={openQuickAdd}>+ Quick Add Contact</button>}
        </div>
      )}

      {quickAddModal}
    </div>
  );
}
