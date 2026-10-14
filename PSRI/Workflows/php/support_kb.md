<!-- GENERATED from src/projects/psri/supportContent.js by scripts/build-support-kb.mjs — do not edit by hand. -->

# How-to guides

## Create a case (Everyone)
One case = one call. This is the main thing you do all day.
1. Press **+ New Case** at the top of the Cases page.
2. Pick an existing contact from the list, or **+ New Contact** if the person is new.
3. Choose **Type of Call** — this narrows the **Call For** list.
4. Choose **Call For**, then pick **Type of Enquiry** and type the **Summary** in the patient's own words. These two are required — the form will not save without them.
5. Set **Status** (Resolved or Incomplete), pick the specialty and doctor if it is a query about one, and save.
6. Press **Create Case**. Saving again on the same case is **Save Changes**.

## Take an incoming call (Everyone)
1. When the phone rings, the dialer opens the matching case by itself if the number is already known.
2. If the caller is new, a quick-add form opens — add them and carry on.
3. Add the **Summary** while they are still on the line, then save.

## Arrange a call back (Everyone)
1. Open the case.
2. Tick **Call Back Arranged** and set the date and time when you will call back.
3. The case now raises the **1 Call Back** notification on the WhatsApp page for the desk the guest was trying to reach.

## Send a WhatsApp alert (Admin, Super Admin)
1. Open **WhatsApp** in the left rail — every case that needs a message is listed under its notification type.
2. Press **Copy message**. The wording goes to your clipboard and the notification moves to **✓ Copied**.
3. Press **Send in group**. The desk's WhatsApp group opens in a new window with the message ready to paste.
4. Use the chips to filter by notification, or search by patient name, mobile or concern.
5. Press **📱 Open on phone** to scan a QR code and work the same list on a phone.

## Check for repeated queries (Everyone)
1. Look for the amber **↻ Call N of M about this** badge on any notification — it means this person has asked this before.
2. Open the **↻ Repeated query** tab for the full list, busiest query first, with every call dated.
3. It counts as a repeat when the same mobile, the same **Call For** and the same concern text match.

## Find or add a contact (Everyone)
1. Search by name or mobile in the box at the top of **Contacts**.
2. Press **+ New Contact** to add someone by hand.
3. Open a contact to see every case and call they have, on the right.

## Finish an incomplete case (Everyone)
1. Open **Incomplete Cases** in the left rail.
2. Open the case and fill in what is missing — usually the **Summary** or **Call For**.
3. Save it with **Create Case** and it moves into the main Cases list.

## Work a prospect (Everyone (admins see every lead))
1. Open **Prospects**. **New** = nobody has touched it, **New assigned** = already owned but not started, **Other** = in progress.
2. Narrow the list with the date filter — created, first call, last call or next call — plus Today / 7 days / 30 days.
3. Open a lead, record what happened: **Call Status**, **Lead Status**, **Final Status**, the next call date and any remarks.
4. Press **Save**. Whoever saves becomes the owner, so the lead shows as being worked on.

## Assign leads in bulk (Admin, Super Admin)
1. On **Prospects**, choose the **New** or **New assigned** tab.
2. Tick the leads, or type a number in **Select first N** to take the top of the list.
3. Choose the agent in the dropdown and press **Assign**.

## Look up a call (Everyone)
1. Open **Call Logs** and search by mobile or number.
2. Press play on a row to hear the recording, with the duration and outcome beside it.

## Log an appreciation (Everyone to raise, Admin to approve)
1. On a case, tick **Appreciation Received** and write what was said.
2. An admin opens **Appreciation** in the left rail, reads it and approves or rejects.
3. Approved entries count towards the scoreboard.

## Suggest a dropdown value (Everyone)
1. Open **Suggestions** in the left rail.
2. Say what the value should be and which list it belongs to — a new dropdown option, or a correction to an existing one.
3. An admin approves or rejects it. You can check what happened to anything you sent.

## Download the data (Admin, Super Admin)
1. Open **Reports** in the left rail.
2. Choose contacts, cases or high-value cases and the from/to dates.
3. Press export and the CSV opens in Excel.

## Check productivity (Admin, Super Admin)
1. Open **Productivity** and pick the date range.
2. Compare the agents, then open one to see their detail.

## Set up an automation (Super Admin)
1. Open **Settings → Workflows**, then start from a template — for example **+ Case WhatsApp Alerts** or **+ Repeated query → Teams**.
2. Add nodes: **conditions** decide which branch runs, **actions** do the work (send an email, a WhatsApp alert, a Teams message).
3. Save, then set the workflow **Active**. Every run is logged per record so you can see what fired.

