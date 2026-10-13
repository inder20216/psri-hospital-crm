// Built-in designer templates for the workflow automation.
// Each template is a serialised config (toConfig shape) so it flows through
// fromConfig and renders exactly like a workflow saved from the designer.
// Every node sits on a uniform 2 in (192 px at 96 dpi) grid — one grid step
// between any two connected nodes — so templates open evenly spaced and never
// overlap.
import { fromConfig } from './schema';

// ── Template keys ─────────────────────────────────────────────────────────────

export const NEW_CONTACT_TEMPLATE_KEY = 'new-contact';
export const NEW_CASE_TEMPLATE_KEY    = 'new-case';

// 2 in ≈ 192 px. One grid step is used between any two connected nodes.
const STEP = 192;
const tplNode = (id, type, actionType, x, y, config) => ({
  id, type, position: { x, y }, data: { actionType, config },
});

// ── "New Contact" onboarding template ─────────────────────────────────────────
// Assigns the contact, welcomes them by email when they have one, otherwise
// opens an enquiry case — then logs them to the "New Contacts" list.
//
//   trigger → assign → email-check
//                        ├─(true)  notify-email → list
//                        └─(false) create-case  → list

const NEW_CONTACT_TEMPLATE_CONFIG = {
  v: 1,
  nodes: [
    tplNode('tpl-trigger',       'trigger',  'contactCreated',    444, 100, {}),
    tplNode('tpl-assign',        'action',   'assign',           60+STEP*2, 100+STEP, { assignedTo: '' }),
    tplNode('tpl-email-check',   'condition', 'condition',        444, 484, { field: 'email', operator: 'notEmpty', value: '' }),
    tplNode('tpl-email',         'action',   'notify',            828, 676, {
      channel: 'Email',
      from: '',
      to: '{{contact.email}}',
      subject: 'Welcome to PSRI Hospitals',
      body: 'Dear {{contact.name}}, thank you for registering with us. Our care team will reach out to you shortly. — PSRI Hospitals',
      url: '', message: '',
    }),
    tplNode('tpl-case',          'action',   'createCase',        60, 676, {
      channel: 'Web', typeOfCall: 'Enquiry', callFor: '', typeOfEnquiry: '',
      priority: '', status: 'Open',
      summary: 'New contact — {{contact.name}} ({{contact.mobile}})',
      specialty: '', doctorName: '',
    }),
    tplNode('tpl-log',           'action',  'sheetRow',        444, 868, {
      tab: 'New Contacts',
      rows: [
        { key: 'Contact Name', value: '{{contact.name}}' },
        { key: 'Mobile',       value: '{{contact.mobile}}' },
        { key: 'Source',       value: '{{contact.source}}' },
      ],
    }),
  ],
  edges: [
    { id: 'tpl-e1', source: 'tpl-trigger',     target: 'tpl-assign',         sourceHandle: null, targetHandle: null },
    { id: 'tpl-e2', source: 'tpl-assign',      target: 'tpl-email-check',    sourceHandle: null, targetHandle: null },
    { id: 'tpl-e4', source: 'tpl-email-check', target: 'tpl-email',          sourceHandle: 'true',  targetHandle: null },
    { id: 'tpl-e5', source: 'tpl-email-check', target: 'tpl-case',           sourceHandle: 'false', targetHandle: null },
    { id: 'tpl-e6', source: 'tpl-email',       target: 'tpl-log',            sourceHandle: null, targetHandle: null },
    { id: 'tpl-e8', source: 'tpl-case',        target: 'tpl-log',            sourceHandle: null, targetHandle: null },
  ],
};

// ── "New Case" onboarding template ────────────────────────────────────────────
// Assigns the contact, emails the patient an appointment confirmation when the
// case has a specialty (otherwise an enquiry acknowledgement), then logs the
// case to the "New Cases" list. A patient with no email is simply skipped.
//
//   trigger → assign → specialty-check
//                        ├─(true)  appointment-email → list
//                        └─(false) enquiry-email     → list

