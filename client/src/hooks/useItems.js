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

  // See other people's changes when you come back to the tab, without polling.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_MIN_GAP_MS) {
        load({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // The server answers every action with the full updated item, so we just swap it in.
  const replaceItem = useCallback((updated) => {
    seq.current += 1; // a list request still in flight is now older than this answer
    setItems((prev) => sortItems(prev.map((i) => (i.id === updated.id ? updated : i))));
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
