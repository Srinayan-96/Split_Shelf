import api from './client';

const base = (hid) => `/households/${hid}/history`;

export const people = (hid) => api.get(`${base(hid)}/people`).then((r) => r.data.people);
export const person = (hid, userId) => api.get(`${base(hid)}/people/${userId}`).then((r) => r.data);
export const feed = (hid, params) => api.get(`${base(hid)}/feed`, { params }).then((r) => r.data);
