// ── Support content ──────────────────────────────────────────────────────────
// The jobs staff ask about, in the order they do them. `steps` is the guide
// itself; `keywords` are what the assistant listens for, so the bot answers from
// the same text the page shows and can never drift from it.

export const TUTORIAL = [
  {
    key: 'create-case',
    label: 'Create a case',
    icon: '🗂️',
    who: 'Everyone',
    summary: 'One case = one call. This is the main thing you do all day.',
    // Deliberately no "log a call" here: that collides with Call Logs, which is a
// different screen, and "call for" collapses to a bare "call" once stopwords
// are dropped — either would drag unrelated questions in here.
keywords: ['case', 'create case', 'new case', 'add case', 'open a case', 'case form', 'summary', 'create', 'save case'],
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
    keywords: ['incoming call', 'call is ringing', 'ringing', 'phone rang', 'call came', 'new caller', 'dialer', 'quick add', 'incoming'],
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
    keywords: ['call back', 'callback', 'arrange a callback', 'arrange call back', 'call back arranged', 'callback date', 'call back time', 'recall'],
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
    keywords: ['whatsapp', 'alert', 'send whatsapp', 'copy message', 'send in group', 'group', 'notification', 'qr code', 'qr', 'open on phone', 'phone', 'desk'],
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
    keywords: ['repeated', 'repeat', 'repeated query', 'repeat query', 'duplicate query', 'same query', 'called again', 'called twice', 'twice', 'same thing', 'same issue', 'more than once', 'multiple times', 'same problem', 'repeated call', 'keeps calling', 'keep calling', 'calling again'],
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
    keywords: ['contact', 'add contact', 'find contact', 'search contact', 'contact details', 'patient details', 'new contact', 'mobile number'],
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
    keywords: ['incomplete', 'incomplete case', 'pending case', 'finish a case', 'unfinished case', 'save as draft', 'draft'],
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
    keywords: ['prospect', 'prospects', 'lead', 'leads', 'work a lead', 'call status', 'lead status', 'final status', 'next call', 'enquiry'],
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
    keywords: ['assign', 'bulk assign', 'assign lead', 'assign leads', 'select first', 'round robin', 'give leads', 'reassign'],
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
    keywords: ['call log', 'call logs', 'recording', 'listen to call', 'play call', 'call history', 'duration'],
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
    keywords: ['appreciation', 'compliment', 'praise', 'praised', 'praising', 'commend', 'thanked', 'thank', 'feedback about hospital', 'approve appreciation', 'award', 'positive feedback', 'said nice things'],
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
    keywords: ['suggestion', 'suggest', 'suggestions', 'dropdown value', 'add option', 'picklist', 'propose value', 'correct value', 'new value'],
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
    keywords: ['export', 'download', 'csv', 'excel', 'spreadsheet', 'download data', 'high value report', 'report download'],
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
    keywords: ['productivity', 'performance', 'agent performance', 'stats', 'numbers', 'how is the team doing', 'scoreboard'],
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
    keywords: ['automation', 'automate', 'workflow', 'trigger', 'node', 'teams', 'send to teams', 'automation setup', 'rule'],
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
    keywords: ['settings', 'user', 'users', 'add user', 'role', 'permission', 'who can see', 'admin', 'dropdown list', 'dependency', 'dependencies'],
    steps: [
      '**Settings → Users** — add people and set their role.',
      '**Settings → Picklists** — the values behind every dropdown, including the WhatsApp group links.',
      '**Settings → Dependencies** — which dropdown narrows which, for example Call For by Channel.',
    ],
  },
];

// ── Matching ─────────────────────────────────────────────────────────────────

/** Lower case, drop punctuation, collapse whitespace. */
function norm(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'how', 'do', 'i', 'to', 'the', 'a', 'an', 'is', 'can', 'you', 'me', 'my',
  'what', 'where', 'when', 'why', 'which', 'for', 'in', 'on', 'of', 'and', 'please', 'help',
  'this', 'that', 'it', 'with', 'from', 'was', 'be', 'do', 'does',
]);

/** Words that actually carry meaning — stopwords are dropped from both sides. */
function contentWords(v) {
  return norm(v).split(' ').filter(w => w && !STOP.has(w));
}

/** Word present, tolerating a plural "s". */
function hasWord(haystack, w) {
  return haystack.includes(` ${w} `) || haystack.includes(` ${w}s `);
}

/**
 * Finds the job a question is about.
 *
 * Scores every job by which of its keywords appear in the question, weighted by
 * keyword length so "create case" beats a bare "case". A multi-word keyword also
 * matches when its words are all present but scattered ("called about the same
 * thing twice" hits "called twice"), at a slightly lower score than an exact
 * phrase. Returns null when nothing matches, so the caller can say so honestly
 * rather than guess.
 */
export function findTopic(question) {
  const words = contentWords(question);
  if (words.length === 0) return null;
  const haystack = ` ${words.join(' ')} `;

  let best = null;
  for (const entry of TUTORIAL) {
    let score = 0;
    const matched = [];
    for (const kw of entry.keywords) {
      const kwWords = contentWords(kw);
      if (kwWords.length === 0) continue;

      const phrase = ` ${kwWords.join(' ')} `;
      if (haystack.includes(phrase)) {
        score += kwWords.length;
        matched.push(kw);
      } else if (kwWords.length > 1 && kwWords.every(w => hasWord(haystack, w))) {
        score += kwWords.length * 0.75;
        matched.push(kw);
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score, matched };
    }
  }
  return best;
}

/** Quick prompts offered before the user has typed anything. */
export const SUGGESTIONS = [
  'How do I create a case?',
  'How do I send a WhatsApp alert?',
  'Someone called about the same thing twice',
  'How do I assign leads?',
  'How do I download the data?',
];