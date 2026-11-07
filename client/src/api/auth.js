import api from './client';

export const register = (body) => api.post('/auth/register', body).then((r) => r.data);
export const login = (body) => api.post('/auth/login', body).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data.user);
