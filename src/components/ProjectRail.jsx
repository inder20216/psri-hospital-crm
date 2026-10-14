import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PROJECTS } from '../projects/registry';
import { useAuth } from '../context/AuthContext';
import { psri } from '../api/psri';
import { countUnseen } from '../projects/psri/suggestionsSeen';
import './ProjectRail.css';

const SUGGESTIONS_POLL_MS = 60000;

// Below this width the rail turns into a slide-in drawer behind a top bar
// (ProjectRail.css uses the same number). Kept under 780px on purpose: a
// 1366px laptop at 175% scaling is ~780 CSS px and should keep its rail.
const COMPACT_QUERY = '(max-width: 768px)';

function useCompact() {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return compact;
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
}

export default function ProjectRail() {
  const { pathname } = useLocation();
  const { currentUser, isSuperAdmin, isAdmin, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const compact = useCompact();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The drawer always shows labels — there is no room-saving reason to hide them.
  const labels = expanded || compact;

  // Picking a page closes the drawer. Adjusting state during render (not in an
  // effect) is React's recommended way to react to a prop/route change.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setDrawerOpen(false); }

  // Esc closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Admin: how many need a decision right now. Everyone else: how many of
  // THEIR OWN suggestions got resolved (approved/rejected) since they last
  // opened the page — a count of "new", not a queue of "to do".
  const refreshSuggestionCount = useCallback(() => {
    if (!currentUser) return;
    if (isAdmin) {
      psri.getPicklistSuggestions('pending').then(items => setSuggestionCount(items.length)).catch(() => {});
    } else {
      psri.getPicklistSuggestions('').then(items => {
        const mine = items.filter(it => it.suggestedBy === currentUser.id && it.status !== 'pending');
        setSuggestionCount(countUnseen(mine));
      }).catch(() => {});
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    refreshSuggestionCount();
    const interval = setInterval(refreshSuggestionCount, SUGGESTIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshSuggestionCount]);

  // Users only see PSRI; Super Admins see all projects
  const visibleProjects = isSuperAdmin
    ? PROJECTS
    : PROJECTS.filter(p => p.id === 'psri');

  return (
    <>
    {/* Phone / small-tablet top bar — hidden by CSS on wider screens. The
        right-hand side stays empty: the floating Doctor Lookup and Chat
        buttons sit there. */}
    <header className="rail-topbar">
      <button
        type="button"
        className="rail-burger"
        onClick={() => setDrawerOpen(o => !o)}
        aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={drawerOpen}
      >
        {drawerOpen ? '✕' : '☰'}
      </button>
      <div className="rail-logo">UC</div>
      <div className="rail-topbar-brand">PSRI CRM</div>
    </header>
    {compact && drawerOpen && <div className="rail-backdrop" onClick={() => setDrawerOpen(false)} />}

    <aside className={`rail ${expanded ? 'expanded' : ''} ${drawerOpen ? 'open' : ''}`}>
      <div className="rail-top">
        <div className="rail-logo">UC</div>
        {labels && <div className="rail-brand">Universal CRM</div>}
      </div>

      <div className="rail-projects">
        {visibleProjects.map(p => {
          const isActiveProject = pathname.startsWith(`/${p.id}`);
          return (
            <div key={p.id} className="rail-project-group">
              <Link
                to={`/${p.id}${p.modules[0].path}`}
                className={`rail-item ${isActiveProject ? 'active' : ''}`}
                style={{ '--rail-color': p.color }}
                title={p.name}
              >
                <span className="rail-icon">{p.icon}</span>
                {labels && <span className="rail-label">{p.name}</span>}
              </Link>
              {labels && isActiveProject && p.modules.filter(m => !m.hidden).length > 0 && (
                <div className="rail-submodules">
                  {p.modules.filter(m => !m.hidden).map(mod => (
                    <Link
                      key={mod.path}
                      to={`/${p.id}${mod.path}`}
                      className={`rail-subitem ${pathname === `/${p.id}${mod.path}` ? 'active' : ''}`}
                    >
                      <span className="rail-subicon">{mod.icon}</span>
                      <span>{mod.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Project — Super Admin only */}
        {isSuperAdmin && (
          <button className="rail-item rail-add" title="Add a new project (coming soon)">
            <span className="rail-icon">+</span>
            {labels && <span className="rail-label">Add Project</span>}
          </button>
        )}
      </div>

      <div className="rail-bottom">
        {/* WhatsApp notification list — Admin and Super Admin only */}
        {isAdmin && (
          <Link
            to="/psri/whatsapp"
            className={`rail-item ${pathname === '/psri/whatsapp' ? 'active' : ''}`}
            style={{ '--rail-color': '#25d366' }}
            title="WhatsApp Notifications"
          >
            <span className="rail-icon">💬</span>
            {labels && <span className="rail-label">WhatsApp</span>}
          </Link>
        )}

        {/* Support — help with the CRM, below WhatsApp */}
        <Link
          to="/psri/support"
          className={`rail-item ${pathname === '/psri/support' ? 'active' : ''}`}
          style={{ '--rail-color': '#0284c7' }}
          title="Support"
        >
          <span className="rail-icon">🎧</span>
          {labels && <span className="rail-label">Support</span>}
        </Link>

        {/* Productivity dashboard — Admin and Super Admin (TL/Manager) */}
        {isAdmin && (
          <Link
            to="/admin/productivity"
            className={`rail-item ${pathname === '/admin/productivity' ? 'active' : ''}`}
            style={{ '--rail-color': '#4338ca' }}
            title="Agent Productivity"
          >
            <span className="rail-icon">📊</span>
            {labels && <span className="rail-label">Productivity</span>}
          </Link>
        )}

        {/* Raw data export — Admin and Super Admin */}
        {isAdmin && (
          <Link
            to="/admin/reports"
            className={`rail-item ${pathname === '/admin/reports' ? 'active' : ''}`}
            style={{ '--rail-color': '#0f766e' }}
            title="Reports"
          >
            <span className="rail-icon">🧾</span>
            {labels && <span className="rail-label">Reports</span>}
          </Link>
        )}

        {/* Appreciation — Admin/Super Admin (TL) audit and approve; every other
            user sees the status of the appreciations on their own cases. */}
        {currentUser && (
          <Link
            to="/admin/appreciation"
            className={`rail-item ${pathname === '/admin/appreciation' ? 'active' : ''}`}
            style={{ '--rail-color': '#b45309' }}
            title={isAdmin ? 'Appreciation Review' : 'My Appreciations'}
          >
            <span className="rail-icon">🌟</span>
            {labels && <span className="rail-label">Appreciation</span>}
          </Link>
        )}

        {/* New picklist value approval (Admin/Super Admin) — or, for any other
            signed-in user, a read-only look at what happened to their own
            suggestions (approved/rejected/corrected). */}
        {currentUser && (
          <Link
            to="/admin/picklist-suggestions"
            className={`rail-item ${pathname === '/admin/picklist-suggestions' ? 'active' : ''}`}
            style={{ '--rail-color': '#7c3aed' }}
            title="Picklist Suggestions"
          >
            <span className="rail-icon" style={{ position: 'relative' }}>
              📋
              {suggestionCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>
                  {suggestionCount > 99 ? '99+' : suggestionCount}
                </span>
              )}
            </span>
            {labels && <span className="rail-label">Suggestions</span>}
          </Link>
        )}

        {/* Settings — Super Admin only (kept below Suggestions) */}
        {isSuperAdmin && (
          <div className="rail-project-group">
            <Link
              to="/admin/users"
              className={`rail-item ${pathname.startsWith('/admin') ? 'active' : ''}`}
              style={{ '--rail-color': '#4338ca' }}
              title="Settings"
            >
              <span className="rail-icon">⚙</span>
              {labels && <span className="rail-label">Settings</span>}
            </Link>
            {labels && pathname.startsWith('/admin') && (
              <div className="rail-submodules">
                <Link to="/admin/users" className={`rail-subitem ${pathname === '/admin/users' ? 'active' : ''}`}>
                  <span className="rail-subicon">👤</span><span>Users</span>
                </Link>
                <Link to="/admin/picklists" className={`rail-subitem ${pathname === '/admin/picklists' ? 'active' : ''}`}>
                  <span className="rail-subicon">☰</span><span>Picklists</span>
                </Link>
                <Link to="/admin/dependencies" className={`rail-subitem ${pathname === '/admin/dependencies' ? 'active' : ''}`}>
                  <span className="rail-subicon">🔗</span><span>Dependencies</span>
                </Link>
                <Link to="/admin/workflows" className={`rail-subitem ${pathname === '/admin/workflows' ? 'active' : ''}`}>
                  <span className="rail-subicon">🔀</span><span>Workflows</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Logged-in user avatar + logout */}
        {currentUser && (
          <button
            className="rail-item rail-user-btn"
            title={labels ? '' : `${currentUser.name}\n${currentUser.role}\nClick to sign out`}
            onClick={logout}
            style={{ '--rail-color': '#0d9488', cursor: 'pointer' }}
          >
            <span className="rail-icon rail-avatar">{initials(currentUser.name)}</span>
            {labels && (
              <span className="rail-user-info">
                <span className="rail-user-name">{currentUser.name}</span>
                <span className="rail-user-role">{currentUser.role} · Sign out</span>
              </span>
            )}
          </button>
        )}

        <button className="rail-toggle" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '‹' : '›'}
        </button>
      </div>
    </aside>
    </>
  );
}
