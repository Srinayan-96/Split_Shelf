const DAY_MS = 24 * 60 * 60 * 1000;

// Same ordering as the backend: low first, then soonest to run out, then A-Z.
// Needed here because an item changes locally (e.g. becomes low) and must move up.
export function sortItems(items) {
  const rank = (i) => (i.status === 'low' ? 0 : 1);
  const when = (i) => (i.predictedRunOutAt ? new Date(i.predictedRunOutAt).getTime() : Infinity);
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || when(a) - when(b) || a.name.localeCompare(b.name)
  );
}

export function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now'; // also covers small clock differences
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

// Worked out from the date every time it's shown, so it never goes stale
// like a "days left" number saved on the server would.
export function runOutInfo(predictedRunOutAt) {
  if (!predictedRunOutAt) return null;
  const days = Math.ceil((new Date(predictedRunOutAt).getTime() - Date.now()) / DAY_MS);
  if (days <= 0) return { text: 'Probably running out now', urgent: true };
  if (days === 1) return { text: 'Runs out tomorrow', urgent: true };
  return { text: `Runs out in about ${days} days`, urgent: days <= 3 };
}

// ---------- money, dates, quantities ----------

// Parses what a person types ("49", "49.5", "1,250.00") into whole paise WITHOUT
// floating-point maths. 49.5 -> 4950. Returns { value } (null if empty) or { error }.
export function rupeesToPaise(text) {
  const cleaned = String(text ?? '').trim().replace(/,/g, '');
  if (cleaned === '') return { value: null };
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return { error: 'Enter an amount like 49 or 49.50' };
  const [whole, fraction = ''] = cleaned.split('.');
  return { value: Number(whole) * 100 + Number(fraction.padEnd(2, '0')) };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2,
});
// Dividing is fine here: this is only for DISPLAY. The stored value stays whole paise.
export const formatMoney = (paise) => (paise == null ? 'No price' : inr.format(paise / 100));

export const formatQty = (quantity) => String(Number(Number(quantity).toFixed(3)));

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// "Today", "Yesterday", or the date. Compares calendar days, not 24-hour blocks.
export function dayLabel(iso) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(iso);
}

// <input type="date"> works with "YYYY-MM-DD" in the user's local time.
export const todayInputValue = () => new Date().toLocaleDateString('en-CA');

// A picked past date becomes noon that day (local), so time zones can't push it onto another day.
export function dateInputToIso(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
