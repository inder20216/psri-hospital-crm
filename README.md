# Universal CRM — PSRI Project

A React + Vite application hosting multiple CRM projects on a shared shell. The
active project is the **PSRI Hospital CRM**; VMM is present as a placeholder stub
only (real VMM work lives in `../vmm-crm/`).

- **Live app:** https://inder20216.github.io/psri-hospital-crm/
- **Live API:** `https://43.204.141.221.nip.io/psri-api`

---

## Projects in this repo

| Project | Location | Status |
|---|---|---|
| PSRI Hospital CRM | `src/projects/psri/` | Active |
| VMM CRM | `src/projects/vmm/` | Placeholder stub |

---

## Tech stack

- **React 19** + **Vite 8** (HMR, ES modules)
- **React Router** for the shell/routes
- **MSAL** (`@azure/msal-react`) — Microsoft Entra ID sign-in
- **React Flow** (`@xyflow/react`) — the visual workflow designer
- **qrcode.react** — the "open this page on a phone" QR code
- Plain CSS per area (`Psri.css`, `Admin.css`, `Workflow.css`, …)

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5200  (strictPort)
```

Other scripts:

```bash
npm run build      # production build → dist/
npm run preview    # preview the built app
npm run lint       # ESLint
npm run deploy     # build + publish to GitHub Pages (gh-pages)
```

The base path is `/psri-hospital-crm/` in a production build and `/` in dev —
`vite.config.js` switches on the command, so MSAL's redirect URI (origin +
`BASE_URL`) matches what Azure has registered for each.

> `build.cssTarget` is pinned so the CSS minifier keeps classic
> `@media (max-width: …)` queries instead of rewriting them to the modern
> `(width <= …)` range form. Older phone browsers silently drop range syntax,
> which would leave a phone showing the desktop layout.

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_PSRI_API_BASE` | Base URL for the main API webhooks (default `/psri-webhook`) |
| `VITE_PSRI_WORKFLOW_BASE` | Workflow designer/runner API (default `/psri-api`) |
| `VITE_SPARKTG_WIDGET_URL` | SparkTG CTI widget iframe URL |
| `VITE_AZURE_CLIENT_ID` | MSAL app (client) ID |
| `VITE_AZURE_TENANT_ID` | MSAL tenant ID |

**`/psri-api` in dev is proxied to the LIVE API**, not to a local PHP server:

```js
'/psri-api': { target: 'https://43.204.141.221.nip.io', changeOrigin: true }
```

This is because the local PHP that was serving `:8000` runs an older copy of the
code with no cases endpoints (`psri-cases` / `psri-cases-export` returned 404), so
the WhatsApp list could not load anything locally. The live host serves the same
database, so this is equivalent to local — just with current code. `vite.config.js`
documents how to switch back to `php -S localhost:8000`.

---

## Backend

| Layer | Used for |
|---|---|
| Supabase (Postgres) | `contacts` + `cases` tables — bulk data |
| Google Sheets ("OM CRM - PSRI") | Users, Picklists, Dependencies, SpecialtySummaries, Guidance, Doctors |
| MySQL (`psri` DB) | `workflows` + `workflow_runs`, `new_contacts` / `new_cases` lists |
| PHP API (`PSRI/Workflows/php/api.php`) | Workflow designer store + runner (replaced the n8n workflow webhooks) |
| MySQL (`cases` table) | Repeat detection — `wf_repeat_info()` in `runner.php` |
| n8n (`automation.openmindhelpline.com`) | The remaining API workflows (cases, contacts, telephony) |

---

## Project structure

| What | Where |
|---|---|
| PSRI pages | `src/projects/psri/` |
| API layer | `src/api/psri.js` |
| Auth (MSAL) | `src/auth/msalConfig.js` |
| Shell | `src/App.jsx`, `src/components/ProjectRail.jsx` |
| Admin pages | `src/admin/` (Users, Picklists, Dependencies, Productivity, Workflows) |
| Workflow designer | `src/admin/workflow/` |
| Contexts | `src/context/` |
| Process doc | `PSRI/PSRI_PROCESS.md` |
| Workflow PHP runner | `PSRI/Workflows/php/` |
| Deploy scripts | `PSRI/Workflows/php/deploy/` |