const NEW_CASE_TEMPLATE_CONFIG = {
  v: 1,
  nodes: [
    tplNode('tpl-cas-trigger',    'trigger',  'caseCreated',      444, 100, {}),
    tplNode('tpl-cas-assign',     'action', 'assign',  60+STEP*2, 100+STEP, { assignedTo: '' }),
    tplNode('tpl-cas-specialty',  'condition', 'condition',       444, 484, { field: 'case.specialty', operator: 'notEmpty', value: '' }),
    tplNode('tpl-cas-doctor',     'action',   'notify',           828, 676, {
      channel: 'Email',
      from: '',
      to: '{{contact.email}}',
      subject: 'Your appointment request — PSRI Hospitals',
      body: 'Dear {{contact.name}}, we have registered your appointment request for {{case.specialty}} (case {{case.caseId}}). Our team will call you on {{contact.mobile}} to confirm the date and time. — PSRI Hospitals',
      url: '', message: '',
    }),
    tplNode('tpl-cas-team',       'action',   'notify',           60, 676, {
      channel: 'Email',
      from: '',
      to: '{{contact.email}}',
      subject: 'We have received your enquiry — PSRI Hospitals',
      body: 'Dear {{contact.name}}, thank you for contacting PSRI Hospitals. Your enquiry has been registered as case {{case.caseId}} and our team will get back to you shortly. — PSRI Hospitals',
      url: '', message: '',
    }),
    tplNode('tpl-cas-log',        'action',   'sheetRow',         444, 868, {
      tab: 'New Cases',
      rows: [
        { key: 'Case ID',   value: '{{case.caseId}}' },
        { key: 'Contact',   value: '{{contact.name}}' },
        { key: 'Summary',   value: '{{case.summary}}' },
        { key: 'Specialty', value: '{{case.specialty}}' },
      ],
    }),
  ],
  edges: [
    { id: 'tpl-c1', source: 'tpl-cas-trigger',   target: 'tpl-cas-assign',    sourceHandle: null, targetHandle: null },
    { id: 'tpl-c2', source: 'tpl-cas-assign',    target: 'tpl-cas-specialty', sourceHandle: null, targetHandle: null },
    { id: 'tpl-c4', source: 'tpl-cas-specialty', target: 'tpl-cas-doctor',    sourceHandle: 'true',  targetHandle: null },
    { id: 'tpl-c5', source: 'tpl-cas-specialty', target: 'tpl-cas-team',      sourceHandle: 'false', targetHandle: null },
    { id: 'tpl-c6', source: 'tpl-cas-doctor',    target: 'tpl-cas-log',       sourceHandle: null, targetHandle: null },
    { id: 'tpl-c7', source: 'tpl-cas-team',      target: 'tpl-cas-log',       sourceHandle: null, targetHandle: null },
  ],
};

// ── "Case WhatsApp Alerts" template ───────────────────────────────────────────
// Sends department WhatsApp alerts for a new case. The three branches run
// independently, so one case can raise alerts on several of them. Inside a
// branch the checks are a chain: the first matching check sends the alert,
// otherwise its False exit tries the next check (the last one is a fallback).
//
//   trigger ─┬─ Call back arranged? → by Type of Enquiry:
//            │     Report / records → Report Desk · Billing → Billing Desk ·
//            │     Appointment → Appointment Desk · else → Front Desk
//            ├─ High value case? → Transplant? → Transplant Coordination
//            │     else by Specialty Enquired For: Cardiac · Orthopaedics ·
//            │     Oncology · Neuro · else → High Value General Desk
//            └─ Complaint / feedback? → Patient Relations (always), then by
//                  Type of Complaint: Doctor → Medical Superintendent ·
//                  High Charges → Billing · Emergency Services → Emergency ·
//                  Staff / Services / Waiting → Hospital Operations
//
// Matching values come from the CRM picklists (Type of Enquiry, Specialty,
// Type of Complaint). Every alert starts on one shared WhatsApp number;
// replace it per node with the department's own number as they are known.

export const CASE_WHATSAPP_TEMPLATE_KEY = 'case-whatsapp';

const WA_DEFAULT_TO = '9667224319';

