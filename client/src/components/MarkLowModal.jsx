import { useState } from 'react';

export default function MarkLowModal({ item, onClose, onConfirm }) {
  const [unitsLeft, setUnitsLeft] = useState(() => (item?.currentStock > 0 ? String(item.currentStock) : '1'));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const qty = Number(unitsLeft);
    if (isNaN(qty) || qty < 0) {
      setError('Please enter a valid number (0 or more).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onConfirm({
        unitsLeft: qty,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not mark item low.');
      setBusy(false);
    }
  }

  const unitLabel = (item?.unit || 'pcs').replace(/^\d+\s*/, '') || 'pcs';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="mark-low-title">
      <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 className="modal-title" id="mark-low-title">Running low: {item?.name}</h2>
            <p className="modal-subtitle">Specify how many units are currently left on the shelf.</p>
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

        {error && <div className="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="modal-units-left">
              Units left on shelf <span className="muted">({unitLabel})</span>
            </label>
            <input
              id="modal-units-left"
              type="number"
              min="0"
              step="any"
              value={unitsLeft}
              onChange={(e) => setUnitsLeft(e.target.value)}
              placeholder="e.g. 1"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="modal-low-note">Note (optional)</label>
            <textarea
              id="modal-low-note"
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Opened the last packet today"
              maxLength={200}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Mark running low'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

