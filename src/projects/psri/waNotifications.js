// The four WhatsApp notification templates the CRM sends when a Case is
// submitted.
//
// Mirrors PSRI "WhatsApp Notification Templates & Process Flow v2" and the
// "Case WhatsApp Alerts" workflow (src/admin/workflow/templates.js). A single
// Case can match more than one template (e.g. High Value + Complaint) — it then
// generates one message per matching template.
//
//   1  CALL BACK            Case · "Call Back Arranged" is ticked
//   2  HIGH VALUE CASE      Case · "High Value Case" ticked, not transplant
//   3  TRANSPLANT PROGRAM   Case · "High Value Case" ticked, procedure is transplant
//   4  COMPLAINT / FEEDBACK Case · Call For = "Complaint/Feedback"

export const WA_TEMPLATES = [
  {
    n: 1,
    key: 'callback',
    title: 'Call Back',
    trigger: 'Case · "Call Back Arranged" is ticked',
    recipient: 'The desk the guest was trying to reach',
  },
  {
    n: 2,
    key: 'highValue',
    title: 'High Value Case',
    trigger: 'Case · "High Value Case" is ticked (not transplant)',
    recipient: 'The specialty desk tied to the procedure',
  },
  {
    n: 3,
    key: 'transplant',
    title: 'Transplant Program',
    trigger: 'Case · "High Value Case" is ticked and the procedure is transplant',
    recipient: 'Transplant coordination team',
  },
  {
    n: 4,
    key: 'complaint',
    title: 'Complaint / Feedback',
    trigger: 'Case · Call For = "Complaint/Feedback"',
    recipient: 'Patient Relations / Quality (and the named department)',
  },
];

const TRANSPLANT_RE = /transplant/i;

// True when the case's procedure/specialty text marks it as transplant-related.
export function isTransplantCase(c) {
  return TRANSPLANT_RE.test(
    [c.typeOfProcedure, c.nameOfProcedure, c.specialtyEnquiredFor, c.specialty]
      .map(v => String(v || '')).join(' '),
  );
}

// Which of the four templates a case matches (in template order).
export function caseTemplates(c) {
  const keys = [];
  if (c.isCallback) keys.push('callback');
  if (c.isHighValue) keys.push(isTransplantCase(c) ? 'transplant' : 'highValue');
  if (String(c.callFor || '').toLowerCase().includes('complaint')) keys.push('complaint');
  return keys;
}

const line = (label, value) => `${label}- ${String(value || '').trim()}`.trimEnd();

// The exact message text for a template + case, matching the doc's wording.
export function buildWaMessage(key, c) {
  const name = c.contactName || '';
  const mobile = c.contactMobile || '';
  const concern = c.summary || '';
  switch (key) {
    case 'callback':
      return [
        'CALL BACK',
        line('Name', name),
        line('Number', mobile),
        line('Concern', concern),
        'Please arrange a call back from concerned department.',
      ].join('\n');
    case 'highValue':
      return [
        'HIGH VALUE CASE',
        `Name - ${name}`.trimEnd(),
        `Number - ${mobile}`.trimEnd(),
        line('Concern', concern),
        'Please arrange a call back from concerned department',
      ].join('\n');
    case 'transplant': {
      const location = [c.city, c.state].map(v => String(v || '').trim()).filter(Boolean).join(', ');
      return [
        'Transplant Program',
        line('Name', name),
        line('Number', mobile),
        location ? `Location - ${location}` : null,
        line('Concern', concern),
        'Please arrange a call back from concerned department.',
      ].filter(Boolean).join('\n');
    }
    case 'complaint':
      return [
        'Complaint/Feedback',
        line('Name', name),
        line('Number', mobile),
        line('Concern', concern),
        'Please look into this matter.',
      ].join('\n');
    default:
      return '';
  }
}

// Digits only, for wa.me links.
export function waDigits(mobile) {
  return String(mobile || '').replace(/\D+/g, '');
}
