// WhatsApp department groups for cases.
//
// Mirrors the routing already used by the "Case WhatsApp Alerts" automation
// (src/admin/workflow/templates.js + PSRI/Workflows/CASE_WHATSAPP_ALERTS.md):
// a case can match a Call Back desk, a High Value / Transplant desk and/or the
// Complaint team, and each match has its own WhatsApp group.
//
// The group itself never changes per case — what changes is *which* group the
// case routes to. This module works out that routing from the case fields and
// resolves the group's invite link, so the case form can open the right group
// in one click.

// ── Department groups ────────────────────────────────────────────────────────
// id → display label. The label is what an admin types in the Picklist Manager
// list named "WhatsApp Groups" (entry format: "Report Desk = https://chat.whatsapp.com/…").
export const WHATSAPP_GROUPS = {
  reportDesk:       { label: 'Report Desk' },
  billingDesk:      { label: 'Billing Desk' },
  appointmentDesk:  { label: 'Appointment Desk' },
  frontDesk:        { label: 'Front Desk' },
  transplant:       { label: 'Transplant Coordination' },
  cardiacDesk:      { label: 'Cardiac Desk' },
  orthoDesk:        { label: 'Orthopaedics Desk' },
  oncoDesk:         { label: 'Oncology Desk' },
  neuroDesk:        { label: 'Neuro Desk' },
  highValueGeneral: { label: 'High Value General Desk' },
  patientRelations: { label: 'Patient Relations' },
  medicalSuper:     { label: 'Medical Superintendent' },
  emergencyDept:    { label: 'Emergency Department' },
  hospitalOps:      { label: 'Hospital Operations' },
};

// Invite links can be filled in here (e.g. 'https://chat.whatsapp.com/AbC123')
// or, without a redeploy, from Admin → Picklists → "WhatsApp Groups". A link
// set in the Picklist Manager wins over the value here.
//
// Until every department has its own group, BRANCH_INVITE_LINKS below sends a
// whole alert branch to one shared (test) group.
export const GROUP_INVITE_LINKS = {
  reportDesk:       '',
  billingDesk:      '',
  appointmentDesk:  '',
  frontDesk:        '',
  transplant:       '',
  cardiacDesk:      '',
  orthoDesk:        '',
  oncoDesk:         '',
  neuroDesk:        '',
  highValueGeneral: '',
  patientRelations: '',
  medicalSuper:     '',
  emergencyDept:    '',
  hospitalOps:      '',
};

// Shared group per alert branch — a case that matches no department-specific
// link above opens its branch's group instead. Precedence when resolving a
// group's link is: Picklist Manager value → GROUP_INVITE_LINKS → here.
//
// TESTING GROUPS — replace with the real per-department groups when available.
export const BRANCH_INVITE_LINKS = {
  callback:  'https://chat.whatsapp.com/Fo9n3ccWcRGKZYjwaI5VnU', // group 1 — call-back desks
  highValue: 'https://chat.whatsapp.com/Cr1ntgdocvT2Z7ZJmHvDmC', // group 2 — high value / transplant desks
  complaint: 'https://chat.whatsapp.com/GzedcPnLrSwJb8vGzNzI0v', // group 3 — complaint team
};

// The picklist list admins edit to set group invite links.
export const WHATSAPP_GROUPS_LIST = 'WhatsApp Groups';

// ── Match values (kept in step with the workflow template) ───────────────────
const SET_REPORT   = ['Lab/ Lab Reports', 'Scan/ X Ray/ Ultrasound', 'Medical Records'];
const SET_BILLING  = ['IP Billing', 'OP Billing', 'Accounts', 'Consultation Charges', 'Other Charges', 'Insurance/ Health Card'];
const SET_APPT     = ['Doctor Availability', 'Slot Availability', 'Appointment Reconfirmation'];
const SET_CARDIAC  = ['Cardiac Sciences', 'CTVS', 'Vascular & Endovascular Surgery'];
const SET_ORTHO    = ['Orthopedics'];
const SET_ONCO     = ['Oncology & Onco Surgery'];
const SET_NEURO    = ['Neuro Sciences'];
const SET_OPS      = ['Hospital Staff', 'Hospital Services', 'Long Waiting Time'];

