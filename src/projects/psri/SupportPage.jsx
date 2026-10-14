import { useCallback, useEffect, useRef, useState } from 'react';

// ── Tutorial content ─────────────────────────────────────────────────────────
// Written as the things staff actually come here to do, in the order they do
// them — not one entry per screen. `who` says who can carry it out; `steps` is
// the job itself.
const TUTORIAL = [
  {
    key: 'create-case',
    label: 'Create a case',
    icon: '🗂️',
    who: 'Everyone',
    summary: 'One case = one call. This is the main thing you do all day.',
    steps: [
      'Press **+ New Case** at the top of the Cases page.',
      'Pick an existing contact from the list, or **+ New Contact** if the person is new.',
      'Choose **Type of Call** — this narrows the **Call For** list.',
      'Choose **Call For**, then pick **Type of Enquiry** and type the **Summary** in the patient\'s own words. These two are required — the form will not save without them.',
      'Set **Status** (Resolved or Incomplete), pick the specialty and doctor if it is a query about one, and save.',
      'Press **Create Case**. Saving again on the same case is **Save Changes**.',
    ],
  },
  {
    key: 'incoming-call',
    label: 'Take an incoming call',
    icon: '📞',
    who: 'Everyone',
    steps: [
      'When the phone rings, the dialer opens the matching case by itself if the number is already known.',
      'If the caller is new, a quick-add form opens — add them and carry on.',
      'Add the **Summary** while they are still on the line, then save.',
    ],
  },
  {
    key: 'callback',
    label: 'Arrange a call back',
    icon: '⏰',
    who: 'Everyone',
    steps: [
      'Open the case.',
      'Tick **Call Back Arranged** and set the date and time when you will call back.',
      'The case now raises the **1 Call Back** notification on the WhatsApp page for the desk the guest was trying to reach.',
    ],
  },
  {
    key: 'whatsapp-alert',
    label: 'Send a WhatsApp alert',
    icon: '💬',
    who: 'Everyone',
    steps: [
      'Open **WhatsApp** in the left rail — every case that needs a message is listed under its notification type.',
      'Press **Copy message**. The wording goes to your clipboard and the notification moves to **✓ Copied**.',
      'Press **Send in group**. The desk\'s WhatsApp group opens in a new window with the message ready to paste.',
      'Use the chips to filter by notification, or search by patient name, mobile or concern.',
      'Press **📱 Open on phone** to scan a QR code and work the same list on a phone.',
    ],
  },
  {
    key: 'repeat-query',
    label: 'Check for repeated queries',
    icon: '↻',
    who: 'Everyone',
    steps: [
      'Look for the amber **↻ Call N of M about this** badge on any notification — it means this person has asked this before.',
      'Open the **↻ Repeated query** tab for the full list, busiest query first, with every call dated.',
      'It counts as a repeat when the same mobile, the same **Call For** and the same concern text match.',
    ],
  },
  {
    key: 'contacts',
    label: 'Find or add a contact',
    icon: '👤',
    who: 'Everyone',
    steps: [
      'Search by name or mobile in the box at the top of **Contacts**.',
      'Press **+ New Contact** to add someone by hand.',
      'Open a contact to see every case and call they have, on the right.',
    ],
  },
  {
    key: 'incomplete-case',
    label: 'Finish an incomplete case',
    icon: '📝',
    who: 'Everyone',
    steps: [
      'Open **Incomplete Cases** in the left rail.',
      'Open the case and fill in what is missing — usually the **Summary** or **Call For**.',
      'Save it with **Create Case** and it moves into the main Cases list.',
    ],
  },
  {
    key: 'prospect',
    label: 'Work a prospect',
    icon: '🎯',
    who: 'Everyone (admins see every lead)',
    steps: [
      'Open **Prospects**. **New** = nobody has touched it, **New assigned** = already owned but not started, **Other** = in progress.',
      'Narrow the list with the date filter — created, first call, last call or next call — plus Today / 7 days / 30 days.',
      'Open a lead, record what happened: **Call Status**, **Lead Status**, **Final Status**, the next call date and any remarks.',
      'Press **Save**. Whoever saves becomes the owner, so the lead shows as being worked on.',
    ],
  },
  {
    key: 'assign-lead',
    label: 'Assign leads in bulk',
    icon: '👥',
    who: 'Admin, Super Admin',
    steps: [
      'On **Prospects**, choose the **New** or **New assigned** tab.',
      'Tick the leads, or type a number in **Select first N** to take the top of the list.',
      'Choose the agent in the dropdown and press **Assign**.',
    ],
  },
  {
    key: 'call-log',
    label: 'Look up a call',
    icon: '☎️',
    who: 'Everyone',
    steps: [
      'Open **Call Logs** and search by mobile or number.',
      'Press play on a row to hear the recording, with the duration and outcome beside it.',
    ],
  },
  {
    key: 'appreciation',
    label: 'Log an appreciation',
    icon: '🌟',
    who: 'Everyone to raise, Admin to approve',
    steps: [
      'On a case, tick **Appreciation Received** and write what was said.',
      'An admin opens **Appreciation** in the left rail, reads it and approves or rejects.',
      'Approved entries count towards the scoreboard.',
    ],
  },
  {
    key: 'suggestion',
    label: 'Suggest a dropdown value',
    icon: '📋',
    who: 'Everyone',
    steps: [
      'Open **Suggestions** in the left rail.',
      'Say what the value should be and which list it belongs to — a new dropdown option, or a correction to an existing one.',
      'An admin approves or rejects it. You can check what happened to anything you sent.',
    ],
  },
  {
    key: 'export',
    label: 'Download the data',
    icon: '🧾',
    who: 'Admin, Super Admin',
    steps: [
      'Open **Reports** in the left rail.',
      'Choose contacts, cases or high-value cases and the from/to dates.',
      'Press export and the CSV opens in Excel.',
    ],
  },
  {
    key: 'productivity',
    label: 'Check productivity',
    icon: '📊',
    who: 'Admin, Super Admin',
    steps: [
      'Open **Productivity** and pick the date range.',
      'Compare the agents, then open one to see their detail.',
    ],
  },
  {
    key: 'automation',
    label: 'Set up an automation',
    icon: '🧭',
    who: 'Super Admin',
    steps: [
      'Open **Settings → Workflows**, then start from a template — for example **+ Case WhatsApp Alerts** or **+ Repeated query → Teams**.',
      'Add nodes: **conditions** decide which branch runs, **actions** do the work (send an email, a WhatsApp alert, a Teams message).',
      'Save, then set the workflow **Active**. Every run is logged per record so you can see what fired.',
    ],
  },
  {
    key: 'admin-setup',
    label: 'Manage users and lists',
    icon: '⚙',
    who: 'Super Admin',
    steps: [
      '**Settings → Users** — add people and set their role.',
      '**Settings → Picklists** — the values behind every dropdown, including the WhatsApp group links.',
      '**Settings → Dependencies** — which dropdown narrows which, for example Call For by Channel.',
    ],
  },
];

