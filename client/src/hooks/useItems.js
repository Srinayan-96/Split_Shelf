import { useCallback, useEffect, useRef, useState } from 'react';
import * as itemsApi from '../api/items';
import { parseApiError } from '../api/client';
import { sortItems } from '../utils/format';

const REFRESH_MIN_GAP_MS = 5000;

export function useItems(householdId) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);

  const seq = useRef(0);      // numbers each request; only the newest one may update the screen
  const lastLoad = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const mine = ++seq.current;
      if (!silent) setStatus('loading');
      try {
        const list = await itemsApi.list(householdId);
        if (!alive.current || mine !== seq.current) return; // an older answer, ignore it
        setItems(sortItems(list));
        setError(null);
        setStatus('ready');
        lastLoad.current = Date.now();
      } catch (err) {
        if (!alive.current || mine !== seq.current) return;
        if (!silent) { // a failed background refresh shouldn't replace a working screen
          setError(parseApiError(err).message);
          setStatus('error');
        }
      }
    },
    [householdId]
  );

  useEffect(() => { load(); }, [load]);

  // Keep live items in sync across browsers and roommates
  useEffect(() => {
    let timer;
    const intervalMs = 5000;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
      timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, intervalMs);

    const onSync = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 1500) {
        load({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onSync);
    window.addEventListener('focus', onSync);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onSync);
      window.removeEventListener('focus', onSync);
    };
  }, [load]);

  // The server answers every action with the full updated item, so we just swap it in.
  const replaceItem = useCallback((updated) => {
    if (!updated) return;
    seq.current += 1;
    setItems((prev) => {
      const exists = prev.some((i) => String(i.id) === String(updated.id));
      if (exists) {
        return sortItems(
          prev.map((i) => (String(i.id) === String(updated.id) ? { ...i, ...updated } : i))
        );
      }
      return sortItems([...prev, updated]);
    });
  }, []);

  // If an admin deleted the item while we were looking at it, refresh the list.
  const resyncOn404 = useCallback(
    (err) => {
      if (err.response?.status === 404) load({ silent: true });
      throw err;
    },
    [load]
  );

  const addItem = useCallback(
    async (body) => {
      const created = await itemsApi.create(householdId, body);
      seq.current += 1;
      setItems((prev) => sortItems([...prev, created]));
    },
    [householdId]
  );

  const markLow = useCallback(
    async (itemId) => {
      const { item, changed } = await itemsApi.markLow(householdId, itemId).catch(resyncOn404);
      replaceItem(item);
      return { changed };
    },
    [householdId, replaceItem, resyncOn404]
  );

  const markBought = useCallback(
    async (itemId, idempotencyKey, details = {}) => {
      const { item, replayed } = await itemsApi
        .markBought(householdId, itemId, { idempotencyKey, ...details })
        .catch(resyncOn404);
      replaceItem(item);
      return { replayed };
    },
    [householdId, replaceItem, resyncOn404]
  );

  return { items, status, error, reload: load, addItem, markLow, markBought };
}