// One entry per alert type: the plain-text message, and the approved Meta
// template that carries the same words (its {{1}}, {{2}}, … filled from
// waParams, one value per line). The templates must be created in WhatsApp
// Manager with these names — PSRI/Workflows/CASE_WHATSAPP_ALERTS.md has their text.
const NAME_NUMBER_CONCERN = '{{contact.name}}\n{{contact.mobile}}\n{{case.summary}}';
const ALERT_CALLBACK = {
  message: 'CALL BACK\nName- {{contact.name}}\nNumber- {{contact.mobile}}\nConcern- {{case.summary}}\nPlease arrange a call back from concerned department.',
  waTemplate: 'psri_call_back', waParams: NAME_NUMBER_CONCERN,
};
const ALERT_HIGH_VALUE = {
  message: 'HIGH VALUE CASE\nName - {{contact.name}}\nNumber - {{contact.mobile}}\nConcern- {{case.summary}}\nPlease arrange a call back from concerned department',
  waTemplate: 'psri_high_value_case', waParams: NAME_NUMBER_CONCERN,
};
const ALERT_TRANSPLANT = {
  message: 'Transplant Program\nName- {{contact.name}}\nNumber- {{contact.mobile}}\nLocation - {{contact.city}}, {{contact.state}}\nConcern- {{case.summary}}\nPlease arrange a call back from concerned department.',
  waTemplate: 'psri_transplant_program', waParams: '{{contact.name}}\n{{contact.mobile}}\n{{contact.city}}, {{contact.state}}\n{{case.summary}}',
};
const ALERT_COMPLAINT = {
  message: 'Complaint/Feedback\nName- {{contact.name}}\nNumber- {{contact.mobile}}\nConcern- {{case.summary}}\nPlease look into this matter.',
  waTemplate: 'psri_complaint_feedback', waParams: NAME_NUMBER_CONCERN,
};

// Columns are wider than the 210 px node card; rows clear a condition card.
const WX = [60, 360, 660, 960, 1260];
const WR = 150;
const wy = row => 60 + row * WR;

const check = (id, col, row, label, field, operator, value) =>
  tplNode(id, 'condition', 'condition', WX[col], wy(row), { label, field, operator, value });
const whatsapp = (id, col, row, label, alert) =>
  tplNode(id, 'action', 'notify', WX[col], wy(row), { label, channel: 'WhatsApp', phones: WA_DEFAULT_TO, waLanguage: 'en', ...alert, url: '', from: '', to: '', subject: '', body: '' });
const link = (source, target, sourceHandle = null) =>
  ({ id: `tpl-w-${source}-${target}`, source, target, sourceHandle, targetHandle: null });

