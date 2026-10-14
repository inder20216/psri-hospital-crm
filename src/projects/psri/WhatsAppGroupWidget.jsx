import { useCallback, useMemo, useState } from 'react';
import { usePicklists } from '../../context/PicklistsContext';
import {
  resolveWhatsAppGroups,
  groupInviteLink,
  groupApiTarget,
  buildGroupMessage,
} from './whatsappGroups';

// Department WhatsApp groups for a case.
//
// WhatsApp is never embedded in the CRM: "Open group" just opens the group (or
// a 1:1 chat for a phone number) in a new WhatsApp window. WhatsApp blocks being
// framed (X-Frame-Options: DENY), so there is nothing to render inline.
export default function WhatsAppGroupWidget({ form }) {
  const { getList } = usePicklists();
  const [copiedId, setCopiedId] = useState('');

  const groups = useMemo(() => resolveWhatsAppGroups(form), [form]);
  const resolved = useMemo(
    () => groups.map(g => {
      const url = groupInviteLink(g.id, getList, g.kind);
      const apiTarget = groupApiTarget(g.id, getList);
      const phone = /^wa:/.test(apiTarget) ? apiTarget.slice(3).replace(/\D+/g, '') : '';
      return {
        ...g,
        url,
        // Where "Open group" sends the agent: the invite link, or a wa.me chat
        // for a phone-number target. A bare Cloud API group id has no app link.
        openUrl: url || (phone ? `https://wa.me/${phone}` : ''),
      };
    }),
    [groups, getList],
  );

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

  // Just open WhatsApp in a new window.
  const openGroup = (group) => {
    if (!group.openUrl) return;
    window.open(group.openUrl, '_blank', 'noopener,noreferrer');
  };

  return (
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
                {g.openUrl ? (
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
  );
}
