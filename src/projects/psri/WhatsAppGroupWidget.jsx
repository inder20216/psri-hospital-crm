import { useCallback, useEffect, useMemo, useState } from 'react';
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
// "Open group" simply opens the group's invite link in a new window — WhatsApp
// blocks being framed (X-Frame-Options: DENY), so there is nothing to embed
// inside the CRM. If a desk is mapped to a WhatsApp Cloud API target (a
// Groups-API group id or a phone number), "Open chat" instead shows the real
// conversation in a floating panel inside the CRM.
export default function WhatsAppGroupWidget({ form }) {
  const { getList } = usePicklists();
  const [copiedId, setCopiedId] = useState('');
  const [chatId, setChatId] = useState('');

  const groups = useMemo(() => resolveWhatsAppGroups(form), [form]);
  const resolved = useMemo(
    () => groups.map(g => ({
      ...g,
      url: groupInviteLink(g.id, getList, g.kind),
      apiTarget: groupApiTarget(g.id, getList),
    })),
    [groups, getList],
  );

  const chatGroup = resolved.find(g => g.apiTarget === chatId) || null;

  // Close the chat panel if the case stops routing to that group.
  useEffect(() => {
    if (chatId && !resolved.some(g => g.apiTarget === chatId)) setChatId('');
  }, [resolved, chatId]);

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

  // Just open the WhatsApp group in a new window.
  const openGroup = (group) => {
    if (!group.url) return;
    window.open(group.url, '_blank', 'noopener,noreferrer');
  };

  // Opens the real WhatsApp conversation (Cloud API) inside the CRM.
  const openChat = (group) => {
    if (!group.apiTarget) return;
    setChatId(group.apiTarget);
  };

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
