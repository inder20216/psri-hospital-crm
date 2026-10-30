import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { psri } from '../../api/psri';
import { useSparkTG } from '../../context/SparkTGContext';
import { useAuth } from '../../context/AuthContext';

// Sentinel picklist values for a contact/case auto-logged from an unanswered
// callback to a number with no existing contact — deliberately distinct from
// any value an agent would pick by hand, so the Edit flow's validation (see
// ContactPicker) can force a real correction later rather than letting these
// silently stand in forever.
const AUTO_LOG_CONTACT_TYPE = 'Not Connected';
const AUTO_LOG_SOURCE = 'Unable to Connect';

export default function DialerPanel() {
  const {
    hasWidget, callState, dismissCall, setDialerPrefill,
    trackedOutcome, clearTrackedOutcome,
    markInboundNoContact, isTrackedInboundNoContact, clearInboundNoContact,
  } = useSparkTG();
  const { currentUser } = useAuth();
  const currentAgentId = currentUser?.id || '';
  const navigate = useNavigate();

  const [contact,     setContact]     = useState(null);
  const [matches,     setMatches]     = useState([]);   // >1 contacts sharing this number — agent must pick
  const [recentCases, setRecentCases] = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [noContact,   setNoContact]   = useState(false);

  const phone = callState?.phone;
  const callStateRef   = useRef(callState);
  const autoNavigated  = useRef(false);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const goToCasesForNotFound = () => {
    if (autoNavigated.current) return;
    autoNavigated.current = true;
    const cs = callStateRef.current;
    // Remember this number so that if it's called back later (typically the
    // agent manually redialing from the SparkTG widget's own box, which we
    // have no visibility into as it happens) that callback can be recognised
    // as a continuation of this dropped inbound call — see the
    // trackedOutcome effect below.
    if (cs?.direction === 'inbound') markInboundNoContact(phone, cs?.callId);
    goToCases({
      contact:          null,
      prefillMobile:    phone,
      autoOpenQuickAdd: true,
      channel:          'Call',
      typeOfCall:       cs?.direction === 'inbound' ? 'Inbound' : 'Outbound',
      callTxnId:        cs?.callId   || '',
      calledNumber:     cs?.phone    || phone || '',
    });
    dismissCall();
  };

  // Fetches recent cases and auto-navigates for a single confirmed contact —
  // used both when the search returns exactly one match, and when the agent
  // picks one out of several matches sharing this number.
  const proceedWithContact = (found, { cancelledRef } = {}) => {
    setContact(found);
    setMatches([]);
    return psri.getCases(found.mobile).then(cr => {
      if (cancelledRef?.current) return;
      setRecentCases((cr.cases || []).slice(0, 3));
      if (!autoNavigated.current) {
        autoNavigated.current = true;
        const cs = callStateRef.current;
        goToCases({
          // contactType/source/created carried through (not just id/name/
          // mobile) so the Cases form can tell if this is still an
          // auto-logged placeholder (e.g. "Not Connected") needing a real
          // correction now that the call has actually connected — it can't
          // know that from a stripped-down contact object.
          contact:      { id: found.id, name: found.name, mobile: found.mobile, mobileIsd: found.mobileIsd || '+91', salutation: found.salutation, contactType: found.contactType, source: found.source, subSource: found.subSource, created: found.created },
          channel:      'Call',
          typeOfCall:   cs?.direction === 'inbound' ? 'Inbound' : 'Outbound',
          callTxnId:    cs?.callId    || '',
          calledNumber: cs?.phone     || phone || '',
        });
        dismissCall();
      }
    });
  };

  const pickMatch = (found) => {
    autoNavigated.current = false; // this is the agent's own click, not the initial auto-search
    proceedWithContact(found);
  };

  useEffect(() => {
    if (!phone) {
      setContact(null); setMatches([]); setRecentCases([]); setNoContact(false);
      autoNavigated.current = false;
      return;
    }
    // A call already tied to a known lead (e.g. dialed from the Prospects
    // page) shouldn't trigger this panel's contact-search / auto-navigate-
    // to-Cases flow at all — that flow exists for calls nobody has already
    // identified a reason for.
    if (callStateRef.current?.origin === 'prospect') {
      setContact(null); setMatches([]); setRecentCases([]); setNoContact(false);
      return;
    }
    // Tracked callbacks — a Missed-Calls-widget redial, or a call to a number
    // that just had a dropped inbound call with no contact — are handled
    // once the outcome (answered or not) is known, by the trackedOutcome
    // effect below, not immediately on dial/ring like an ordinary call.
    if (callStateRef.current?.origin === 'missed-call-callback' || isTrackedInboundNoContact(phone, callStateRef.current?.callId)) {
      setContact(null); setMatches([]); setRecentCases([]); setNoContact(false);
      return;
    }

    const cancelledRef = { current: false };
    autoNavigated.current = false;
    setSearching(true);
    setContact(null); setMatches([]); setRecentCases([]); setNoContact(false);

    psri.getContacts(phone)
      .then(res => {
        if (cancelledRef.current) return;
        const list = res.contacts || [];
        if (list.length === 1) {
          return proceedWithContact(list[0], { cancelledRef });
        } else if (list.length > 1) {
          // Same number shared by several contacts (e.g. a family landline) —
          // don't guess which one; let the agent choose instead of the old
          // behaviour of silently taking the first result.
          setMatches(list);
          setNoContact(false);
        } else {
          setNoContact(true);
          goToCasesForNotFound();
        }
      })
      .catch(() => {
        if (!cancelledRef.current) goToCasesForNotFound();
      })
      .finally(() => { if (!cancelledRef.current) setSearching(false); });

    return () => { cancelledRef.current = true; };
  }, [phone]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Resolves a tracked callback (Missed-Calls-widget redial, or a manual
  // redial matching a recently-dropped inbound call) once its outcome is
  // known. Answered, or undetermined (SparkTG never reported back in time) —
  // never guess, just hand it to the agent like any normal call. Confirmed
  // not-answered: auto-log silently ONLY if no contact exists at all for
  // this number; an existing contact still goes to the agent, same as today.
  useEffect(() => {
    if (!trackedOutcome) return;
    const { callId, phone: toPhone, kind, answered } = trackedOutcome;
    let cancelled = false;

    const navigateManual = (foundContact) => {
      if (cancelled) return;
      const typeOfCall = kind === 'missed-call' ? 'Abandoned Call'
        : (answered === false ? 'Inbound' : 'Outbound');
      setDialerPrefill({
        // contactType/source/created carried through — this is exactly the
        // path where a previously auto-logged placeholder contact (e.g. from
        // an earlier missed call) calls back and actually connects this
        // time; the Cases form needs these to know it's still a placeholder.
        contact: foundContact
          ? { id: foundContact.id, name: foundContact.name, mobile: foundContact.mobile, mobileIsd: foundContact.mobileIsd || '+91', salutation: foundContact.salutation, contactType: foundContact.contactType, source: foundContact.source, subSource: foundContact.subSource, created: foundContact.created }
          : null,
        prefillMobile: !foundContact ? toPhone : undefined,
        autoOpenQuickAdd: !foundContact,
        channel: 'Call',
        typeOfCall,
        ...(answered === false && kind === 'inbound-redial' ? { callFor: 'Inaudible or Call Disconnected' } : {}),
        callTxnId: callId,
        calledNumber: toPhone,
      });
      navigate('/psri/cases');
    };

    const autoLog = async () => {
      const contactPayload = {
        salutation: '', name: 'Not Disclosed', age: '',
        mobileIsd: '+91', mobile: toPhone,
        altMobileIsd: '+91', altMobile: '', landlineIsd: '+91', landline: '',
        email: '', country: 'IN', state: '', city: '',
        contactType: AUTO_LOG_CONTACT_TYPE, source: AUTO_LOG_SOURCE, subSource: AUTO_LOG_SOURCE,
        language: '', assignedTo: '', notes: '',
      };
      // skipWorkflow — this function creates its own detailed case for this
      // contact right below; the general "new contact" workflow firing too
      // would add a second, generic duplicate case alongside it.
      const res = await psri.addContact(contactPayload, { skipWorkflow: true });
      if (!res?.id) throw new Error(res?.error || 'Could not auto-create contact');
      const casePayload = {
        contactId: res.id, contactName: 'Not Disclosed', contactMobile: toPhone,
        channel: 'Call', calledNumber: toPhone, callTxnId: callId,
        typeOfCall: kind === 'missed-call' ? 'Abandoned Call' : 'Inbound',
        callFor: kind === 'missed-call' ? 'Unable to Connect' : 'Inaudible or Call Disconnected',
        status: 'Resolved',
        summary: kind === 'missed-call' ? 'Missed call No Answer' : 'Called back but not answered by the customer',
        assignedTo: currentAgentId,
        isAppointment: false,
      };
      const caseRes = await psri.addCase(casePayload);
      if (!caseRes?.id) throw new Error(caseRes?.error || 'Could not auto-create case');
      psri.runCaseWorkflows({ ...casePayload, id: caseRes.id });
    };

    (async () => {
      try {
        // Always check for an existing contact first — whether answered,
        // undetermined, or not-answered-but-already-a-known-number, the
        // agent should land on the real contact if one exists, not get
        // forced into Quick Add. Auto-log is the one specific case that
        // skips straight past this: confirmed not-answered AND no contact.
        const res = await psri.getContacts(toPhone).catch(() => ({ contacts: [] }));
        const existing = (res.contacts || [])[0] || null;

        if (answered === false && !existing) {
          await autoLog();
        } else {
          navigateManual(existing);
        }
      } catch (err) {
        // Auto-log failed for some reason (network, validation...) — never
        // let a failure here just vanish the call; fall back to the normal
        // manual flow so the agent still sees and can handle it.
        console.warn('[auto-log] failed, falling back to manual entry:', err.message);
        if (!cancelled) navigateManual(null);
      } finally {
        if (kind === 'inbound-redial') clearInboundNoContact(toPhone);
        clearTrackedOutcome();
      }
    })();

    return () => { cancelled = true; };
  }, [trackedOutcome]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasWidget || !callState || callState.origin === 'prospect') return null;

  const buildPrefill = (repeatFrom) => ({
    contact:      contact ? { id: contact.id, name: contact.name, mobile: contact.mobile, mobileIsd: contact.mobileIsd || '+91', contactType: contact.contactType, source: contact.source, subSource: contact.subSource, created: contact.created } : null,
    prefillMobile: !contact ? phone : undefined,
    channel:      'Call',
    typeOfCall:   callState.direction === 'inbound' ? 'Inbound' : 'Outbound',
    callTxnId:    callState.callId || '',
    calledNumber: callState.phone || phone || '',
    repeatFrom:   repeatFrom || undefined,
  });

  const goToCases = (prefill) => {
    setDialerPrefill(prefill);
    navigate('/psri/cases');
  };

  return (
    <div className="stg-dialer-panel">
      <div className="stg-dialer-header">
        <div className="stg-dialer-direction">
          <span className={`stg-call-badge ${callState.direction === 'inbound' ? 'stg-call-badge--in' : 'stg-call-badge--out'}`}>
            {callState.direction === 'inbound' ? '↙ Incoming' : '↗ Outgoing'}
          </span>
          {callState.ended && <span className="stg-call-ended-badge">Call Ended</span>}
        </div>
        <button className="stg-dialer-close" onClick={dismissCall} title="Dismiss">&#10005;</button>
      </div>

      <div className="stg-dialer-phone">{callState.phone || 'Unknown Number'}</div>
      {callState.name && <div className="stg-dialer-caller-name">{callState.name}</div>}

      {searching && <p className="stg-hint">Searching contact&hellip;</p>}

      {!searching && contact && (
        <div className="stg-contact-found">
          <div className="stg-contact-row">
            <div className="stg-contact-avatar">
              {(contact.name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}
            </div>
            <div>
              <div className="stg-contact-name">{contact.salutation} {contact.name}</div>
              <div className="stg-contact-mobile">{contact.mobile}</div>
            </div>
          </div>
          <div className="stg-dialer-actions">
            <button className="stg-btn-primary" onClick={() => goToCases(buildPrefill())}>+ New Case</button>
          </div>

          {recentCases.length > 0 && (
            <div className="stg-recent-cases">
              <div className="stg-recent-title">Recent Cases</div>
              {recentCases.map(c => (
                <div key={c.id} className="stg-recent-case">
                  <div className="stg-recent-case-top">
                    <span className="stg-badge">{c.callFor || c.typeOfCall || '—'}</span>
                    <span className="stg-recent-date">
                      {c.created ? new Date(c.created).toLocaleDateString('en-IN') : ''}
                    </span>
                  </div>
                  <p className="stg-recent-summary">{c.summary || '(no summary)'}</p>
                  <button className="stg-btn-ghost" onClick={() => goToCases(buildPrefill(c))}>
                    Repeat with New Enquiry
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searching && matches.length > 1 && (
        <div className="stg-no-contact">
          <p className="stg-hint">{matches.length} contacts share this number — which one is this?</p>
          {matches.map(m => (
            <div key={m.id} className="stg-contact-row" style={{ cursor: 'pointer', padding: '6px 0' }} onClick={() => pickMatch(m)}>
              <div className="stg-contact-avatar">
                {(m.name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')}
              </div>
              <div>
                <div className="stg-contact-name">{m.salutation} {m.name}</div>
                <div className="stg-contact-mobile">
                  {m.mobile === phone ? m.mobile : m.altMobile === phone ? `${m.altMobile} (alt)` : m.altMobile2 === phone ? `${m.altMobile2} (alt 2)` : m.landline === phone ? `${m.landline} (landline)` : m.mobile}
                </div>
              </div>
            </div>
          ))}
          <div className="stg-dialer-actions">
            <button className="stg-btn-ghost" onClick={goToCasesForNotFound}>None of these — Add New Contact</button>
          </div>
        </div>
      )}

      {!searching && noContact && (
        <div className="stg-no-contact">
          <p className="stg-hint">No contact found for this number.</p>
          <div className="stg-dialer-actions">
            <button className="stg-btn-primary" onClick={() => goToCases(buildPrefill())}>
              Add Contact &amp; Create Case
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
