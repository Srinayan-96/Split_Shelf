import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as householdApi from '../api/households';
import { parseApiError } from '../api/client';

export const HouseholdContext = createContext(null);

export function HouseholdProvider({ children }) {
  const [household, setHousehold] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null);

  // Don't update state after this provider has been removed (for example, after logout).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const mine = await householdApi.getMine();
      if (!alive.current) return;
      setHousehold(mine);
      setStatus('ready');
    } catch (err) {
      if (!alive.current) return;
      setLoadError(parseApiError(err).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-reads the household WITHOUT showing the loading screen, so a form
  // someone is typing in isn't wiped. Used to recover from stale state.
  const sync = useCallback(async () => {
    try {
      const mine = await householdApi.getMine();
      if (alive.current) setHousehold(mine);
    } catch { /* best effort */ }
  }, []);

  // 409 means "you're already in a household" or "it's full". If this tab's
  // view is out of date (you joined from another tab), sync() fixes it.
  const guard = useCallback(async (action) => {
    try {
      return await action();
    } catch (err) {
      if (err.response?.status === 409) await sync();
      throw err;
    }
  }, [sync]);

  const create = useCallback(
    (body) => guard(async () => setHousehold(await householdApi.create(body))),
    [guard]
  );
  const join = useCallback(
    (body) => guard(async () => setHousehold(await householdApi.join(body))),
    [guard]
  );
  const leave = useCallback(async () => {
    await householdApi.leave(household.id);
    setHousehold(null);
  }, [household]);
  const regenerateCode = useCallback(
    async () => setHousehold(await householdApi.regenerateCode(household.id)),
    [household]
  );

  const value = useMemo(
    () => ({ household, status, loadError, reload: load, create, join, leave, regenerateCode }),
    [household, status, loadError, load, create, join, leave, regenerateCode]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
