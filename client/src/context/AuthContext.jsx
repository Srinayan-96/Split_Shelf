import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import { setUnauthorizedHandler, tokenStore, TOKEN_KEY } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // True until we know whether a saved token is still valid. Without this,
  // a logged-in user would see the login page flash on every refresh.
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    let cancelled = false; // ignore the answer if the component unmounted meanwhile

    if (!tokenStore.get()) {
      setLoading(false);
    } else {
      authApi
        .getMe()
        .then((me) => { if (!cancelled) setUser(me); })
        .catch(() => { /* a 401 already logged us out via the interceptor */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    // Logging out in one browser tab logs out the others too.
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY && !e.newValue) setUser(null);
    };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, [logout]);

  const login = useCallback(async (credentials) => {
    const { user: me, token } = await authApi.login(credentials);
    tokenStore.set(token);
    setUser(me);
  }, []);

  const register = useCallback(async (details) => {
    const { user: me, token } = await authApi.register(details);
    tokenStore.set(token);
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
