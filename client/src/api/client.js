import axios from 'axios';

export const TOKEN_KEY = 'splitshelf_token';

// localStorage can throw (private mode, blocked storage), so every access is wrapped.
export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 45000, // generous on purpose: a sleeping free-tier server needs time to wake up
});

// Attach the token to every request, so no page ever has to remember to.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// The AuthContext registers a function here that logs the user out.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isLoginAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    // A 401 on a normal request means the token expired or is invalid: log out.
    // A 401 on login just means "wrong password", which the form should show.
    if (error.response?.status === 401 && !isLoginAttempt) onUnauthorized();
    return Promise.reject(error);
  }
);

// Turns any axios error into { message, fields } that forms can display.
// Matches the backend's shape: { message, details: [{ field, message }] }.
export function parseApiError(error) {
  if (!error.response) {
    return { message: 'Cannot reach the server. Check your connection.', fields: {} };
  }
  const { message, details } = error.response.data || {};
  const fields = {};
  (details || []).forEach((d) => {
    if (d.field && !fields[d.field]) fields[d.field] = d.message;
  });
  return { message: message || 'Something went wrong', fields };
}

export default api;
