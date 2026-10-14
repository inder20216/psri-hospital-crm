import { useEffect, useRef, useState } from 'react';
import { findTopic, SUGGESTIONS, TUTORIAL } from './supportContent';
import { psri } from '../../api/psri';

// Turns a line written with **bold** into markup. Only that marker is honoured
// and the text is rendered as text, so a line can never inject HTML.
function bold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ));
}

// An AI answer is plain text with " - " bullets and **bold** (the server asks
// for exactly that), rendered as text — never as HTML.
function AiAnswer({ text }) {
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = [];
  const out = [];
  const flush = () => {
    if (bullets.length) out.push(<ul key={`u${out.length}`} className="psri-bot-ul">{bullets.splice(0).map((b, i) => <li key={i}>{bold(b)}</li>)}</ul>);
  };
  lines.forEach((l) => {
    if (/^[-•*]\s+/.test(l)) bullets.push(l.replace(/^[-•*]\s+/, ''));
    else { flush(); out.push(<p key={`p${out.length}`} className="psri-bot-text">{bold(l)}</p>); }
  });
  flush();
  return <div className="psri-bot-ai">{out}</div>;
}

const HELLO = 'Ask me anything about the CRM — how to do something (“how do I create a case?”), or what something means (“which desk gets the alert?”). New here? Press **📚 Tutorial** to go through every job step by step.';

/**
 * Support assistant.
 *
 * Two layers:
 *  1. The written guides in supportContent.js — instant, offline, and the only
 *     copy of that wording. 📚 Tutorial walks through every how-to in order.
 *  2. Anything they don't match goes to the AI fallback (psri-support-ask),
 *     which the server grounds on its own copy of those same guides, so it can
 *     answer the long tail of CRM questions without inventing rules. If it is
 *     not set up or not reachable, the bot says so and offers the guides.
 */
