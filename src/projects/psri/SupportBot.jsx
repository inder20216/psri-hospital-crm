import { useEffect, useRef, useState } from 'react';
import { findTopic, SUGGESTIONS } from './supportContent';

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

/**
 * Support assistant.
 *
 * Answers from supportContent.js — the same text the how-to guides on this page
 * are built from, plus the reference notes. No network call, no API key, and
 * nothing it can say that isn't written there. When it does not recognise a
 * question it says so and lists what it does know, rather than guessing.
 */
export default function SupportBot({ openKey, onOpenTopic }) {
  const [messages, setMessages] = useState([
    {
      id: 'hello',
      from: 'bot',
      text: 'Ask me anything about the CRM — how to do something (“how do I create a case?”), or what something means (“which desk gets the alert?”, “what does Resolved mean?”).',
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
      ? { id: `a${q}`, from: 'bot', topic: hit.entry, kind: hit.kind }
      : {
        id: `a${q}`,
        from: 'bot',
        // No match: say so and stop. Listing every topic as a chip here just
        // repeated the how-to list sitting directly underneath the chat.
        text: 'I do not have an answer for that one yet. Try one of the questions below, or open the guide you need from the list underneath.',
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
          <div className="psri-bot-sub">How-to guides, plus what everything means</div>
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

                {/* Only a how-to has a matching dropdown to open. */}
                {m.kind === 'howto' && (
                  <button
                    type="button"
                    className="psri-btn-ghost psri-bot-open"
                    onClick={() => onOpenTopic(m.topic.key)}
                  >
                    {openKey === m.topic.key ? 'Open below ↑' : 'Show the full guide'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* The question menu stays put at all times, so there is always somewhere
          to go next without typing. */}
      <div className="psri-bot-suggests">
        {SUGGESTIONS.map(s => (
          <button key={s} type="button" className="psri-chip-btn" onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="psri-bot-input">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="Ask anything about the CRM…"
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