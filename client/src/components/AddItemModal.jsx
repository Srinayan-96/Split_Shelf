import { useState } from 'react';
import { parseApiError } from '../api/client';

export default function AddItemModal({ onClose, onAdd }) {
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
      await onAdd({ name: name.trim(), unit: unit.trim() || undefined });
      setName('');
      setUnit('');
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.fields?.name || parsed.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="dialog modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Add item to shelf</h2>
        <p className="muted small" style={{ marginBottom: '1.25rem' }}>
          Add a shared item that flatmates restock and consume together.
        </p>

        {error && <div className="alert" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="modal-item-name">Product Name</label>
            <input
              id="modal-item-name"
              placeholder="e.g. Dish soap, Olive oil, Milk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="modal-item-unit">Unit (optional)</label>
            <input
              id="modal-item-unit"
              placeholder="e.g. bottles, rolls, litres, kg"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-small"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