---

## WhatsApp Notifications page

Route `/psri/whatsapp` — a top-level item in the left rail (above the admin
tools, below Settings which sits under Suggestions).

Every case that triggers one of the four notification templates is listed under
the notification it belongs to, so the desk can see its own work in one place.

| # | Notification | Fires when |
|---|---|---|
| 1 | Call Back | "Call Back Arranged" is ticked |
| 2 | High Value Case | "High Value Case" is ticked (and not transplant) |
| 3 | Transplant Program | "High Value Case" + the procedure is transplant |
| 4 | Complaint / Feedback | Call For is a complaint |

### The filter row

`All` · the four numbered templates · **↻ Repeated query** · **✓ Copied** ·
**📱 Open on phone** · **↻ Refresh**. The QR and Refresh buttons are pill-shaped
like the filters but tinted, so they read as actions rather than filters.

### "Copy message" and the Copied list

**Copy message** puts the notification's wording on the clipboard and files the
notification under **✓ Copied**, removing it from **All** — so the desk's queue
only shows what is still waiting. Tracked per case + template in `localStorage`
under `psri.wa.copied.v1`; **↺ Restore** and **Clear list** manage it.

### "Send in group"

Opens that desk's WhatsApp group in a new window and copies the message so the
agent can paste it. It needs **no backend** — group links come from the picklist,
which the live API serves.

The window is opened **before** the clipboard write on purpose: clipboard writes
are async, and a `window.open` after an `await` is no longer a user gesture, so
browsers would block the popup. If the popup is blocked anyway, the message is
still copied and the flash message says so.

When a case routes to more than one group the button reads
`Send in group · <Desk>`. The **High Value General Desk** button is hidden.

### Opening it on a phone

**📱 Open on phone** shows a QR code for the same page. On a phone the page
becomes the whole screen:

- the left rail and **all** floating widgets (dialer, doctor lookup, missed-calls
  bar, tariff bot) are hidden — they are all direct children of `.ucrm-shell`, so
  one rule clears them;
