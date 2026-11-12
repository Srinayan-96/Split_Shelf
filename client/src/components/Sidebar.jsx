import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import { useConfirm } from '../hooks/useConfirm';
import PersonName from './PersonName';
import AddItemModal from './AddItemModal';

export default function Sidebar({ itemsCount, onAddItem, isDrawerOpen, onCloseDrawer }) {
  const { user, logout } = useAuth();
  const { household, leave, regenerateCode } = useHousehold();
  const confirm = useConfirm();

  const [copyState, setCopyState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const me = household?.members?.find((m) => m.id === user.id);
  const isAdmin = me?.role === 'admin';
  const isLastMember = household?.members?.length === 1;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household?.inviteCode || '');
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }

  async function handleNewCode() {
    if (busy) return;
    const ok = await confirm({
      title: 'Create a new invite code?',
      message: 'The old code will stop working straight away.',
      confirmLabel: 'Create new code',
    });
    if (!ok) return;

    setBusy(true);
    try {
      await regenerateCode();
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (busy) return;
    const ok = await confirm({
      title: 'Leave this household?',
      message: isLastMember
        ? 'You are the last member. Leaving will DELETE this household and everything in it.'
        : 'You can rejoin later with the invite code.',
      confirmLabel: 'Leave',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await leave();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {isDrawerOpen && (
        <button
          className="drawer-backdrop"
          onClick={onCloseDrawer}
          aria-label="Close navigation sidebar"
        />
      )}

      <aside className={`app-sidebar ${isDrawerOpen ? 'drawer-open' : ''}`}>
        {/* 1. Brand row */}
        <div className="sidebar-brand-row">
          <div className="brand-mark-group">
            <span className="logo-4square" aria-hidden="true">
              <span className="sq sq-accent" />
              <span className="sq sq-text" />
              <span className="sq sq-text" />
              <span className="sq sq-accent" />
            </span>
            <span className="brand-text">Split Shelf</span>
          </div>
          {isDrawerOpen && (
            <button
              className="chevron-btn"
              onClick={onCloseDrawer}
              aria-label="Collapse sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* 2. Primary button: + Add item */}
        <button
          className="btn sidebar-add-btn"
          onClick={() => setAddModalOpen(true)}
        >
          + Add item
        </button>

        {/* 3 & 4. GENERAL Nav links */}
        <div className="sidebar-nav-section">
          <span className="sidebar-section-label">GENERAL</span>
          <nav className="sidebar-nav" aria-label="Main">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onCloseDrawer}
            >
              <span className="nav-icon-label">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Shelf</span>
              </span>
              {typeof itemsCount === 'number' && (
                <span className="sidebar-count-pill">{itemsCount}</span>
              )}
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onCloseDrawer}
            >
              <span className="nav-icon-label">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>History</span>
              </span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onCloseDrawer}
              >
                <span className="nav-icon-label">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18M3 9h18" />
                  </svg>
                  <span>Admin</span>
                </span>
              </NavLink>
            )}
          </nav>
        </div>

        {/* 5. MEMBERS Section */}
        <div className="sidebar-members-section">
          <span className="sidebar-section-label">
            {household?.name ? `${household.name.toUpperCase()} MEMBERS` : 'MEMBERS'}
          </span>
          <ul className="sidebar-members-list">
            {household?.members?.map((m) => (
              <li key={m.id} className="sidebar-member-row">
                <div className="member-avatar-name">
                  <PersonName id={m.id} name={m.name} suffix={m.id === user?.id ? ' (you)' : ''} />
                </div>
                {m.role === 'admin' && (
                  <span className="badge badge-accent member-admin-badge">admin</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 6. Bottom card & actions */}
        <div className="sidebar-bottom">
          <div className="invite-code-card">
            <span className="sidebar-section-label" style={{ marginBottom: '4px', display: 'block' }}>
              INVITE CODE
            </span>
            <div className="code-box-row">
              <code className="invite-code">{household?.inviteCode || '--------'}</code>
            </div>
            <div className="invite-actions-row">
              <button
                className="btn btn-secondary btn-small"
                onClick={copyCode}
                style={{ flex: 1 }}
              >
                {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Ctrl+C' : 'Copy'}
              </button>
              {isAdmin && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={handleNewCode}
                  disabled={busy}
                >
                  New code
                </button>
              )}
            </div>
          </div>

          <div className="sidebar-footer-buttons">
            <button
              className="btn btn-secondary sidebar-logout-btn"
              onClick={handleLeave}
              disabled={busy}
              style={{ fontSize: '0.82rem' }}
            >
              Leave household
            </button>
            <button
              className="btn btn-secondary sidebar-logout-btn"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Shared Add Item Modal */}
      {addModalOpen && (
        <AddItemModal
          onClose={() => setAddModalOpen(false)}
          onAdd={async (body) => {
            if (onAddItem) await onAddItem(body);
            setAddModalOpen(false);
          }}
        />
      )}
    </>
  );
}

