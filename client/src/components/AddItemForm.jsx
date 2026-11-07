import { useState } from 'react';
import { parseApiError } from '../api/client';

export default function AddItemForm({ onAdd }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({ name, unit: unit.trim() || undefined });
      setName('');
      setUnit('');
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.fields.name || parsed.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="add-form">
        <input aria-label="Item name" placeholder="Add an item (e.g. Dish soap)"
               value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <input aria-label="Unit (optional)" placeholder="unit (rolls)" className="add-unit"
               value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
        <button className="btn btn-small" type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
    </form>
  );
}