- the list fills the width and reflows: stacked cards, full-width tap targets,
  a larger search font (so iOS doesn't zoom on focus);
- the **📱 Open on phone** button is hidden, since you're already on the phone.

This is **phone-only**, and deliberately gated on the *device*, not the width:

```js
window.matchMedia('(max-width: 1024px) and (pointer: coarse) and (hover: none)')
```

A laptop with display scaling (a 1366px screen at 175% is ~780 CSS px) or a
window that isn't maximised is narrow enough to trip a width-only test, and
would lose its rail and the QR button — the very button you need to scan. Only
while that query matches does the page add `psri-wa-focus` to `<body>`, and all
the phone CSS is scoped to that class, so no other screen can be affected.

Only the WhatsApp page gets this treatment; every other page keeps its rail on a
phone.

### Repeated query

A fourth view, sitting beside **Complaint / Feedback**: the same person raising
the same concern more than once. One row per repeated concern (not per case), so
someone who called 7 times about one thing is a single line, busiest first, with
every call numbered, dated, and carrying its Call For, status and Case ID.

**Matching rule — a case is a repeat when all three hold:**

| Part | Compared as |
|---|---|
| Mobile | digits only, then the **last 10** — so `8448089345`, `+91 8448089345` and `844-808-9345` are one person |
| Call For | normalised the same way as the concern |
| Concern (summary) | lower-cased, punctuation → spaces, whitespace collapsed, so `Testing` = `testing!` |

Two cases with the same concern but **different people** are deliberately not a
repeat: "Appointment booked" from nine patients is nine unrelated calls. Cases
with no mobile or no concern text cannot be matched and are skipped.

This list is built from **every** case, not only the ones that trigger a
notification — otherwise most repeats would be invisible anywhere. Repeat cases
still appear under their own template as well, each with an amber
`↻ Call N of M about this` badge (hover lists every call date).

The same rule is implemented in PHP (`wf_repeat_info()`, `wf_mobile_key()`,
`wf_norm_concern()` in `runner.php`) so the workflow engine and this page agree
on what counts as a repeat.

### Files

| File | Role |
|---|---|
| `src/projects/psri/WhatsAppListPage.jsx` | The page: templates, filters, Copied, Repeated query, QR dialog |
| `src/projects/psri/waNotifications.js` | `WA_TEMPLATES` (1–4), `caseTemplates`, `buildWaMessage` |
| `src/projects/psri/whatsappGroups.js` | Department routing, group link resolution, message builder |
| `src/projects/psri/repeatCalls.js` | Repeat matching rule + `buildRepeatIndex` |
| `src/projects/psri/Psri.css` | Page styles, phone layout, repeat badges |
| `src/projects/registry.jsx` | Registers the `/whatsapp` module (`hidden: true` = top-level rail item) |
| `src/components/ProjectRail.jsx` | The rail link |

### Data source

The page reads `psri-cases-export` (a CSV of **every** case) and parses it, rather
than `psri-cases`, which caps at 50 rows. `WhatsAppListPage.jsx` has its own
minimal RFC-4180 CSV reader — case summaries contain commas and line breaks.

---

## Microsoft Teams — repeated query alerts

When a case is created that says this person has already raised this same concern,
the workflow engine can post it to a Teams channel so whoever watches the channel
can chase it.

**This runs server-side, in the workflow engine.** Teams' webhook endpoint sends
no CORS headers, so a `fetch` from the browser is blocked outright — it has to be
a PHP POST.

### Setting it up

1. In Teams: channel ▸ **⋯** ▸ Manage channel ▸ **Workflows** ▸ Add a workflow ▸
   copy the URL. (Power Automate's "When a Teams webhook request is received".)
2. In the CRM: Settings → Workflows → **+ Repeated query → Teams**. Three nodes
   arrive pre-wired:

   ```
   Case Created → Repeated query? ─(true)→ Notify Teams
   ```

   Leave **Teams webhook URL** blank so it reads `config.php`, Save, set Active.
3. Re-save one of the repeated cases to see a card arrive.

### How it works

On a `case-created` run the runner loads the saved row and computes the repeat
group straight from the database — so a workflow branches on what was actually
saved, not on the request payload. It exposes five fields, usable in any condition:

| Field | Meaning |
|---|---|
| `case.isRepeat` | `true` / `false` |
| `case.repeatCount` | total calls about this concern |
| `case.repeatOrdinal` | which call this is (1 = the first) |
| `case.repeatFirstDate` | date of the earliest matching case |
| `case.repeatCaseIds` | every matching case id |

The **Notify Teams** node posts a card: Patient / Mobile / Call For /
"2 of 6 about this concern" / Concern / Case ID, with the first-seen date and all
case ids behind the *Include first-seen date and all case IDs* tick.

One payload satisfies **both** Teams webhook flavours: `text` (what the older
Incoming Webhook connector reads) plus a `type: message` + Adaptive Card
attachment envelope (what the Power Automate trigger reads).

### The webhook URL is a secret

Anyone holding it can post to your channel, so:

- it lives in `config.php` (**gitignored**) or `PSRI_TEAMS_WEBHOOK_URL`, never in
  git;
- resolution order is **the node's own URL first, then config**, so one config
  entry serves every Teams node;
- it is **masked in run history** — the step detail logs
  `teams → https://…powerplatform.com/…/invoke?…`, never the `sig=` query, because
  run history is readable in the CRM.

`config.php` shape:

```php
'teams' => [
    'webhook_url' => '<the Teams / Power Automate webhook URL>',
],
```

### Files

| File | Role |
|---|---|
| `PSRI/Workflows/php/runner.php` | `wf_repeat_info()`, `wf_mobile_key()`, `wf_norm_concern()`, `wf_teams_payload()`, `wf_mask_url()`, the `Teams` channel in `notify` |
| `src/admin/workflow/schema.js` | Teams channel + its fields, the new condition fields |
| `src/admin/workflow/templates.js` | The `repeat-teams` template |
| `src/admin/workflow/PropertyPanel.jsx` | `checkbox` field type |
| `PSRI/Workflows/php/config.example.php` | `teams.webhook_url` (empty) |

---

## Deployment

### Frontend (GitHub Pages)

```bash
cmd /c "npm run deploy"    # build + publish to gh-pages
```

`gh-pages` is a separate branch; `main` holds the source.

### Backend (PHP on the server)

The server update is **one line**, run on the host — no file upload needed,
because the installer pulls the code straight from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/inder20216/psri-hospital-crm/main/PSRI/Workflows/php/deploy/deploy-github.sh \
  | sudo bash -s -- https://43.204.141.221.nip.io/psri-api
```

Add `--check` (instead of the URL) to report the current state and change
nothing. The installer finds the live folder itself, takes a timestamped backup,
unpacks, **never overwrites `config.php`**, lints before running anything,
migrates as `www-data`, smoke-tests each route, and prints the rollback command.

Prefer a zip? `deploy/deploy-teams.sh` does the same from a bundle
(`psri-php-<stamp>.zip`, built from `PSRI/Workflows/php/` minus `config.php`).
Both bundles are flat with forward slashes — a zip written with Windows'
`Compress-Archive` uses backslashes, which `unzip` on Linux treats as literal
characters in filenames and scatters `php\api.php` across the folder.

### `config.php` (gitignored, never committed)

Holds the DB credentials, the WhatsApp Cloud API token + verify token, and now
`teams.webhook_url`. Copy `config.example.php` to fill one in, or set the
`PSRI_*` environment variables instead.

---

## Current status

Live and working:

- the WhatsApp Notifications page, its four templates, Copied list, Repeated
  query tab, **Send in group**, and the phone/QR view;
- the workflow designer, including the Teams channel and the new condition fields.

Done and committed, **waiting on the server**:

- the PHP carrying `wf_repeat_info()` and the Teams channel;
- therefore the **Repeated query → Teams** workflow itself — its JSON lives in
  the database, so it can only be created after the code is deployed.

Known blockers:

- `43.204.141.221` still answers **404** on every `psri-wa-*` route; the PHP
  update has not been deployed.
- Meta's inbound WhatsApp webhook still points at n8n, not
  `…/psri-api/psri-wa-webhook`.
- No desk → conversation mapping in Admin → Picklists → "WhatsApp Groups", so
  in-CRM group conversations have no target yet.

---

## WhatsApp department-group widget

When an agent opens the **case form** (Cases → **+ New Case**), a green
**💬 WhatsApp group** card is shown. It works out which hospital department(s)
the case belongs to, and gives the agent a one-click **Open group →** button that
opens that department's WhatsApp group in a new tab. Each department row also has
**Copy update**, which copies a ready-to-paste message (Name / Number / Concern,
matching the alert template wording).

> The case-form widget says **Open group →**; the WhatsApp Notifications page
> says **Send in group** for the same action (it also copies the message).
> Renaming the widget to match is a one-line change if wanted.

A case can match **more than one** department, so every match gets its own row.

### Routing rules

The routing mirrors the **"Case WhatsApp Alerts"** automation
(`src/admin/workflow/templates.js`, `PSRI/Workflows/CASE_WHATSAPP_ALERTS.md`), so
the group the agent opens is the same department the automation alerts.

| Case matches | Department group |
|---|---|
| Call Back + report / records enquiry | Report Desk |
| Call Back + billing enquiry | Billing Desk |
| Call Back + appointment enquiry | Appointment Desk |
| Call Back (anything else) | Front Desk |
| High Value + "Transplant" in procedure / specialty | Transplant Coordination |
| High Value + Cardiac | Cardiac Desk |
| High Value + Orthopaedics | Orthopaedics Desk |
| High Value + Oncology | Oncology Desk |
| High Value + Neuro | Neuro Desk |
| High Value (other specialty) | High Value General Desk *(no button on the notifications page)* |
| Complaint / Feedback | Patient Relations |
| Complaint + Doctor | Medical Superintendent |
| Complaint + High Charges | Billing Desk |
| Complaint + Emergency Services | Emergency Department |
| Complaint + Staff / Services / Waiting | Hospital Operations |

### Where the group links come from

Resolution precedence when opening a group:

1. **Picklist Manager** — highest priority, editable without a deploy.
2. **Per-department link** in code (`GROUP_INVITE_LINKS`).
3. **Per-branch shared link** in code (`BRANCH_INVITE_LINKS`).

**Option 1 — Admin → Picklists → "WhatsApp Groups"** (recommended, no redeploy).
Add one value per group, labelled exactly as the department names above:

```
Report Desk = https://chat.whatsapp.com/AbC123xyz
```

`|` or `:` also work as the separator, and a bare URL is accepted. A picklist
value may also carry a Cloud API target after a `|`, e.g.
`Report Desk = https://chat.whatsapp.com/AbC | group:Y2FwaV9n…`.

**Option 2 — code** in `src/projects/psri/whatsappGroups.js`:

```js
export const GROUP_INVITE_LINKS = {
  reportDesk: 'https://chat.whatsapp.com/…',
  // …
};

// Shared group per alert branch — used when a department has no link of its own.
export const BRANCH_INVITE_LINKS = {
  callback:  'https://chat.whatsapp.com/…', // call-back desks
  highValue: 'https://chat.whatsapp.com/…', // high value / transplant desks
  complaint: 'https://chat.whatsapp.com/…', // complaint team
};
```

The file currently ships with three **testing** groups (one per branch); replace
them with the real department groups as they become available.

> **Note:** `https://chat.whatsapp.com/…` invite links open WhatsApp / WhatsApp
> Web and land the member in the group (they join on first open). The Meta Groups
> API does not expose a direct by-group-ID deep link.

### Files

| File | Role |
|---|---|
| `src/projects/psri/whatsappGroups.js` | Routing rules, group list, link resolution, message builder |
| `src/projects/psri/WhatsAppGroupWidget.jsx` | The widget UI |
| `src/projects/psri/CasesPage.jsx` | Renders the widget in the case form |
| `src/projects/psri/Psri.css` | Widget styles |
| `src/context/PicklistsContext.jsx` | Registers the `WhatsApp Groups` picklist |

### Testing it

1. Cases → **+ New Case**, then select/add a contact (the form unlocks).
2. Scroll to the bottom of the "Call Details" block — the green **WhatsApp group**
   card sits under **Appreciation Received**.
3. Tick **Call Back Arranged** → a desk row appears → **Open group →**.
4. Tick **High Value Case** → adds the specialty/transplant desk row.
5. Set **Call For = Complaint/Feedback** → adds the complaint team row(s).
6. Click **Open group →** (opens the invite link) or **Copy update**.

A fresh case with none of the above shows the card with *"No department group is
mapped to this case yet."*, which is expected.

---

## Workflow automation (visual designer)

- Super Admins design "new contact" / "new case" automation in the React Flow
  designer (`/admin/workflows`); the graph is serialised to JSON and saved to MySQL
  `workflows` (one `workflow_runs` row per executed node).
- **PHP is the executor** (`PSRI/Workflows/php/`). Starter graphs:
  **+ New Contact Workflow**, **+ New Case Workflow**,
  **+ Case WhatsApp Alerts**, **+ Repeated query → Teams**,
  **+ VMM Followup - Send Follow-up**.
- Send Notification channels: **Webhook URL**, **Email**, **WhatsApp**,
  **Microsoft Teams**.
- Triggers are fired fire-and-forget by the frontend: `psri.addContact` →
  `psri-contact-workflow-run`; `CasesPage.handleSave` → `psri.runCaseWorkflows`.
- The editor UI never names the backend.

---

## SparkTG CTI

- Agent login in the React app: `10167201` / `agent007`
- Incoming call flow: DialerPanel fires → auto-navigate to the Cases form
  (contact found → pre-fill; not found → Quick Add modal opens).

---

## Hard rules

- **Never expose** n8n, Supabase or OpenAI names in user-facing error messages —
  generic text only.
- **Duplicate contacts**: block only if BOTH name AND mobile match an existing
  record exactly.
- **Dependent dropdowns**: fall back to the ungated flat picklist if no dependency
  pairs exist yet for a parent value — never show an empty dropdown.
- **No user delete**: removing a User record is structurally impossible by design.
- **Role protection**: cannot change a role if it would leave zero Super Admins.
- **Secrets never reach git**: tokens, the Teams webhook URL and `config.php`
  itself are gitignored. Webhook URLs are masked in run logs.