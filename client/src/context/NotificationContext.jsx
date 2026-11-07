import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as notificationsApi from '../api/notifications';

export const NotificationContext = createContext(null);

const POLL_MS = 60_000;
const MIN_GAP_MS = 5_000; // never check more often than this when switching tabs
const PAGE_SIZE = 10;

export function NotificationProvider({ children }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [cursor, setCursor] = useState(null);   // where the next page starts, or null
  const [loadingMore, setLoadingMore] = useState(false);

  const alive = useRef(true);
  const countSeq = useRef(0);  // numbers count requests: only the newest may update the badge
  const lastCheck = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const refreshCount = useCallback(async () => {
    const mine = ++countSeq.current;
    lastCheck.current = Date.now();
    try {
      const n = await notificationsApi.unreadCount();
      if (alive.current && mine === countSeq.current) setCount(n);
    } catch { /* a failed background check isn't worth showing */ }
  }, []);

  // Check every ~60s, but ONLY while the tab is visible. A hidden tab makes no requests.
  useEffect(() => {
    let stopped = false;
    let timer;

    const next = () => POLL_MS + Math.random() * 10_000; // random extra spreads users out
    const tick = async () => {
      if (document.visibilityState === 'visible') await refreshCount();
      if (!stopped) timer = setTimeout(tick, next());
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck.current > MIN_GAP_MS) {
        refreshCount();
      }
    };

    refreshCount();
    timer = setTimeout(tick, next());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true; // without this, a pending tick could start a new timer after unmount
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshCount]);

  // Called each time the dropdown opens.
  const loadList = useCallback(async () => {
    // Keep showing the old list while refreshing, instead of flashing a spinner.
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const page = await notificationsApi.list({ limit: PAGE_SIZE });
      if (!alive.current) return;
      countSeq.current += 1; // this answer is newer than any count check in flight
      setItems(page.notifications);
      setCursor(page.nextCursor);
      setCount(page.unreadCount);
      setStatus('ready');
    } catch {
      if (alive.current) setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notificationsApi.list({ limit: PAGE_SIZE, before: cursor });
      if (!alive.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.notifications.filter((n) => !seen.has(n.id))];
      });
      setCursor(page.nextCursor);
    } catch { /* the "Show older" button stays, so they can try again */ }
    finally { if (alive.current) setLoadingMore(false); }
  }, [cursor, loadingMore]);

  const markRead = useCallback(async (notification) => {
    if (notification.read) return;
    try {
      await notificationsApi.markRead(notification.id);
      if (!alive.current) return;
      countSeq.current += 1;
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      setCount((c) => Math.max(0, c - 1));
    } catch { /* leave it unread, so the badge stays truthful */ }
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead(); // errors go to the caller, which shows a message
    if (!alive.current) return;
    countSeq.current += 1;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setCount(0);
  }, []);

  const value = useMemo(
    () => ({
      count, items, status, hasMore: cursor !== null, loadingMore,
      loadList, loadMore, markRead, markAllRead,
    }),
    [count, items, status, cursor, loadingMore, loadList, loadMore, markRead, markAllRead]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