// Clicking a bar entry scrolls its section into view; the bar is sticky so it is
// always reachable while reading.
export default function SupportPage() {
  const [active, setActive] = useState(TUTORIAL[0].key);
  const barRef = useRef(null);
  const sectionRefs = useRef({});

  const scrollTo = useCallback((key) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(key);
    // Keep the chosen chip visible in a bar that has to scroll.
    const chip = barRef.current?.querySelector(`[data-key="${key}"]`);
    if (chip && barRef.current) {
      barRef.current.scrollTo({
        left: chip.offsetLeft - barRef.current.clientWidth / 2 + chip.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, []);

  // Highlight whichever section is in view, so scrolling reads as well as
  // clicking. Measured against the viewport rather than offsetTop, because
  // .psri-page is position:relative — offsetTop would be measured from it, not
  // from the document.
  //
  // The listener is registered in the capture phase on purpose: in the app the
  // panel that scrolls is .ucrm-main (overflow-y:auto), not the window, and a
  // scroll event does not bubble — a plain window listener would never fire and
  // the bar would freeze on whatever was last clicked.
  useEffect(() => {
    const onScroll = () => {
      const line = 140; // just under the sticky bar
      let current = TUTORIAL[0].key;
      for (const t of TUTORIAL) {
        const el = sectionRefs.current[t.key];
        if (el && el.getBoundingClientRect().top <= line) current = t.key;
      }
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, true);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">Support</h1>
          <p className="psri-subtitle">
            How to do each job in the CRM, step by step. Pick one from the bar.
          </p>
        </div>
      </div>

      {/* The tutorial bar — one chip per job. */}
      <nav className="psri-tutorial-bar" ref={barRef} aria-label="How-to guides">
        {TUTORIAL.map((t, i) => (
          <button
            key={t.key}
            type="button"
            data-key={t.key}
            className={`psri-tut-chip${active === t.key ? ' active' : ''}`}
            onClick={() => scrollTo(t.key)}
            aria-current={active === t.key ? 'true' : undefined}
          >
            <span className="psri-tut-chip-n">{i + 1}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="psri-tut-list">
        {TUTORIAL.map((t, i) => (
          <section
            key={t.key}
            className={`psri-tut${active === t.key ? ' active' : ''}`}
            ref={(el) => { sectionRefs.current[t.key] = el; }}
          >
            <div className="psri-tut-head">
              <span className="psri-tut-icon">{t.icon}</span>
              <h2 className="psri-tut-h">{i + 1}. {t.label}</h2>
              <span className="psri-tut-who">{t.who}</span>
            </div>
            {t.summary && <p className="psri-tut-what">{t.summary}</p>}
            <ol className="psri-tut-steps">
              {t.steps.map((s, n) => (
                // Index is the identity here — the steps are static content.
                <li key={n}>
                  <span className="psri-tut-n">{n + 1}</span>
                  <span className="psri-tut-step">{bold(s)}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

// Steps are written with **bold** for button and field names. Only that marker
// is turned into markup and the text is rendered as text, so a step can never
// inject HTML.
function bold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ));
}