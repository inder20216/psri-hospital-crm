import { useCallback, useEffect, useRef, useState } from 'react';
import { psri } from '../../api/psri';

const POLL_MS = 5000;

function timeLabel(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// In-CRM WhatsApp conversation (Meta Cloud API). Shows a department group or a
// 1:1 thread and lets the agent reply without leaving the case form. New
// messages arrive from the backend, which receives them via the WhatsApp
// webhook — so the panel just polls the stored thread.
export default function WaChatPanel({ threadId, title, caseId, onClose }) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [pos, setPos] = useState(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const drag = useRef(null);
  const atBottom = useRef(true);

  const load = useCallback(async (silent) => {
    try {
      const res = await psri.getWaThread(threadId, title, caseId);
      if (res && res.success) {
        setThread(res.thread);
        setMessages(res.messages || []);
        setError('');
      } else {
        setError((res && res.error) || 'Could not load this conversation.');
      }
    } catch (e) {
      if (!silent) setError(e.message || 'Could not reach the WhatsApp service.');
    }
  }, [threadId, title, caseId]);

  // Anchor bottom-right of the viewport when opening a conversation.
  useEffect(() => {
    setPos({
      left: Math.max(12, window.innerWidth - 412),
      top: Math.max(12, window.innerHeight - 520),
    });
  }, [threadId]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Keep the newest message in view unless the agent scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await psri.sendWaMessage({ threadId, message: text, title });
      if (res && res.success) {
        setDraft('');
        atBottom.current = true;
        if (res.message) setMessages(prev => [...prev, res.message]);
        else load(true);
      } else {
        setError((res && res.error) || 'Message could not be sent.');
      }
    } catch (e) {
      setError(e.message || 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Drag the panel by its header ───────────────────────────────────────────
  const startDrag = (e) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e) => {
      if (!drag.current) return;
      const w = panelRef.current?.offsetWidth || 400;
      setPos({
        left: Math.min(Math.max(4 - w + 60, e.clientX - drag.current.dx), window.innerWidth - 60),
        top: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 40),
      });
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const heading = thread?.title || title || 'WhatsApp';

  return (
    <div
      ref={panelRef}
      className="wa-float wa-chat"
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      role="dialog"
      aria-label={`WhatsApp ${heading}`}
    >
      <div className="wa-float-head" onPointerDown={startDrag}>
        <span className="wa-float-dot" />
        <span className="wa-float-title">{heading}</span>
        <button type="button" className="wa-float-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="wa-chat-list" ref={listRef} onScroll={onScroll}>
        {error && <div className="wa-chat-error">{error}</div>}
        {!error && messages.length === 0 && (
          <div className="wa-chat-empty">No messages yet. Anything sent to this chat appears here.</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`wa-chat-msg ${m.direction === 'out' ? 'out' : 'in'}`}>
            {m.direction === 'in' && m.senderName ? <div className="wa-chat-who">{m.senderName}</div> : null}
            <div className="wa-chat-bubble">{m.body}</div>
            <div className="wa-chat-meta">
              {timeLabel(m.at)}
              {m.direction === 'out' && m.status ? ` · ${m.status}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="wa-chat-compose">
        <textarea
          className="wa-chat-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a message…"
          rows={2}
        />
        <button type="button" className="psri-btn-primary" onClick={send} disabled={sending || !draft.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