const inSet = (value, set) => {
  const v = String(value || '').trim().toLowerCase();
  return v !== '' && set.some(s => s.trim().toLowerCase() === v);
};

// Message sign-off per alert type, mirroring the automation's templates.
const CLOSING = {
  callback:  'Please arrange a call back from concerned department.',
  highValue: 'Please arrange a call back from concerned department.',
  complaint: 'Please look into this matter.',
};

// ── Routing ──────────────────────────────────────────────────────────────────
// Returns the department groups a case routes to (deduped, in workflow order),
// each with the reason it matched. Empty array = the case raises no alert.
export function resolveWhatsAppGroups(form) {
  const f = form || {};
  const matches = new Map(); // id → { id, label, kind, reasons: [] }
  const add = (id, kind, reason) => {
    const label = WHATSAPP_GROUPS[id]?.label || id;
    const existing = matches.get(id);
    if (existing) { if (!existing.reasons.includes(reason)) existing.reasons.push(reason); return; }
    matches.set(id, { id, label, kind, reasons: [reason] });
  };

  // 1. Call Back — desk the guest was trying to reach.
  if (f.isCallback) {
    const te = f.typeOfEnquiry;
    if (inSet(te, SET_REPORT))       add('reportDesk',      'callback',  'Call back · report / records query');
    else if (inSet(te, SET_BILLING)) add('billingDesk',     'callback',  'Call back · billing query');
    else if (inSet(te, SET_APPT))    add('appointmentDesk', 'callback',  'Call back · appointment query');
    else                             add('frontDesk',       'callback',  'Call back · general desk');
  }

  // 2. High Value — transplant coordination, else specialty desk.
  if (f.isHighValue) {
    const procedureText = [f.typeOfProcedure, f.nameOfProcedure, f.specialtyEnquiredFor]
      .map(v => String(v || '')).join(' ');
    if (/transplant/i.test(procedureText))    add('transplant',       'highValue', 'High value · transplant program');
    else if (inSet(f.specialtyEnquiredFor, SET_CARDIAC)) add('cardiacDesk',      'highValue', 'High value · cardiac');
    else if (inSet(f.specialtyEnquiredFor, SET_ORTHO))   add('orthoDesk',        'highValue', 'High value · orthopaedics');
    else if (inSet(f.specialtyEnquiredFor, SET_ONCO))    add('oncoDesk',         'highValue', 'High value · oncology');
    else if (inSet(f.specialtyEnquiredFor, SET_NEURO))   add('neuroDesk',        'highValue', 'High value · neuro sciences');
    else                                      add('highValueGeneral', 'highValue', 'High value · general desk');
  }

  // 3. Complaint / Feedback — patient relations always, then the named team.
  if (String(f.callFor || '').toLowerCase().includes('complaint')) {
    add('patientRelations', 'complaint', 'Complaint / feedback');
    const tc = f.typeOfComplaint;
    if (tc === 'Doctor')                            add('medicalSuper',  'complaint', 'Complaint · about a doctor');
    else if (tc === 'High Charges')                 add('billingDesk',   'complaint', 'Complaint · about charges');
    else if (tc === 'Emergency Services')           add('emergencyDept', 'complaint', 'Complaint · emergency services');
    else if (inSet(tc, SET_OPS))                    add('hospitalOps',   'complaint', 'Complaint · staff / services / waiting');
  }

  return [...matches.values()].map(m => ({
    id: m.id,
    label: m.label,
    kind: m.kind,
    reason: m.reasons.join(' + '),
    closing: CLOSING[m.kind] || CLOSING.callback,
  }));
}

