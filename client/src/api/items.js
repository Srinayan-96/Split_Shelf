import api from './client';

const base = (householdId) => `/households/${householdId}/items`;

export const list = (hid) => api.get(base(hid)).then((r) => r.data.items);
export const create = (hid, body) => api.post(base(hid), body).then((r) => r.data.item);
export const detail = (hid, id) => api.get(`${base(hid)}/${id}`).then((r) => r.data); // { item, history }
export const markLow = (hid, id, body = {}) => api.post(`${base(hid)}/${id}/low`, body).then((r) => r.data); // { item, changed }
export const markBought = (hid, id, body) =>
  api.post(`${base(hid)}/${id}/bought`, body).then((r) => r.data); // { item, replayed }
export const remove = (hid, id) => api.delete(`${base(hid)}/${id}`).then((r) => r.data);
