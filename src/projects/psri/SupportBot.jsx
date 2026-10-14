import { useEffect, useRef, useState } from 'react';
import { findTopic, TUTORIAL, SUGGESTIONS } from './supportContent';

// Turns a step written with **bold** into markup. Only that marker is honoured
// and the text is rendered as text, so a step can never inject HTML.
function bold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ));
}

/**
 * Support assistant.
 *
 * Answers strictly from the same TUTORIAL the page shows — no network call, no
 * API key, and nothing it can say that isn't already written on the page. When
 * it does not recognise a question it says so and lists what it does know,
 * rather than inventing an answer.
 */
export default function SupportBot({ openKey, onOpenTopic }) {
  const [messages, setMessages] = useState([
    {
      id: 'hello',
      from: 'bot',
      text: 'Ask me how to do anything in the CRM — “how do I create a case?”, “send a WhatsApp alert”, “someone called about the same thing twice”. I answer from the same guides shown below.',
    },
  ]);
  const [value, setValue] = useState('');
  const logRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const ask = (question) => {
    const q = String(question || '').trim();
    if (!q) return;
    const hit = findTopic(q);
    const reply = hit
      ? { id: `a${q}`, from: 'bot', topic: hit.entry }
      : {
        id: `a${q}`,
        from: 'bot',
        text: 'I do not have a guide for that one yet. I can help with:',
        topics: TUTORIAL,
      };
    setMessages(prev => [...prev, { id: `q${q}`, from: 'me', text: q }, reply]);
    setValue('');
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
          <div className="psri-bot-sub">Answers from the guides on this page</div>
        </div>
      </div>

      <div className="psri-bot-log" ref={logRef} aria-live="polite">
        {messages.map(m => (
          <div key={m.id} className={`psri-bot-msg ${m.from}`}>
            {m.text && <p className="psri-bot-text">{m.text}</p>}

            {m.topic && (
              <div className="psri-bot-card">
                <div className="psri-bot-card-head">
                  <span>{m.topic.icon}</span>
                  <strong>{m.topic.label}</strong>
                  <em>{m.topic.who}</em>
                </div>
                {m.topic.summary && <p className="psri-bot-text">{m.topic.summary}</p>}
                <ol className="psri-bot-steps">
                  {m.topic.steps.map((s, i) => (
                    // Index is the identity here — the steps are static content.
                    <li key={i}>
                      <span className="psri-bot-n">{i + 1}</span>
                      <span>{bold(s)}</span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="psri-btn-ghost psri-bot-open"
                  onClick={() => onOpenTopic(m.topic.key)}
                >
                  {openKey === m.topic.key ? 'Open below ↑' : 'Show the full guide'}
                </button>
              </div>
            )}

            {m.topics && (
              <div className="psri-bot-topics">
                {m.topics.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    className="psri-chip-btn"
                    onClick={() => onOpenTopic(t.key)}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {messages.length === 1 && (
        <div className="psri-bot-suggests">
          {SUGGESTIONS.map(s => (
            <button key={s} type="button" className="psri-chip-btn" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="psri-bot-input">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="Ask how to do something…"
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Ask the support assistant"
        />
        <button type="button" className="psri-btn-primary" onClick={() => ask(value)}>
          Ask
        </button>
      </div>
    </section>
  );
}