## Manage users and lists (Super Admin)
1. **Settings → Users** — add people and set their role.
2. **Settings → Picklists** — the values behind every dropdown, including the WhatsApp group links.
3. **Settings → Dependencies** — which dropdown narrows which, for example Call For by Channel.

# Reference

## What a case is
A **contact** is a person. A **case** is one interaction with them — usually one phone call.
So the same person can have many cases, all gathered under one contact.
A case holds who called, what they wanted (**Summary**), who owns it (**Assigned To**) and how it ended (**Status**).
If an interaction did not have enough detail to be useful, it is saved as **Incomplete** instead.

## Status values
**Resolved** — the call was handled and the case is finished. This is the normal end state.
**Incomplete** — it was saved without the required detail, so it waits on the **Incomplete Cases** page.
**Open** — used by automations that create a case before anyone has worked on it.
Status is one of the **picklists**, so an admin can change which values exist.

## Type of Call vs Call For
They narrow each other, in this order: **Type of Call → Call For → Type of Enquiry**.
**Type of Call** is the broadest: Inbound, Outbound, Abandoned Call, and so on.
**Call For** is what they called about: Appointment, Enquiry or Transfer, Complaint / Feedback, and others.
**Type of Enquiry** is the detail under Call For — for example which billing type, or which doctor.
Choosing one filters the next. **Call For** and **Summary** are the only required fields.

## How a repeated query is detected
A case counts as a **repeat** when all three match:
the **same mobile number** (compared on the last 10 digits, so +91 and no prefix are the same person),
the **same Call For**, and
the **same concern text** (lower case, punctuation ignored — so "Testing" and "testing!" match).
Two different people with the same words are deliberately **not** a repeat. Cases with no mobile or no summary cannot be matched.

## The four WhatsApp notifications
1. **Call Back** — fires when **Call Back Arranged** is ticked.
2. **High Value Case** — fires when **High Value Case** is ticked and it is not a transplant.
3. **Transplant Program** — fires when **High Value Case** is ticked and the procedure is a transplant.
4. **Complaint / Feedback** — fires when **Call For** is a complaint.
The same case can trigger more than one. Each notification is tracked separately under **✓ Copied**.

## What Copied means
**✓ Copied** is where a notification goes once you press **Copy message** or **Send in group**.
It leaves **All**, so your queue only shows what is still waiting.
It is remembered per person's browser (not shared), so two agents on different machines each keep their own list.
**↺ Restore** puts one back. **Clear list** empties it.

## How Send in group works
It is **assisted**, not automatic: it opens that desk's WhatsApp group in a new window and copies the message to your clipboard.
You paste it into the group. Nothing is sent from the system on your behalf.
Which desk it opens depends on the case — see the routing question below.

## Which desk gets a group
A case can route to more than one desk, and each gets its own button.
**Call Back** goes by enquiry: report/records → Report Desk, billing → Billing Desk, appointment → Appointment Desk, anything else → Front Desk.
**High Value** goes by specialty: transplant, then Cardiac, Orthopaedics, Oncology or Neuro.
**Complaint** always goes to Patient Relations, plus Medical Superintendent, Billing, Emergency or Hospital Operations depending on the complaint.
Group links are set in **Settings → Picklists → "WhatsApp Groups"**, one line per desk: `Report Desk = https://chat.whatsapp.com/…`.

## Roles and who sees what
**Agent** — their own work: cases, contacts, prospects assigned to them, **Suggestions** and **Appreciation** (the status of their own).
**Admin (TL/Manager)** — additionally every prospect, the **WhatsApp** list, **Productivity**, **Reports**, and approving **Appreciation** and **Suggestions**.
**Super Admin** — additionally **Settings** (Users, Picklists, Dependencies, Workflows).
Settings sits at the very bottom of the rail, so you will not find it above Suggestions.

## Picklists and dependencies
Every dropdown in the CRM reads from a **picklist** that an admin maintains in **Settings → Picklists**.
**Dependencies** decide which dropdown narrows which — for example Call For by Channel.
If a dependency has no pairs yet, the dropdown falls back to the full list rather than showing empty.
To change what a dropdown offers, edit the picklist — no code change, no redeploy.

## How suggestions are approved
Anyone can propose a value under **Suggestions**.
An admin approves or rejects it in the same place.
Approved values are added to the picklist, so the dropdown gains the option immediately.
You can check what happened to anything you sent — approved, rejected or corrected.

## The life of a prospect
A **prospect** is an enquiry that has not converted into a case yet.
**Call Status** — what happened on the attempt. **Lead Status** — where the enquiry stands. **Final Status** — the outcome once it closes.
**Next Call** sets the next follow-up date; **Attempts** counts how many times you have called.
When the enquiry turns into real work it converts automatically and leaves the prospect list.
Setting a **Lead Status** is what takes a lead out of **New** and out of **New assigned**.

