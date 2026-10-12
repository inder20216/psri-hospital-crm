# Universal CRM — PSRI Project

A React + Vite application hosting multiple CRM projects on a shared shell. The
active project is the **PSRI Hospital CRM**; VMM is present as a placeholder stub
only (real VMM work lives in `../vmm-crm/`).

---

## Projects in this repo

| Project | Location | Status |
|---|---|---|
| PSRI Hospital CRM | `src/projects/psri/` | Active |
| VMM CRM | `src/projects/vmm/` | Placeholder stub |

---

## Tech stack

- **React 19** + **Vite** (HMR, ES modules)
- **React Router** for the shell/routes
- **MSAL** (`@azure/msal-react`) — Microsoft Entra ID sign-in
- **React Flow** (`@xyflow/react`) — the visual workflow designer
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

The app is served under the base path `/crm-psri-testing/`
(e.g. http://localhost:5200/crm-psri-testing/).

### Environment variables

Values live in `.env.local` (dev) and `.env.production`:

| Variable | Purpose |
|---|---|
| `VITE_PSRI_API_BASE` | Base URL for the main API webhooks (default `/psri-webhook`) |
| `VITE_PSRI_WORKFLOW_BASE` | Workflow designer/runner API (default `/psri-api`, Vite-proxied to `localhost:8000`) |
| `VITE_SPARKTG_WIDGET_URL` | SparkTG CTI widget iframe URL |
| `VITE_AZURE_CLIENT_ID` | MSAL app (client) ID |
| `VITE_AZURE_TENANT_ID` | MSAL tenant ID |

### Local workflow API (needed for Admin → Workflows)

```bash
php -S localhost:8000 PSRI/Workflows/php/api.php
```

---

## Backend

| Layer | Used for |
|---|---|
| Supabase (Postgres) | `contacts` + `cases` tables — bulk data |
| Google Sheets ("OM CRM - PSRI") | Users, Picklists, Dependencies, SpecialtySummaries, Guidance, Doctors |
| MySQL (`psri` DB) | `workflows` + `workflow_runs`, `new_contacts` / `new_cases` lists |
| PHP API (`PSRI/Workflows/php/api.php`) | Workflow designer store + runner (replaced the n8n workflow webhooks) |
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
| Supabase schema | `PSRI/supabase_schema.sql` |
| Workflow PHP runner | `PSRI/Workflows/php/` |

---

## WhatsApp department-group widget

When an agent opens the **case form** (Cases → **+ New Case**), a green
**💬 WhatsApp group** card is shown. It works out which hospital department(s)
the case belongs to, and gives the agent a one-click **Open group →** button that
opens that department's WhatsApp group in a new tab. Each department row also has
**Copy update**, which copies a ready-to-paste message (Name / Number / Concern,
matching the alert template wording).

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
| High Value (other specialty) | High Value General Desk |
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

`|` or `:` also work as the separator, and a bare URL is accepted. These values
are shared across all agents.

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

While a department group has no link of its own, its whole branch falls back to
the matching `BRANCH_INVITE_LINKS` entry. The file currently ships with three
**testing** groups (one per branch); replace them with the real department groups
as they become available. A row with no link at all shows **"Link not set"**
instead of a button.

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
- **PHP is the executor** (`PSRI/Workflows/php/`). Templates include
  **+ Case WhatsApp Alerts** (Admin → Workflows).
- Triggers are fired fire-and-forget by the frontend: `psri.addContact` →
  `psri-contact-workflow-run`; `CasesPage.handleSave` → `psri.runCaseWorkflows`.
- The editor UI never names the backend.

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
