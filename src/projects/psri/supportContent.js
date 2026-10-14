// ── Support knowledge base ───────────────────────────────────────────────────
// Two layers, one source of truth. Nothing here is rendered anywhere else — the
// Support page is just the assistant, so this file is the only copy of the
// wording it answers with.
//
//   TUTORIAL  — numbered "how do I…" jobs
//   REFERENCE — explanations of what things mean (statuses, fields, roles,
//               rules, troubleshooting)
//
// The assistant searches both, so it can answer any question about the CRM
// rather than only the step-by-step jobs.

export const TUTORIAL = [
  {
    key: 'create-case',
    label: 'Create a case',
    icon: '🗂️',
    who: 'Everyone',
    summary: 'One case = one call. This is the main thing you do all day.',
    // No bare "summary" and no bare "call for": both collapse to a single very
    // common word once stopwords are dropped, which drags unrelated questions
    // ("polish summary", "click to call") into this guide.
    keywords: ['case', 'create case', 'new case', 'add case', 'open a case', 'case form', 'case summary', 'write a summary', 'create', 'save case', 'make a case', 'enter a case'],
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
    keywords: ['incoming call', 'call is ringing', 'ringing', 'phone rang', 'call came', 'new caller', 'dialer', 'quick add', 'incoming', 'call received'],
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
    keywords: ['call back', 'callback', 'arrange a callback', 'arrange call back', 'call back arranged', 'callback date', 'callback time', 'callback completed', 'recall'],
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
    keywords: ['whatsapp', 'alert', 'send whatsapp', 'copy message', 'send in group', 'group', 'notification', 'qr code', 'qr', 'open on phone', 'phone', 'desk', 'message the desk'],
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
    keywords: ['contact', 'add contact', 'find contact', 'search contact', 'contact details', 'patient details', 'new contact', 'mobile number', 'caller details'],
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
    keywords: ['incomplete', 'incomplete case', 'pending case', 'finish a case', 'unfinished case', 'save as draft', 'draft', 'incomplete cases'],
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
    keywords: ['prospect', 'prospects', 'lead', 'leads', 'work a lead', 'call status', 'lead status', 'final status', 'next call', 'enquiry', 'follow up a lead'],
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
    keywords: ['assign', 'bulk assign', 'assign lead', 'assign leads', 'select first', 'round robin', 'give leads', 'reassign', 'who is working'],
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
    keywords: ['call log', 'call logs', 'recording', 'listen to call', 'play call', 'call history', 'duration', 'hear the call'],
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
    keywords: ['suggestion', 'suggest', 'suggestions', 'dropdown value', 'add option', 'picklist', 'propose value', 'correct value', 'new value', 'approve a suggestion'],
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
    keywords: ['export', 'download', 'csv', 'excel', 'spreadsheet', 'download data', 'high value report', 'report download', 'backup'],
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
    keywords: ['productivity', 'performance', 'agent performance', 'stats', 'numbers', 'how is the team doing', 'scoreboard', 'how many calls'],
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
    keywords: ['automation', 'automate', 'workflow', 'trigger', 'node', 'teams', 'send to teams', 'automation setup', 'rule', 'condition', 'action'],
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

// ── Reference: what things mean ──────────────────────────────────────────────
export const REFERENCE = [
  {
    key: 'ref-what-is-case',
    label: 'What a case is',
    icon: '🗂️',
    keywords: ['what is a case', 'case meaning', 'case definition', 'what does a case mean', 'case record', 'one case', 'what is a contact vs case'],
    lines: [
      'A **contact** is a person. A **case** is one interaction with them — usually one phone call.',
      'So the same person can have many cases, all gathered under one contact.',
      'A case holds who called, what they wanted (**Summary**), who owns it (**Assigned To**) and how it ended (**Status**).',
      'If an interaction did not have enough detail to be useful, it is saved as **Incomplete** instead.',
    ],
  },
  {
    key: 'ref-statuses',
    label: 'Status values',
    icon: '🚦',
    keywords: ['status', 'case status', 'what does resolved mean', 'incomplete status', 'open status', 'status difference', 'case states'],
    lines: [
      '**Resolved** — the call was handled and the case is finished. This is the normal end state.',
      '**Incomplete** — it was saved without the required detail, so it waits on the **Incomplete Cases** page.',
      '**Open** — used by automations that create a case before anyone has worked on it.',
      'Status is one of the **picklists**, so an admin can change which values exist.',
    ],
  },
  {
    key: 'ref-type-hierarchy',
    label: 'Type of Call vs Call For',
    icon: '🧭',
    keywords: ['type of call', 'call for list', 'call for meaning', 'type of call meaning', 'type of enquiry', 'type of enquiry meaning', 'difference between type of call and call for', 'field hierarchy', 'what is type of call'],
    lines: [
      'They narrow each other, in this order: **Type of Call → Call For → Type of Enquiry**.',
      '**Type of Call** is the broadest: Inbound, Outbound, Abandoned Call, and so on.',
      '**Call For** is what they called about: Appointment, Enquiry or Transfer, Complaint / Feedback, and others.',
      '**Type of Enquiry** is the detail under Call For — for example which billing type, or which doctor.',
      'Choosing one filters the next. **Call For** and **Summary** are the only required fields.',
    ],
  },
  {
    key: 'ref-repeat-rule',
    label: 'How a repeated query is detected',
    icon: '↻',
    keywords: ['repeat rule', 'how is repeat detected', 'repeat matching', 'when is something a repeat', 'repeat criteria', 'same query rule'],
    lines: [
      'A case counts as a **repeat** when all three match:',
      'the **same mobile number** (compared on the last 10 digits, so +91 and no prefix are the same person),',
      'the **same Call For**, and',
      'the **same concern text** (lower case, punctuation ignored — so "Testing" and "testing!" match).',
      'Two different people with the same words are deliberately **not** a repeat. Cases with no mobile or no summary cannot be matched.',
    ],
  },
  {
    key: 'ref-whatsapp-templates',
    label: 'The four WhatsApp notifications',
    icon: '💬',
    keywords: ['four templates', 'four notifications', 'four whatsapp notifications', 'notification types', 'whatsapp notifications', 'call back template', 'high value template', 'transplant template', 'complaint template', 'what triggers whatsapp', 'what triggers a whatsapp alert', 'template triggers'],
    lines: [
      '1. **Call Back** — fires when **Call Back Arranged** is ticked.',
      '2. **High Value Case** — fires when **High Value Case** is ticked and it is not a transplant.',
      '3. **Transplant Program** — fires when **High Value Case** is ticked and the procedure is a transplant.',
      '4. **Complaint / Feedback** — fires when **Call For** is a complaint.',
      'The same case can trigger more than one. Each notification is tracked separately under **✓ Copied**.',
    ],
  },
  {
    key: 'ref-copied',
    label: 'What Copied means',
    icon: '✓',
    keywords: ['copied list', 'what is copied', 'copied bucket', 'restore', 'clear list', 'copied meaning'],
    lines: [
      '**✓ Copied** is where a notification goes once you press **Copy message** or **Send in group**.',
      'It leaves **All**, so your queue only shows what is still waiting.',
      'It is remembered per person\'s browser (not shared), so two agents on different machines each keep their own list.',
      '**↺ Restore** puts one back. **Clear list** empties it.',
    ],
  },
  {
    key: 'ref-send-in-group',
    label: 'How Send in group works',
    icon: '📤',
    keywords: ['send in group', 'does it send automatically', 'who sends the message', 'paste the message', 'group button', 'automatically send'],
    lines: [
      'It is **assisted**, not automatic: it opens that desk\'s WhatsApp group in a new window and copies the message to your clipboard.',
      'You paste it into the group. Nothing is sent from the system on your behalf.',
      'Which desk it opens depends on the case — see the routing question below.',
    ],
  },
  {
    key: 'ref-group-routing',
    label: 'Which desk gets a group',
    icon: '🏷',
    keywords: ['which desk', 'group routing', 'who gets the alert', 'routing rules', 'front desk', 'billing desk', 'transplant coordination', 'patient relations', 'medical superintendent'],
    lines: [
      'A case can route to more than one desk, and each gets its own button.',
      '**Call Back** goes by enquiry: report/records → Report Desk, billing → Billing Desk, appointment → Appointment Desk, anything else → Front Desk.',
      '**High Value** goes by specialty: transplant, then Cardiac, Orthopaedics, Oncology or Neuro.',
      '**Complaint** always goes to Patient Relations, plus Medical Superintendent, Billing, Emergency or Hospital Operations depending on the complaint.',
      'Group links are set in **Settings → Picklists → "WhatsApp Groups"**, one line per desk: `Report Desk = https://chat.whatsapp.com/…`.',
    ],
  },
  {
    key: 'ref-roles',
    label: 'Roles and who sees what',
    icon: '🔐',
    keywords: ['role', 'roles', 'role difference', 'what is a role', 'agent vs admin', 'difference between agent and admin', 'agent and admin', 'who can see', 'permissions', 'agent role', 'admin role', 'super admin', 'access', 'tl', 'team leader', 'who is admin'],
    lines: [
      '**Agent** — their own work: cases, contacts, prospects assigned to them, and the WhatsApp list.',
      '**Admin (TL/Manager)** — additionally every prospect, **Productivity**, **Reports** and **Appreciation**.',
      '**Super Admin** — additionally **Settings** (Users, Picklists, Dependencies, Workflows).',
      'Settings sits at the very bottom of the rail, so you will not find it above Suggestions.',
    ],
  },
  {
    key: 'ref-picklists',
    label: 'Picklists and dependencies',
    icon: '📋',
    keywords: ['picklist', 'picklists', 'dropdown list', 'dependency', 'dependencies', 'why is dropdown empty', 'narrowed by', 'dependent dropdown', 'fallback list'],
    lines: [
      'Every dropdown in the CRM reads from a **picklist** that an admin maintains in **Settings → Picklists**.',
      '**Dependencies** decide which dropdown narrows which — for example Call For by Channel.',
      'If a dependency has no pairs yet, the dropdown falls back to the full list rather than showing empty.',
      'To change what a dropdown offers, edit the picklist — no code change, no redeploy.',
    ],
  },
  {
    key: 'ref-suggestions-flow',
    label: 'How suggestions are approved',
    icon: '🗳',
    keywords: ['who approves', 'approve suggestion', 'suggestion rejected', 'suggestion flow', 'suggestion status', 'who reviews'],
    lines: [
      'Anyone can propose a value under **Suggestions**.',
      'An admin approves or rejects it in the same place.',
      'Approved values are added to the picklist, so the dropdown gains the option immediately.',
      'You can check what happened to anything you sent — approved, rejected or corrected.',
    ],
  },
  {
    key: 'ref-prospect-life',
    label: 'The life of a prospect',
    icon: '🎯',
    keywords: ['what is a prospect', 'how are prospects created', 'auto convert', 'converted', 'when does a lead convert', 'prospect status', 'what is final status'],
    lines: [
      'A **prospect** is an enquiry that has not converted into a case yet.',
      '**Call Status** — what happened on the attempt. **Lead Status** — where the enquiry stands. **Final Status** — the outcome once it closes.',
      '**Next Call** sets the next follow-up date; **Attempts** counts how many times you have called.',
      'When the enquiry turns into real work it converts automatically and leaves the prospect list.',
      'Setting a **Lead Status** is what takes a lead out of **New** and out of **New assigned**.',
    ],
  },
  {
    key: 'ref-prospect-tabs',
    label: 'New vs New assigned vs Other',
    icon: '🗂',
    keywords: ['new tab', 'new assigned', 'other tab', 'prospect tabs', 'difference between new and other', 'what is new assigned'],
    lines: [
      '**New** — no Lead Status set, so nobody has worked it yet. This includes both unassigned and assigned leads.',
      '**New assigned** — the same untouched lead, but an agent already owns it. This is the queue that goes quiet.',
      '**Other** — a Lead Status is set, so work has started.',
      'The two overlap on purpose: a lead can be fresh **and** assigned. They will differ as soon as some new leads sit unassigned.',
    ],
  },
  {
    key: 'ref-workflows',
    label: 'How workflows run',
    icon: '🧭',
    keywords: ['when do workflows run', 'trigger types', 'case created', 'contact created', 'run history', 'dry run', 'test a workflow', 'why did a workflow not run', 'active workflow'],
    lines: [
      'A workflow is a small drawing: a **trigger**, **conditions** and **actions**.',
      'Triggers fire when a case or a contact is created. The CRM asks the server to run every **Active** workflow for that trigger.',
      'The server walks the graph: a condition either continues or diverts down its true/false branch.',
      'Actions can send an email, a WhatsApp message, or post to a webhook such as Microsoft Teams.',
      'Each run is logged per record, so you can see exactly what fired — and why. A dry run tests the shape without sending anything.',
      'A workflow never runs twice for the same record and trigger, so a retry is harmless.',
    ],
  },
  {
    key: 'ref-teams-alerts',
    label: 'Repeated query alerts to Teams',
    icon: '📣',
    keywords: ['teams alert', 'teams notification', 'repeated query alert', 'teams webhook', 'post to teams', 'power automate'],
    lines: [
      'The **+ Repeated query → Teams** template posts a card to a Teams channel whenever a case is created that repeats an earlier concern.',
      'The card shows the patient, mobile, Call For, which call it is of how many, the concern and the case ID.',
      'The webhook URL is set in `config.php` on the server (`teams.webhook_url`), not in the browser — it is a credential.',
      'If the URL is not set, the step is skipped, exactly like an alert with no WhatsApp number.',
    ],
  },
  {
    key: 'ref-guidance',
    label: 'Guidance tips',
    icon: '💡',
    keywords: ['guidance', 'tip', 'hints', 'guidance tip', 'help text on form', 'why this field'],
    lines: [
      'Small tips sit next to some form fields, written per Call For and sub-type.',
      'They are maintained in the same place as picklists, so the wording can be changed without a code change.',
      'The tip follows what you have selected — pick a Call For and the tip changes.',
    ],
  },
  {
    key: 'ref-summary-polish',
    label: 'Polishing the summary',
    icon: '✨',
    keywords: ['polish', 'improve summary', 'ai summary', 'rewrite summary', 'suggest a better summary', 'make summary better'],
    lines: [
      'The **Polish summary** button rewrites what you typed into clearer, more consistent wording.',
      'It uses AI, so check the result before saving — it is a starting point, not a final answer.',
      'Always paste the wording the patient actually used where it matters.',
    ],
  },
  {
    key: 'ref-appreciation-flow',
    label: 'Appreciation flow',
    icon: '🌟',
    keywords: ['appreciation flow', 'who approves appreciation', 'scoreboard', 'appreciation status', 'appreciation review'],
    lines: [
      'An agent ticks **Appreciation Received** on a case and writes what was said.',
      'It sits as pending until an admin reviews it under **Appreciation**.',
      'Approved entries count towards the scoreboard; rejected ones do not.',
    ],
  },
  {
    key: 'ref-dialer',
    label: 'The dialer and call system',
    icon: '📞',
    keywords: ['dialer', 'cti', 'sparktg', 'call system', 'phone system', 'click to call', 'call button', 'incoming call popup'],
    lines: [
      'The small floating controls make the CRM work with your phone system.',
      'An incoming call looks up the number and opens the matching case, or a quick-add form if the caller is new.',
      'The phone buttons on a contact or a case dial straight from the CRM.',
      'The floating controls hide on a phone, where the screen is too small for them.',
    ],
  },
  {
    key: 'ref-tariff-bot',
    label: 'The tariff bot',
    icon: '🤖',
    keywords: ['tariff bot', 'tariff', 'price', 'cost', 'charges', 'chat bot in corner', 'floating chat', 'bot'],
    lines: [
      'The **🤖** button in the corner is a tariff bot — it answers questions about prices and charges.',
      'It is separate from the support assistant on this page, which answers how-to questions about the CRM.',
      'Both are plain pages: the CRM does not host a WhatsApp chat any more.',
    ],
  },
  {
    key: 'ref-troubleshoot-save',
    label: 'The form will not save',
    icon: '⚠',
    keywords: ['cannot save', 'will not save', 'save button not working', 'error saving', 'why cant i save', 'required field', 'form error'],
    lines: [
      '**Call For** and **Summary** are required — the save button stays disabled until both are filled.',
      '**Summary** must be more than a couple of words, and **Call For** must be chosen from the list rather than typed.',
      'If **Type of Call** is set, **Call For** is filtered — an old value may no longer be valid, so pick it again.',
      'Pick a contact first; the form unlocks only once the case has someone attached to it.',
    ],
  },
  {
    key: 'ref-troubleshoot-duplicate',
    label: 'Duplicate contacts',
    icon: '👥',
    keywords: ['duplicate contact', 'same contact twice', 'blocked duplicate', 'contact already exists', 'duplicate blocked'],
    lines: [
      'A contact is blocked as a duplicate only when **both** the name and the mobile match an existing record exactly.',
      'A different spelling of the name, or a number in a different format, is treated as a new contact.',
      'If you really did create a duplicate, ask an admin to merge or delete it.',
    ],
  },
  {
    key: 'ref-troubleshoot-tab',
    label: 'A tab is missing',
    icon: '🔍',
    keywords: ['where is my tab', 'tab missing', 'cannot see settings', 'cannot see productivity', 'option not showing', 'not visible', 'permission denied'],
    lines: [
      'Each tab belongs to a role — **Productivity**, **Reports** and **Appreciation** need Admin; **Settings** needs Super Admin.',
      'Settings sits at the **bottom** of the rail, below Suggestions, not at the top.',
      'On the WhatsApp page the rail is hidden on a phone by design; turn the phone sideways or use a laptop.',
      'A browser zoomed right out can also push narrow controls off screen.',
    ],
  },
  {
    key: 'ref-troubleshoot-group',
    label: 'A WhatsApp group will not open',
    icon: '🔗',
    keywords: ['group will not open', 'link not set', 'no group', 'group not configured', 'invite link', 'chat whatsapp link'],
    lines: [
      'A desk with no group link shows **"Group for this notification is not set up yet"** instead of a button.',
      'Links are set by an admin in **Settings → Picklists → "WhatsApp Groups"**, one line per desk.',
      'Format: `Report Desk = https://chat.whatsapp.com/…` — `:` works instead of `=`, and a bare URL is accepted.',
      'If the page opens but the popup is blocked, allow popups for this site and press the button again.',
    ],
  },
  {
    key: 'ref-signin',
    label: 'Signing in',
    icon: '🔐',
    keywords: ['sign in', 'login', 'log in', 'password', 'cannot sign in', 'account', 'microsoft account', 'logged out', 'sign out'],
    lines: [
      'There is no CRM password — sign in with your PSRI **Microsoft** account.',
      'If you were signed in and something looks empty, sign out and back in.',
      'On a phone you get the same account prompt, so use the same account as the office.',
      'Your role decides what you see; if a tab is missing, check your role with an admin.',
    ],
  },
  {
    key: 'ref-privacy',
    label: 'Patient data and sharing',
    icon: '🔒',
    keywords: ['privacy', 'patient data', 'can i share', 'data security', 'confidential', 'who can see my cases', 'access to data'],
    lines: [
      'Agents see their own work; admins see every prospect; super admins see the settings.',
      'Do not send patient details over WhatsApp groups beyond what the alert template already includes — name, number and concern.',
      'Exports contain real patient data — download them only when a report is actually needed.',
      'Tokens, webhook URLs and server settings never live in the browser; they are kept in the server configuration.',
    ],
  },
];

// ── Matching ─────────────────────────────────────────────────────────────────

/** Lower case, drop punctuation, collapse whitespace. */
function norm(v) {
  return String(v || '')
    .toLowerCase()
    // Apostrophes are dropped, not spaced: "can't" must stay one word. Replacing
    // them like other punctuation would split it into "can t", which then
    // matches no keyword — and Windows/phones type "’" where keyboards give "'".
    .replace(/['’ʼ`]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'how', 'do', 'i', 'to', 'the', 'a', 'an', 'is', 'can', 'you', 'me', 'my',
  'what', 'where', 'when', 'why', 'which', 'for', 'in', 'on', 'of', 'and', 'please', 'help',
  'this', 'that', 'it', 'with', 'from', 'was', 'be', 'do', 'does', 'tell', 'explain',
]);

/** Words that actually carry meaning — stopwords are dropped from both sides. */
function contentWords(v) {
  return norm(v).split(' ').filter(w => w && !STOP.has(w));
}

/** Word present, tolerating a plural "s". */
function hasWord(haystack, w) {
  return haystack.includes(` ${w} `) || haystack.includes(` ${w}s `);
}

/** Levenshtein distance, bailing out once it passes `max`. */
function editDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Does this keyword match the question allowing one typo per word?
 *
 * People type "whtsapp" and "asign leads". Only words of 4+ characters are
 * compared, so short words cannot fuzzy-match into something they aren't.
 */
function fuzzyMatches(qWords, kwWords) {
  return kwWords.every(kw => {
    if (qWords.some(q => q === kw || q === `${kw}s` || q === kw.replace(/s$/, ''))) return true;
    if (kw.length < 4) return false;
    return qWords.some(q => q.length >= 4 && editDistance(q, kw, 1) <= 1);
  });
}

/** Everything the assistant can answer from. */
export const TOPICS = [
  ...TUTORIAL.map(t => ({ ...t, kind: 'howto' })),
  ...REFERENCE.map(r => ({ ...r, kind: 'reference' })),
];

// A question that opens with a verb is asking for the job to be done, even
// without the word "how" — "work a prospect", "log an appreciation".
const ACTION_VERBS = new Set([
  'work', 'create', 'make', 'send', 'add', 'assign', 'open', 'set', 'check', 'download',
  'log', 'fill', 'arrange', 'record', 'look', 'find', 'export', 'take', 'finish',
  'manage', 'build', 'suggest', 'get', 'show', 'view', 'save', 'start', 'stop',
  'close', 'copy', 'play', 'review', 'approve', 'reject', 'update', 'edit', 'print',
  'share', 'mark', 'tick', 'select', 'choose', 'search', 'press', 'click', 'report',
]);

/**
 * What kind of question is this?
 *
 * "what is a case" wants the explanation; "how do I create a case" — or just
 * "work a prospect" — wants the steps. Without this, both score on the same
 * keyword and it comes down to which entry happens to be listed first — which is
 * how "what is a case" ends up answering with the create-a-case steps.
 */
function intentOf(question) {
  const q = norm(question);

  // "how do / how to" wins outright. "Why do I create a case?" contains "why",
  // but it is plainly a request for the steps, not a definition.
  if (/\b(how do|how to|how can|how would|how shall|steps? to|show me how)\b/.test(q)) return 'how';

  // Otherwise a leading question word means they want the explanation.
  if (/\b(what is|what are|what does|whats the|what was|which|who|why is|why does|why can|why cant|why can t|where is|where do|when is|meaning|means|explain|difference between|tell me about|does it|do it|is it|automatically|manually|by itself)\b/.test(q)) return 'def';

  // No question word, but a verb up front is still a request to do something:
  // "work a prospect", "log an appreciation".
  const first = contentWords(question)[0];
  if (first && ACTION_VERBS.has(first)) return 'how';

  return 'any';
}

/** Bonus applied to a topic of the kind the question is asking for. */
function kindWeight(intent, kind) {
  if (intent === 'def') return kind === 'reference' ? 2.5 : 0.5;
  if (intent === 'how') return kind === 'howto' ? 2.5 : 0.5;
  return 1;
}

/**
 * Finds the topic a question is about.
 *
 * Scores every topic by which of its keywords appear in the question, weighted by
 * keyword length so "create case" beats a bare "case". A multi-word keyword also
 * matches when its words are all present but scattered ("called about the same
 * thing twice" hits "called twice"), at a slightly lower score than an exact
 * phrase. The question's intent then favours either the guides or the reference
 * notes, and ties go to whichever matched more keywords — with an explanation as
 * the final tiebreak, since that is the safer answer for a bare noun.
 *
 * Returns null when nothing matches, so the caller can say so honestly rather
 * than guess.
 */
export function findTopic(question) {
  const words = contentWords(question);
  if (words.length === 0) return null;
  const haystack = ` ${words.join(' ')} `;
  const intent = intentOf(question);

  let best = null;
  for (const topic of TOPICS) {
    let score = 0;
    const matched = [];
    for (const kw of topic.keywords) {
      const kwWords = contentWords(kw);
      if (kwWords.length === 0) continue;

      const phrase = ` ${kwWords.join(' ')} `;
      if (haystack.includes(phrase)) {
        score += kwWords.length;
        matched.push(kw);
      } else if (kwWords.length > 1 && kwWords.every(w => hasWord(haystack, w))) {
        score += kwWords.length * 0.75;
        matched.push(kw);
      } else if (fuzzyMatches(words, kwWords)) {
        // One typo per word, and scored below a real match so an exact hit
        // always wins.
        score += kwWords.length * 0.6;
        matched.push(kw);
      }
    }
    if (score === 0) continue;

    const weighted = score * kindWeight(intent, topic.kind);
    const better = !best
      || weighted > best.weighted
      || (weighted === best.weighted && matched.length > best.matched.length)
      || (weighted === best.weighted && matched.length === best.matched.length && topic.kind === 'reference');
    if (better) best = { entry: topic, kind: topic.kind, score, weighted, matched };
  }
  return best;
}

/** Quick prompts offered before the user has typed anything. */
export const SUGGESTIONS = [
  'How do I create a case?',
  'How do I send a WhatsApp alert?',
  'Someone called about the same thing twice',
  'What does Resolved mean?',
  'Which desk gets the alert?',
  'Why can’t I save the form?',
  'How do I assign leads?',
  'Who can see the Settings tab?',
];