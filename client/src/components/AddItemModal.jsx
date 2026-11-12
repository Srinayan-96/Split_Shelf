import { useState } from 'react';
import { parseApiError } from '../api/client';
import { STANDARD_UNITS } from '../utils/units';

export default function AddItemModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
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
      <div
        className="dialog modal-card modal-card--add-item"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-add-item-title"
      >
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 id="modal-add-item-title" className="modal-title">Add item to shelf</h2>
            <p className="modal-subtitle">
              Add a shared item that flatmates restock and consume together.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

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
            <label htmlFor="modal-item-unit">Unit</label>
            <select
              id="modal-item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {STANDARD_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-compact"
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