## New vs New assigned vs Other
**New** — no Lead Status set, so nobody has worked it yet. This includes both unassigned and assigned leads.
**New assigned** — the same untouched lead, but an agent already owns it. This is the queue that goes quiet.
**Other** — a Lead Status is set, so work has started.
The two overlap on purpose: a lead can be fresh **and** assigned. They will differ as soon as some new leads sit unassigned.

## How workflows run
A workflow is a small drawing: a **trigger**, **conditions** and **actions**.
Triggers fire when a case or a contact is created. The CRM asks the server to run every **Active** workflow for that trigger.
The server walks the graph: a condition either continues or diverts down its true/false branch.
Actions can send an email, a WhatsApp message, or post to a webhook such as Microsoft Teams.
Each run is logged per record, so you can see exactly what fired — and why. A dry run tests the shape without sending anything.
A workflow never runs twice for the same record and trigger, so a retry is harmless.

## Repeated query alerts to Teams
The **+ Repeated query → Teams** template posts a card to a Teams channel whenever a case is created that repeats an earlier concern.
The card shows the patient, mobile, Call For, which call it is of how many, the concern and the case ID.
The webhook URL is set in `config.php` on the server (`teams.webhook_url`), not in the browser — it is a credential.
If the URL is not set, the step is skipped, exactly like an alert with no WhatsApp number.

## Guidance tips
Small tips sit next to some form fields, written per Call For and sub-type.
They are maintained in the same place as picklists, so the wording can be changed without a code change.
The tip follows what you have selected — pick a Call For and the tip changes.

## Polishing the summary
The **Polish summary** button rewrites what you typed into clearer, more consistent wording.
It uses AI, so check the result before saving — it is a starting point, not a final answer.
Always paste the wording the patient actually used where it matters.

## Appreciation flow
An agent ticks **Appreciation Received** on a case and writes what was said.
It sits as pending until an admin reviews it under **Appreciation**. Agents can open **Appreciation** too, to see the status of the ones on their own cases.
Approved entries count towards the scoreboard; rejected ones do not.

## The dialer and call system
The small floating controls make the CRM work with your phone system.
An incoming call looks up the number and opens the matching case, or a quick-add form if the caller is new.
The phone buttons on a contact or a case dial straight from the CRM.
The floating controls hide on a phone, where the screen is too small for them.

## The tariff bot
The **🤖** button in the corner is a tariff bot — it answers questions about prices and charges.
It is separate from the support assistant on this page, which answers how-to questions about the CRM.
Both are plain pages: the CRM does not host a WhatsApp chat any more.

## The form will not save
**Call For** and **Summary** are required — the save button stays disabled until both are filled.
**Summary** must be more than a couple of words, and **Call For** must be chosen from the list rather than typed.
If **Type of Call** is set, **Call For** is filtered — an old value may no longer be valid, so pick it again.
Pick a contact first; the form unlocks only once the case has someone attached to it.

## Duplicate contacts
A contact is blocked as a duplicate only when **both** the name and the mobile match an existing record exactly.
A different spelling of the name, or a number in a different format, is treated as a new contact.
If you really did create a duplicate, ask an admin to merge or delete it.

## A tab is missing
Each tab belongs to a role — **WhatsApp**, **Productivity** and **Reports** need Admin; **Settings** needs Super Admin. **Appreciation** and **Suggestions** are there for everyone.
Settings sits at the **bottom** of the rail, below Suggestions, not at the top.
On the WhatsApp page the rail is hidden on a phone by design; turn the phone sideways or use a laptop.
A browser zoomed right out can also push narrow controls off screen.

## A WhatsApp group will not open
A desk with no group link shows **"Group for this notification is not set up yet"** instead of a button.
Links are set by an admin in **Settings → Picklists → "WhatsApp Groups"**, one line per desk.
Format: `Report Desk = https://chat.whatsapp.com/…` — `:` works instead of `=`, and a bare URL is accepted.
If the page opens but the popup is blocked, allow popups for this site and press the button again.

## Signing in
There is no CRM password — sign in with your PSRI **Microsoft** account.
If you were signed in and something looks empty, sign out and back in.
On a phone you get the same account prompt, so use the same account as the office.
Your role decides what you see; if a tab is missing, check your role with an admin.

## Patient data and sharing
Agents see their own work; admins see every prospect; super admins see the settings.
Do not send patient details over WhatsApp groups beyond what the alert template already includes — name, number and concern.
Exports contain real patient data — download them only when a report is actually needed.
Tokens, webhook URLs and server settings never live in the browser; they are kept in the server configuration.
