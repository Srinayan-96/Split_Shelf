// Same person always lands on the same slot. The slot's actual color
// changes with the theme, in CSS, so light and dark stay in their own palette.
export function hueIndex(key) {
  const s = String(key || 'member');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 8;
}