const CASE_WHATSAPP_TEMPLATE_CONFIG = {
  v: 1,
  nodes: [
    tplNode('wa-trigger', 'trigger', 'caseCreated', WX[0], wy(6.5), {}),

    // Call Back — rows 0–3
    check('cb-check',      1, 0, 'Call back arranged?',     'case.isCallback',    'eq', 'true'),
    check('cb-report',     2, 0, 'Report / records query?', 'case.typeOfEnquiry', 'in', 'Lab/ Lab Reports, Scan/ X Ray/ Ultrasound, Medical Records'),
    check('cb-billing',    2, 1, 'Billing query?',          'case.typeOfEnquiry', 'in', 'IP Billing, OP Billing, Accounts, Consultation Charges, Other Charges, Insurance/ Health Card'),
    check('cb-appt',       2, 2, 'Appointment query?',      'case.typeOfEnquiry', 'in', 'Doctor Availability, Slot Availability, Appointment Reconfirmation'),
    whatsapp('cb-wa-report',  3, 0, 'Call back → Report Desk',      ALERT_CALLBACK),
    whatsapp('cb-wa-billing', 3, 1, 'Call back → Billing Desk',     ALERT_CALLBACK),
    whatsapp('cb-wa-appt',    3, 2, 'Call back → Appointment Desk', ALERT_CALLBACK),
    whatsapp('cb-wa-front',   3, 3, 'Call back → Front Desk',       ALERT_CALLBACK),

    // High Value — rows 4.5–9.5
    check('hv-check',      1, 4.5, 'High value case?',    'case.isHighValue',          'eq', 'true'),
    check('hv-transplant', 2, 4.5, 'Transplant enquiry?', 'case.procedureOrSpecialty', 'contains', 'Transplant'),
    check('hv-cardiac',    3, 5.5, 'Cardiac specialty?',  'case.specialtyEnquiredFor', 'in', 'Cardiac Sciences, CTVS, Vascular & Endovascular Surgery'),
    check('hv-ortho',      3, 6.5, 'Orthopaedics?',       'case.specialtyEnquiredFor', 'in', 'Orthopedics'),
    check('hv-onco',       3, 7.5, 'Oncology?',           'case.specialtyEnquiredFor', 'in', 'Oncology & Onco Surgery'),
    check('hv-neuro',      3, 8.5, 'Neuro sciences?',     'case.specialtyEnquiredFor', 'in', 'Neuro Sciences'),
    whatsapp('hv-wa-transplant', 3, 4.5, 'Transplant → Transplant Coordination', ALERT_TRANSPLANT),
    whatsapp('hv-wa-cardiac',    4, 5.5, 'High value → Cardiac Desk',            ALERT_HIGH_VALUE),
    whatsapp('hv-wa-ortho',      4, 6.5, 'High value → Orthopaedics Desk',       ALERT_HIGH_VALUE),
    whatsapp('hv-wa-onco',       4, 7.5, 'High value → Oncology Desk',           ALERT_HIGH_VALUE),
    whatsapp('hv-wa-neuro',      4, 8.5, 'High value → Neuro Desk',              ALERT_HIGH_VALUE),
    whatsapp('hv-wa-general',    4, 9.5, 'High value → General Desk',            ALERT_HIGH_VALUE),

    // Complaint / Feedback — rows 11–14
    check('cf-check',     1, 11, 'Complaint / feedback?',       'case.callFor',         'contains', 'Complaint'),
    check('cf-doctor',    3, 11, 'About a doctor?',             'case.typeOfComplaint', 'eq', 'Doctor'),
    check('cf-charges',   3, 12, 'About charges?',              'case.typeOfComplaint', 'eq', 'High Charges'),
    check('cf-emergency', 3, 13, 'About emergency services?',   'case.typeOfComplaint', 'eq', 'Emergency Services'),
    check('cf-ops',       3, 14, 'Staff / services / waiting?', 'case.typeOfComplaint', 'in', 'Hospital Staff, Hospital Services, Long Waiting Time'),
    whatsapp('cf-wa-pr',        2, 11, 'Complaint → Patient Relations',      ALERT_COMPLAINT),
    whatsapp('cf-wa-doctor',    4, 11, 'Complaint → Medical Superintendent', ALERT_COMPLAINT),
    whatsapp('cf-wa-charges',   4, 12, 'Complaint → Billing Desk',           ALERT_COMPLAINT),
    whatsapp('cf-wa-emergency', 4, 13, 'Complaint → Emergency Department',   ALERT_COMPLAINT),
    whatsapp('cf-wa-ops',       4, 14, 'Complaint → Hospital Operations',    ALERT_COMPLAINT),
  ],
  edges: [
    link('wa-trigger', 'cb-check'),
    link('wa-trigger', 'hv-check'),
    link('wa-trigger', 'cf-check'),

    link('cb-check',   'cb-report',     'true'),
    link('cb-report',  'cb-wa-report',  'true'),
    link('cb-report',  'cb-billing',    'false'),
    link('cb-billing', 'cb-wa-billing', 'true'),
    link('cb-billing', 'cb-appt',       'false'),
    link('cb-appt',    'cb-wa-appt',    'true'),
    link('cb-appt',    'cb-wa-front',   'false'),

    link('hv-check',      'hv-transplant',    'true'),
    link('hv-transplant', 'hv-wa-transplant', 'true'),
    link('hv-transplant', 'hv-cardiac',       'false'),
    link('hv-cardiac',    'hv-wa-cardiac',    'true'),
    link('hv-cardiac',    'hv-ortho',         'false'),
    link('hv-ortho',      'hv-wa-ortho',      'true'),
    link('hv-ortho',      'hv-onco',          'false'),
    link('hv-onco',       'hv-wa-onco',       'true'),
    link('hv-onco',       'hv-neuro',         'false'),
    link('hv-neuro',      'hv-wa-neuro',      'true'),
    link('hv-neuro',      'hv-wa-general',    'false'),

    link('cf-check',     'cf-wa-pr',        'true'),
    link('cf-wa-pr',     'cf-doctor'),
    link('cf-doctor',    'cf-wa-doctor',    'true'),
    link('cf-doctor',    'cf-charges',      'false'),
    link('cf-charges',   'cf-wa-charges',   'true'),
    link('cf-charges',   'cf-emergency',    'false'),
    link('cf-emergency', 'cf-wa-emergency', 'true'),
    link('cf-emergency', 'cf-ops',          'false'),
    link('cf-ops',       'cf-wa-ops',       'true'),
  ],
};

