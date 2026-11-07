import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHousehold } from '../hooks/useHousehold';
import * as itemsApi from '../api/items';
import PurchaseBlock from './PurchaseBlock';

// The last 3 purchases of one item. Fetched when the panel opens, and again
// after a new purchase. A fixed skeleton keeps the height steady while loading.
export default function RecentBuys({ item, active }) {
  const { household } = useHousehold();
  const [state, setState] = useState({ status: 'idle', rows: [] });

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading', rows: s.rows }));
    itemsApi
      .detail(household.id, item.id)
      .then(({ history }) => {
        if (!cancelled) setState({ status: 'ready', rows: history.slice(0, 3) });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', rows: [] });
      });
    return () => { cancelled = true; };
  }, [active, household.id, item.id, item.purchaseCount, item.lastBoughtAt]);

  return (
    <div className="recent">
      <p className="buy-caption">Last 3 purchases</p>
      {state.status === 'error' && <p className="muted small">Couldn't load purchases.</p>}
      {state.status === 'ready' && state.rows.length === 0 && (
        <p className="muted small">No purchases yet. Tap “I bought this” to add the first.</p>
      )}
      <div className="buy-stack">
        {(state.status === 'idle' || state.status === 'loading') && [0, 1].map((i) => (
          <div key={i} className="buy-block sk-buy" aria-hidden="true" />
        ))}
        {state.status === 'ready' && state.rows.map((h) => (
          <PurchaseBlock
            key={h.id}
            quantity={h.quantity}
            unit={item.unit}
            pricePaise={h.pricePaise}
            who={h.boughtBy}
            when={h.boughtAt}
            note={h.note}
          />
        ))}
      </div>
      {state.rows.length > 0 && state.status === 'ready' && (
        <Link className="small" to={`/items/${item.id}`}>See the full history →</Link>
      )}
    </div>
  );
}
