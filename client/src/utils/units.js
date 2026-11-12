export const STANDARD_UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'litres', label: 'Litres (L)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'packets', label: 'Packets' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'cans', label: 'Cans' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'rolls', label: 'Rolls' },
];

export function cleanUnit(val) {
  if (!val) return 'pcs';
  return String(val).trim().replace(/^\d+\s*/, '') || 'pcs';
}