// ── Invite-link / API-target resolution ─────────────────────────────────────
// A Picklist Manager entry is "Label = value" (or "Label: value"); value is one of
//   • an invite link      https://chat.whatsapp.com/…  → opened as a normal link
//   • a Cloud API group   group:<GROUP_ID>             → a real in-CRM conversation
//   • a phone number      91XXXXXXXXXX                 → a 1:1 in-CRM conversation
// Extra "| value" parts may add the others, e.g.
//   "Report Desk = https://chat.whatsapp.com/AbC | group:Y2FwaV9n…"
function parseGroupEntry(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const parts = s.split('|').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  let label = '';
  let url = '';
  let target = '';
  const take = (v) => {
    if (/^(https?:\/\/|whatsapp:\/\/)/i.test(v)) url = v;
    else if (/^group\s*[:=]/i.test(v)) target = 'group:' + v.replace(/^group\s*[:=]\s*/i, '').trim();
    else if (/^[+\d][\d\s()-]{8,}$/.test(v)) target = 'wa:' + v.replace(/\D+/g, '');
  };
  parts.forEach((part, i) => {
    if (i === 0 && !/^(https?:\/\/|whatsapp:\/\/)/i.test(part)) {
      const hm = part.match(/^([^=:]+?)\s*[=:]\s*(\S.*)$/);
      if (hm) { label = hm[1].trim(); take(hm[2].trim()); return; }
    }
    take(part);
  });
  return { label, url, target };
}

// Resolves the invite link for a group id: Picklist Manager override first,
// then the group's own code default, then its alert branch's shared group.
// '' means "not configured yet".
export function groupInviteLink(id, getList, kind) {
  const label = WHATSAPP_GROUPS[id]?.label;
  if (getList && label) {
    const entries = getList(WHATSAPP_GROUPS_LIST) || [];
    for (const raw of entries) {
      const parsed = parseGroupEntry(raw);
      if (parsed && parsed.label && parsed.label.toLowerCase() === label.toLowerCase()) {
        return parsed.url;
      }
    }
  }
  return GROUP_INVITE_LINKS[id] || BRANCH_INVITE_LINKS[kind] || '';
}

// Cloud API targets may also be set in code (a group id or phone per desk),
// used when the Picklist Manager entry carries no target. Blank = none.
export const GROUP_API_TARGETS = {
  reportDesk:       '',
  billingDesk:      '',
  appointmentDesk:  '',
  frontDesk:        '',
  transplant:       '',
  cardiacDesk:      '',
  orthoDesk:        '',
  oncoDesk:         '',
  neuroDesk:        '',
  highValueGeneral: '',
  patientRelations: '',
  medicalSuper:     '',
  emergencyDept:    '',
  hospitalOps:      '',
};

// Resolves the in-CRM conversation target for a group id. Returns a thread id
// ("group:<GROUP_ID>" or "wa:<PHONE>"), or '' when only an invite link is
// configured (the widget then falls back to the link flow).
export function groupApiTarget(id, getList) {
  const label = WHATSAPP_GROUPS[id]?.label;
  if (getList && label) {
    const entries = getList(WHATSAPP_GROUPS_LIST) || [];
    for (const raw of entries) {
      const parsed = parseGroupEntry(raw);
      if (parsed && parsed.label && parsed.label.toLowerCase() === label.toLowerCase() && parsed.target) {
        return parsed.target;
      }
    }
  }
  return GROUP_API_TARGETS[id] || '';
}

// Prefilled case-update text an agent can paste into the group, matching the
// wording of the WhatsApp alert templates.
export function buildGroupMessage(form, group) {
  const f = form || {};
  const contact = f.contact || {};
  const lines = [
    group?.label ? `To - ${group.label}` : null,
    `Name- ${contact.name || ''}`.trimEnd(),
    `Number- ${contact.mobile || ''}`.trimEnd(),
    `Concern- ${f.summary || ''}`.trimEnd(),
  ].filter(Boolean);
  if (group?.closing) lines.push(group.closing);
  return lines.join('\n');
}
