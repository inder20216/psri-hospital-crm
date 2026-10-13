import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePicklists } from '../../context/PicklistsContext';
import {
  resolveWhatsAppGroups,
  groupInviteLink,
  groupApiTarget,
  buildGroupMessage,
} from './whatsappGroups';
import WaChatPanel from './WaChatPanel';

// Department WhatsApp groups for a case.
//
// If a desk is mapped to a WhatsApp Cloud API target (a Groups-API group id or a
// phone number), "Open chat" shows the real conversation in a floating panel
// inside the CRM — no new tab, no iframe. Otherwise it falls back to the group
// invite link: WhatsApp blocks being framed (X-Frame-Options: DENY), so that
// path keeps the copy-message + same-window open panel.
export default function WhatsAppGroupWidget({ form }) {
  const { getList } = usePicklists();
  const [copiedId, setCopiedId] = useState('');
  const [floatingId, setFloatingId] = useState('');
  const [chatId, setChatId] = useState('');
  const [pos, setPos] = useState(null);
  const drag = useRef(null);
  const panelRef = useRef(null);

  const groups = useMemo(() => resolveWhatsAppGroups(form), [form]);
  const resolved = useMemo(
    () => groups.map(g => ({
      ...g,
      url: groupInviteLink(g.id, getList, g.kind),
      apiTarget: groupApiTarget(g.id, getList),
    })),
    [groups, getList],
  );

  const floating = resolved.find(g => g.id === floatingId) || null;
  const chatGroup = resolved.find(g => g.apiTarget === chatId) || null;

  // Close a panel if the case stops routing to that group.
  useEffect(() => {
    if (floatingId && !resolved.some(g => g.id === floatingId)) setFloatingId('');
    if (chatId && !resolved.some(g => g.apiTarget === chatId)) setChatId('');
  }, [resolved, floatingId, chatId]);

  const copyText = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  }, []);

  const copyUpdate = async (group) => {
    await copyText(buildGroupMessage(form, group));
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const openGroup = (group) => {
    if (!group.url) return;
    // Anchor bottom-right of the viewport the first time it opens.
    setPos(prev => prev || {
      left: Math.max(12, window.innerWidth - 412),
      top: Math.max(12, window.innerHeight - 552),
    });
    setFloatingId(group.id);
  };

  // Opens the real WhatsApp conversation (Cloud API) inside the CRM.
  const openChat = (group) => {
    if (!group.apiTarget) return;
    setFloatingId('');
    setChatId(group.apiTarget);
  };

  // ── Drag the floating panel by its header ──────────────────────────────────
  const startDrag = (e) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e) => {
      if (!drag.current) return;
      const w = panelRef.current?.offsetWidth || 360;
      const h = panelRef.current?.offsetHeight || 400;
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

  return (
    <>
      <div className="psri-wa-widget">
        <div className="psri-wa-widget-head">
          <span className="psri-wa-widget-icon">💬</span>
          <div>
            <div className="psri-wa-widget-title">WhatsApp group</div>
            <div className="psri-wa-widget-sub">
              {resolved.length > 0
                ? 'This case routes to the department group(s) below.'
                : 'No department group is mapped to this case yet.'}
            </div>
          </div>
        </div>

        {resolved.length === 0 ? (
          <p className="psri-wa-empty">
            Fill in Call Back, High Value or Complaint / Feedback details to route this case to a
            department group.
          </p>
        ) : (
          <div className="psri-wa-group-list">
            {resolved.map(g => (
              <div key={g.id} className="psri-wa-group-row">
                <div className="psri-wa-group-info">
                  <strong>{g.label}</strong>
                  <span className="psri-wa-group-reason">{g.reason}</span>
                </div>
                <div className="psri-wa-group-actions">
                  {g.apiTarget ? (
                    <button type="button" className="psri-btn-primary psri-wa-open-btn" onClick={() => openChat(g)}>
                      Open chat →
                    </button>
                  ) : g.url ? (
                    <button type="button" className="psri-btn-primary psri-wa-open-btn" onClick={() => openGroup(g)}>
                      Open group →
                    </button>
                  ) : (
                    <span className="psri-wa-nolink" title="Add this group in Admin → Picklists → WhatsApp Groups">
                      Link not set
                    </span>
                  )}
                  <button type="button" className="psri-btn-ghost" onClick={() => copyUpdate(g)}>
                    {copiedId === g.id ? 'Copied ✓' : 'Copy update'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {floating && (
        <div
          ref={panelRef}
          className="wa-float wa-float--frame"
          style={pos ? { left: pos.left, top: pos.top } : undefined}
          role="dialog"
          aria-label={`WhatsApp group ${floating.label}`}
        >
          <div className="wa-float-head" onPointerDown={startDrag}>
            <span className="wa-float-dot" />
            <span className="wa-float-title">{floating.label}</span>
            <button type="button" className="wa-float-close" onClick={() => setFloatingId('')} aria-label="Close">✕</button>
          </div>
          <div className="wa-float-reason">{floating.reason}</div>
          <iframe
            key={floating.id}
            className="wa-float-frame"
            src={floating.url}
            title={`WhatsApp group ${floating.label}`}
            referrerPolicy="no-referrer"
          />
          <div className="wa-float-actions">
            <span className="wa-float-hint">
              Panel blank? WhatsApp blocks being framed, so open it here instead.
            </span>
            <button type="button" className="psri-btn-ghost" onClick={() => copyUpdate(floating)}>
              {copiedId === floating.id ? 'Copied ✓' : 'Copy message'}
            </button>
            <button type="button" className="psri-btn-primary" onClick={() => window.location.assign(floating.url)}>
              Open in WhatsApp →
            </button>
          </div>
        </div>
      )}

      {chatGroup && (
        <WaChatPanel
          threadId={chatGroup.apiTarget}
          title={chatGroup.label}
          onClose={() => setChatId('')}
        />
      )}
    </>
  );
}
