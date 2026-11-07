import { useState } from 'react';
import { dateInputToIso, rupeesToPaise, todayInputValue } from '../utils/format';

export default function PurchaseForm({ unit, busy, onSubmit, onCancel }) {
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return setError('Quantity must be more than 0.');
    const money = rupeesToPaise(price);
    if (money.error) return setError(money.error);
    setError(null);

    const details = { quantity: qty };
    if (money.value !== null) details.pricePaise = money.value;
    if (note.trim()) details.note = note.trim();
    // Today = leave the date out and the server uses "now". Past date = send it.
    if (date && date !== todayInputValue()) details.boughtAt = dateInputToIso(date);

    onSubmit(details);
  }

  return (
    <form className="purchase-form" onSubmit={handleSubmit} noValidate>
      <label>
        Quantity {unit && <span className="muted">({unit})</span>}
        <input type="number" inputMode="decimal" step="any" min="0.001"
               value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>
      <label>
        Price (₹)
        <input inputMode="decimal" placeholder="120.50" autoComplete="off"
               value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label>
        Date bought
        <input type="date" max={todayInputValue()} value={date}
               onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Note (optional)
        <input maxLength={200} placeholder="e.g. 3-pack from the corner shop"
               value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="purchase-actions">
        <button className="btn btn-small" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save purchase'}
        </button>
        <button className="btn btn-secondary btn-small" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
