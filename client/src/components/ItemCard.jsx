import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PurchaseForm from './PurchaseForm';
import RecentBuys from './RecentBuys';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { parseApiError } from '../api/client';
import { timeAgo, runOutInfo } from '../utils/format';
import { newKey } from '../utils/newKey';
import PersonName from './PersonName';

// Height follows the content, so opening, loading, and closing all ease
// instead of snapping the cards around this one.
function Collapse({ open, children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return undefined;
    const apply = () => {
      const next = open ? el.scrollHeight : 0;
      setHeight((current) => (current === next ? current : next));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  return (
    <div className={`collapse${open ? ' is-open' : ''}`} style={{ height }} inert={open ? undefined : true}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

// The first field error if the server sent one, otherwise its general message.
function errorText(err) {
  const parsed = parseApiError(err);
  return Object.values(parsed.fields)[0] || parsed.message;
}

export default function ItemCard({ item, onLow, onBought, onDelete, isAdmin }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(null); // null | 'low' | 'bought' | 'delete'
  const [message, setMessage] = useState(null); // { kind: 'error' | 'info', text }
  const [formOpen, setFormOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  // The id of the purchase we're currently trying to record. It survives a
  // FAILED attempt that got no answer (see handleBought).
  const boughtKey = useRef(null);

  const isLow = item.status === 'low';
  const turnIsMe = item.nextTurn?.id === user.id;
  const runOut = runOutInfo(item.predictedRunOutAt);

  // "x so far" = purchases that are at least a day apart (the forecast needs 3).
  const soFar = item.purchaseCount > 0 ? item.forecastGaps + 1 : 0;
  const forecastText = runOut
    ? runOut.text
    : `Needs 3 purchases at least a day apart${soFar ? ` (${soFar} so far)` : ''}`;

  async function handleLow() {
    if (busy) return;
    setBusy('low');
    setMessage(null);
    try {
      const { changed } = await onLow(item.id);
      if (!changed) setMessage({ kind: 'info', text: 'Someone just marked this as low already.' });
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function handleBought(details) {
    if (busy) return;
    setBusy('bought');
    setMessage(null);

    // Same key as the previous failed attempt, or a fresh one for a new purchase.
    const key = boughtKey.current ?? newKey();
    boughtKey.current = key;

    try {
      await onBought(item.id, key, details);
      boughtKey.current = null; // recorded: the NEXT purchase is a different one
      setFormOpen(false);
    } catch (err) {
      if (err.response) {
        boughtKey.current = null; // the server answered "no", so a fresh start is safe
        setMessage({ kind: 'error', text: errorText(err) });
      } else {
        // No answer at all (network drop, timeout): we DON'T know if it was saved.
        // Keep the key, so saving again retries the SAME purchase instead of adding a second.
        setMessage({
          kind: 'error',
          text: 'Connection problem. Press Save again to retry. It will not be counted twice.',
        });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={`item ${isLow ? 'item-low' : ''}`}>
      <div className="item-head">
        <Link to={`/items/${item.id}`} className="item-name">{item.name}</Link>
        <span className={`badge ${isLow ? 'badge-warn' : ''}`}>{isLow ? 'Running low' : 'OK'}</span>
      </div>
      <div className="item-chips">
        <span><span className="buy-label">Unit</span> {item.unit}</span>
        <span><span className="buy-label">Times bought</span> {item.purchaseCount ?? 0}</span>
      </div>

      <dl className="item-facts">
        <div>
          <dt>Last bought</dt>
          <dd>
            {item.lastBoughtBy
              ? <><PersonName id={item.lastBoughtBy.id} name={item.lastBoughtBy.name} /> · {timeAgo(item.lastBoughtAt)}</>
              : 'Not yet'}
          </dd>
        </div>
        <div>
          <dt>Next turn</dt>
          <dd className={turnIsMe ? 'turn-me' : ''}>
            {item.nextTurn
              ? <PersonName id={item.nextTurn.id} name={turnIsMe ? 'You' : item.nextTurn.name} />
              : 'Anyone'}
          </dd>
        </div>
        <div>
          <dt>Forecast</dt>
          <dd className={runOut?.urgent ? 'urgent' : ''}>{forecastText}</dd>
        </div>
      </dl>

      {isLow && item.lowMarkedBy && (
        <p className="muted small">
          Marked low by {item.lowMarkedBy.id === user.id
            ? 'you'
            : <PersonName id={item.lowMarkedBy.id} name={item.lowMarkedBy.name} />}{' '}
          {timeAgo(item.lowMarkedAt)}
        </p>
      )}

      {message && (
        <div className={message.kind === 'error' ? 'alert' : 'note'} role="status">
          {message.text}
        </div>
      )}

      <Collapse open={formOpen}>
          <PurchaseForm
            unit={item.unit}
            busy={busy === 'bought'}
            onSubmit={handleBought}
            onCancel={() => setFormOpen(false)}
          />
      </Collapse>

      <div className="item-actions">
        <button className="btn btn-secondary btn-small" onClick={handleLow}
                disabled={Boolean(busy) || isLow}>
          {busy === 'low' ? 'Saving…' : 'Running low'}
        </button>
        <button className="btn btn-small" onClick={() => setFormOpen((o) => !o)}
                disabled={busy === 'low'}>
          {formOpen ? 'Close' : 'I bought this'}
        </button>
        <button className="btn btn-secondary btn-small" onClick={() => setRecentOpen((o) => !o)}
                aria-expanded={recentOpen}>
          Notes &amp; recent buys
        </button>
        {isAdmin && onDelete && (
          <button
            className="btn btn-danger btn-small item-delete-btn"
            onClick={async () => {
              if (busy) return;
              const ok = await confirm({
                title: 'Delete this item?',
                message: `"${item.name}" and all its purchase history will be permanently deleted.`,
                confirmLabel: 'Delete item',
                danger: true,
              });
              if (!ok) return;
              setBusy('delete');
              try {
                await onDelete(item.id);
              } catch (err) {
                setMessage({ kind: 'error', text: errorText(err) });
                setBusy(null);
              }
            }}
            disabled={Boolean(busy)}
            title="Delete this item"
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>

      <Collapse open={recentOpen}>
          <RecentBuys item={item} active={recentOpen} />
      </Collapse>
    </article>
  );
}
