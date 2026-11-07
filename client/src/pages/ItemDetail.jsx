import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import * as itemsApi from '../api/items';
import { parseApiError } from '../api/client';
import { useConfirm } from '../hooks/useConfirm';
import PurchaseBlock from '../components/PurchaseBlock';
import { runOutInfo } from '../utils/format';

export default function ItemDetail() {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { household } = useHousehold();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [data, setData] = useState(null); // { item, history }
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'missing' | 'error'
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = household.members.find((m) => m.id === user.id)?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    itemsApi
      .detail(household.id, itemId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 = gone (deleted) or an invalid id (the API answers 400 for those).
        const code = err.response?.status;
        if (code === 404 || code === 400) setStatus('missing');
        else { setError(parseApiError(err).message); setStatus('error'); }
      });
    return () => { cancelled = true; };
  }, [household.id, itemId]);

  async function handleDelete() {
    if (busy) return;
    const ok = await confirm({
      title: 'Delete this item?',
      message: `"${data.item.name}" and its whole purchase history will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await itemsApi.remove(household.id, itemId);
      navigate('/', { replace: true });
    } catch (err) {
      setError(parseApiError(err).message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <TopBar showBell />
      <Link to="/" className="back-link">← Back to the shelf</Link>

      {status === 'loading' && <p className="muted">Loading…</p>}
      {status === 'missing' && <p>This item doesn't exist anymore.</p>}
      {status === 'error' && <div className="alert" role="alert">{error}</div>}

      {status === 'ready' && (
        <>
          <h1>{data.item.name}</h1>
          <p className="muted">
            {data.item.avgIntervalDays
              ? `Bought about every ${data.item.avgIntervalDays} days. ${runOutInfo(data.item.predictedRunOutAt)?.text ?? ''}`
              : 'Not enough history to predict yet. A forecast appears after 3 purchases.'}
          </p>

          {error && <div className="alert" role="alert">{error}</div>}

          <section className="panel section">
            <h2>Purchase history</h2>
            {data.history.length === 0 ? (
              <p className="muted">Nobody has logged a purchase yet.</p>
            ) : (
              <div className="buy-stack">
                {data.history.map((h) => (
                  <PurchaseBlock
                    key={h.id}
                    quantity={h.quantity}
                    unit={data.item.unit}
                    pricePaise={h.pricePaise}
                    who={h.boughtBy}
                    when={h.boughtAt}
                    note={h.note}
                    extra={{
                      label: 'Gap',
                      value: h.intervalDays != null ? `${h.intervalDays} days after the previous` : 'First purchase',
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {isAdmin && (
            <button className="btn btn-danger btn-small" onClick={handleDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete item'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
