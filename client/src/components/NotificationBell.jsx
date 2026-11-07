import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { timeAgo } from '../utils/format';

const LABELS = { YOUR_TURN: 'Your turn', ITEM_LOW: 'Running low', RUN_OUT_SOON: 'Heads up' };

export default function NotificationBell() {
  const {
    count, items, status, hasMore, loadingMore, loadList, loadMore, markRead, markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  // While open: refresh the list, close on outside click, close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    loadList();

    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus(); // hand focus back so keyboard users aren't lost
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, loadList]);

  function handleOpenItem(notification) {
    markRead(notification); // the provider lives above the pages, so this finishes after navigating
    setOpen(false);
    navigate(`/items/${notification.itemId}`);
  }

  async function handleMarkAll() {
    setError(null);
    try {
      await markAllRead();
    } catch {
      setError('Could not mark them as read. Try again.');
    }
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        className="bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="bell-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Notifications</strong>
            <button className="link-btn" onClick={handleMarkAll} disabled={count === 0}>
              Mark all read
            </button>
          </div>

          {error && <div className="alert" role="alert">{error}</div>}
          {status === 'loading' && <p className="muted notif-empty">Loading…</p>}
          {status === 'error' && <p className="muted notif-empty">Couldn't load notifications.</p>}
          {status === 'ready' && items.length === 0 && (
            <p className="muted notif-empty">You're all caught up.</p>
          )}

          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  className={`notif-item ${n.read ? '' : 'notif-unread'}`}
                  onClick={() => handleOpenItem(n)}
                >
                  <span className="notif-tag">{LABELS[n.type] || 'Update'}</span>
                  <span className="notif-msg">{n.message}</span>
                  <span className="muted small">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>

          {hasMore && (
            <button className="link-btn notif-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Show older'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