export default function SupportBot() {
  const nextId = useRef(0);
  const id = () => `m${nextId.current++}`;
  const [messages, setMessages] = useState(() => [{ id: 'hello', from: 'bot', text: HELLO }]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  // The last few exchanges, sent with an AI question so a follow-up like
  // "and for admins?" has context. The server caps it at 5 turns.
  const history = useRef([]);
  const logRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const remember = (q, a) => {
    history.current = [...history.current, { q, a: String(a).slice(0, 300) }].slice(-5);
  };

  const showTopic = (entry, kind, question) => {
    setMessages(prev => [...prev, { id: id(), from: 'bot', topic: entry, kind, question }]);
    remember(question || entry.label, `${entry.label}. ${entry.summary || ''}`);
  };

  const askAi = async (q) => {
    const pendingId = id();
    setBusy(true);
    setMessages(prev => [...prev, { id: pendingId, from: 'bot', pending: true }]);
    const res = await psri.askSupport(q, history.current);
    let reply;
    if (res && res.success && res.documented && res.answer) {
      reply = { ai: res.answer };
      remember(q, res.answer);
    } else if (res && res.success && !res.documented) {
      reply = { text: 'That isn’t covered in the CRM guides yet, so I won’t guess. Ask your team leader, or press **📚 Tutorial** to browse every guide.' };
    } else {
      reply = { text: 'I couldn’t find that in the guides, and the detailed answers aren’t available right now. Try rephrasing, or press **📚 Tutorial** to browse every guide.' };
    }
    setMessages(prev => prev.map(m => (m.id === pendingId ? { id: pendingId, from: 'bot', ...reply } : m)));
    setBusy(false);
  };

  const ask = (question) => {
    const q = String(question || '').trim();
    if (!q || busy) return;
    setValue('');
    setMessages(prev => [...prev, { id: id(), from: 'me', text: q }]);
    const hit = findTopic(q);
    if (hit) showTopic(hit.entry, hit.kind, q);
    else askAi(q);
  };

  const openTutorial = () => {
    setMessages(prev => [...prev, { id: id(), from: 'me', text: '📚 Tutorial' }, { id: id(), from: 'bot', menu: true }]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(value); }
  };

  return (
    <section className="psri-bot">
      <div className="psri-bot-head">
        <span className="psri-bot-avatar">🎧</span>
        <div className="psri-bot-head-txt">
          <div className="psri-bot-title">Ask about the CRM</div>
          <div className="psri-bot-sub">Step-by-step tutorial, plus answers to any CRM question</div>
        </div>
        <button type="button" className="psri-btn-primary psri-bot-tutorial" onClick={openTutorial}>
          📚 Tutorial
        </button>
      </div>

      <div className="psri-bot-log" ref={logRef} aria-live="polite">
        {messages.map(m => {
          const tutIndex = m.topic && m.kind === 'howto' ? TUTORIAL.findIndex(t => t.key === m.topic.key) : -1;
          const nextGuide = tutIndex >= 0 ? TUTORIAL[tutIndex + 1] : null;
          return (
            <div key={m.id} className={`psri-bot-msg ${m.from}`}>
              {m.text && <p className="psri-bot-text">{bold(m.text)}</p>}
              {m.pending && <p className="psri-bot-text psri-bot-pending">Looking that up…</p>}
              {m.ai && <AiAnswer text={m.ai} />}

              {m.menu && (
                <div className="psri-bot-card">
                  <div className="psri-bot-card-head"><span>📚</span><strong>Tutorial — every job, step by step</strong></div>
                  <p className="psri-bot-text">Pick a guide, then press <strong>Next guide</strong> to carry on in order.</p>
                  <div className="psri-bot-menu">
                    {TUTORIAL.map((t, i) => (
                      <button key={t.key} type="button" className="psri-bot-menu-item" onClick={() => showTopic(t, 'howto')}>
                        <span className="psri-bot-n">{i + 1}</span>
                        <span>{t.icon} {t.label}</span>
                        {t.who && <em>{t.who}</em>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {m.topic && (
                <div className="psri-bot-card">
                  <div className="psri-bot-card-head">
                    <span>{m.topic.icon}</span>
                    <strong>{m.topic.label}</strong>
                    {m.topic.who && <em>{m.topic.who}</em>}
                  </div>

                  {m.topic.summary && <p className="psri-bot-text">{m.topic.summary}</p>}

                  {/* A how-to has numbered steps; a reference note has prose. */}
                  {m.kind === 'reference'
                    ? (
                      <div className="psri-bot-lines">
                        {m.topic.lines.map((l, i) => (
                          // Index is the identity here — the content is static.
                          <p key={i} className="psri-bot-line">{bold(l)}</p>
                        ))}
                      </div>
                    )
                    : (
                      <ol className="psri-bot-steps">
                        {m.topic.steps.map((s, i) => (
                          // Index is the identity here — the steps are static content.
                          <li key={i}>
                            <span className="psri-bot-n">{i + 1}</span>
                            <span>{bold(s)}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                  <div className="psri-bot-card-actions">
                    {nextGuide && (
                      <button type="button" className="psri-chip-btn" onClick={() => showTopic(nextGuide, 'howto')}>
                        Next guide: {nextGuide.label} →
                      </button>
                    )}
                    {tutIndex >= 0 && !nextGuide && (
                      <span className="psri-bot-done">🎉 That’s the whole tutorial.</span>
                    )}
                    {/* The keyword match can pick a near topic for a specific
                        question — let the person get a direct answer instead. */}
                    {m.question && (
                      <button type="button" className="psri-chip-btn" disabled={busy} onClick={() => askAi(m.question)}>
                        Not quite? Get a direct answer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The question menu stays put at all times, so there is always somewhere
          to go next without typing. */}
      <div className="psri-bot-suggests">
        {SUGGESTIONS.map(s => (
          <button key={s} type="button" className="psri-chip-btn" disabled={busy} onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="psri-bot-input">
        <input
          type="text"
          value={value}
          placeholder="Ask anything about the CRM…"
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Ask the support assistant"
        />
        <button type="button" className="psri-btn-primary" disabled={busy} onClick={() => ask(value)}>
          Ask
        </button>
      </div>
    </section>
  );
}