// ── "VMM Followup" templates ──────────────────────────────────────────────────
// Ported from the VMM Followup n8n workflow, WhatsApp side only (the Outlook
// email branch is dropped). Two workflows, because a workflow runs on exactly
// one trigger:
//
// 1. Auto reply — a customer answers a complaint follow-up. Their reply is
//    passed through if it is a full follow-up message, otherwise answered:
//       1 → resolved · 2 → no response · 3 → partially resolved · other → ask again
//
//      WhatsApp Message → Message received? ─(true)→ WhatsApp Auto Reply
//
// 2. Send follow-up — the complaint system pushes a follow-up out to a customer:
//
//      Follow-up Request → Send follow-up (WhatsApp)

export const VMM_FOLLOWUP_REPLY_TEMPLATE_KEY = 'vmm-followup-reply';
export const VMM_FOLLOWUP_SEND_TEMPLATE_KEY  = 'vmm-followup-send';

const VMM_FOLLOWUP_REPLY_TEMPLATE_CONFIG = {
  v: 1,
  nodes: [
    tplNode('vmm-reply-trigger', 'trigger',   'waMessage', 240, 120, {}),
    tplNode('vmm-reply-check',   'condition', 'condition', 480, 120, {
      label: 'Message received?', field: 'wa.text', operator: 'notEmpty', value: '',
    }),
    tplNode('vmm-reply-auto',    'action',    'waAutoReply', 720, 120, {
      label: 'Auto reply',
      to: '{{wa.from}}',
      resolved: 'Thank you for confirming. We are marking your complaint as resolved.',
      noResponse: 'Thank you for the update. We will follow up with the vendor again. We also be checking on your other unresolved complaints if there are any',
      partial: 'Thank you for the update. We will continue working on your complaint. We also be checking on your other unresolved complaints if there are any',
      fallback: 'Please reply with 1 (Resolved), 2 (No response), or 3 (Partially resolved).',
      marker: 'Complaint #',
    }),
  ],
  edges: [
    { id: 'vmm-r1', source: 'vmm-reply-trigger', target: 'vmm-reply-check', sourceHandle: null,     targetHandle: null },
    { id: 'vmm-r2', source: 'vmm-reply-check',   target: 'vmm-reply-auto',  sourceHandle: 'true',   targetHandle: null },
  ],
};

const VMM_FOLLOWUP_SEND_TEMPLATE_CONFIG = {
  v: 1,
  nodes: [
    tplNode('vmm-send-trigger', 'trigger', 'waFollowup', 240, 120, {}),
    tplNode('vmm-send-wa',      'action',  'notify',     480, 120, {
      label: 'Send follow-up', channel: 'WhatsApp',
      phones: '{{wa.from}}', message: '{{wa.text}}',
      waTemplate: '', waLanguage: 'en', waParams: '',
      url: '', from: '', to: '', subject: '', body: '',
    }),
  ],
  edges: [
    { id: 'vmm-s1', source: 'vmm-send-trigger', target: 'vmm-send-wa', sourceHandle: null, targetHandle: null },
  ],
};

// ── Builders ─────────────────────────────────────────────────────────────────

export function buildVmmFollowupReplyTemplate() {
  return fromConfig(JSON.parse(JSON.stringify(VMM_FOLLOWUP_REPLY_TEMPLATE_CONFIG)));
}

export function buildVmmFollowupSendTemplate() {
  return fromConfig(JSON.parse(JSON.stringify(VMM_FOLLOWUP_SEND_TEMPLATE_CONFIG)));
}


export function buildNewContactTemplate(assigneeId) {
  const cfg = JSON.parse(JSON.stringify(NEW_CONTACT_TEMPLATE_CONFIG));
  const a = cfg.nodes.find(n => n.data.actionType === 'assign');
  if (assigneeId && a) a.data.config.assignedTo = String(assigneeId);
  return fromConfig(cfg);
}

export function buildCaseWhatsAppTemplate() {
  return fromConfig(JSON.parse(JSON.stringify(CASE_WHATSAPP_TEMPLATE_CONFIG)));
}

export function buildNewCaseTemplate(assigneeId) {
  const cfg = JSON.parse(JSON.stringify(NEW_CASE_TEMPLATE_CONFIG));
  const a = cfg.nodes.find(n => n.data.actionType === 'assign');
  if (assigneeId && a) a.data.config.assignedTo = String(assigneeId);
  return fromConfig(cfg);
}
