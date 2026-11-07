// A unique id for ONE "I bought this" intent. The backend uses it to recognise
// a retry of the same tap. crypto.randomUUID only exists on https or localhost,
// so there is a fallback that is still unique enough.
export function newKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
