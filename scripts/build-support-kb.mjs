// Writes the Support assistant's knowledge base for the server.
//
// supportContent.js is the single source of truth for the help wording. The
// instant answers read it in the browser; the AI fallback (support_ai.php)
// reads this generated copy on the server, so the browser never sends the
// "documentation" itself — otherwise anyone could swap in their own text and
// use the endpoint as a free general-purpose AI.
//
// Runs automatically before `npm run build` (and so before `npm run deploy`).
// Run by hand with:  npm run support-kb
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TUTORIAL, REFERENCE } from '../src/projects/psri/supportContent.js';

const OUT = fileURLToPath(new URL('../PSRI/Workflows/php/support_kb.md', import.meta.url));

const lines = [
  '<!-- GENERATED from src/projects/psri/supportContent.js by scripts/build-support-kb.mjs — do not edit by hand. -->',
  '',
  '# How-to guides',
  '',
];
for (const t of TUTORIAL) {
  lines.push(`## ${t.label}${t.who ? ` (${t.who})` : ''}`);
  if (t.summary) lines.push(t.summary);
  (t.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');
}
lines.push('# Reference', '');
for (const r of REFERENCE) {
  lines.push(`## ${r.label}${r.who ? ` (${r.who})` : ''}`);
  if (r.summary) lines.push(r.summary);
  (r.lines || []).forEach(l => lines.push(l));
  lines.push('');
}

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`support_kb.md: ${TUTORIAL.length} guides, ${REFERENCE.length} reference notes`);
