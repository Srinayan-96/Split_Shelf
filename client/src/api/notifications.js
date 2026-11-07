import api from './client';

// params with undefined values are dropped by axios, so `before` is optional
export const list = (params) => api.get('/notifications', { params }).then((r) => r.data);
export const unreadCount = () => api.get('/notifications/unread-count').then((r) => r.data.unreadCount);
export const markRead = (id) => api.post(`/notifications/${id}/read`).then((r) => r.data);
export const markAllRead = () => api.post('/notifications/read-all').then((r) => r.data);
