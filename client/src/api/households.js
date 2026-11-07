import api from './client';

export const getMine = () => api.get('/households/mine').then((r) => r.data.household);
export const create = (body) => api.post('/households', body).then((r) => r.data.household);
export const join = (body) => api.post('/households/join', body).then((r) => r.data.household);
export const leave = (id) => api.post(`/households/${id}/leave`).then((r) => r.data);
export const regenerateCode = (id) =>
  api.post(`/households/${id}/invite-code`).then((r) => r.data.household);
