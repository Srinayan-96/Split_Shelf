import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useHousehold } from '../hooks/useHousehold';
import * as historyApi from '../api/history';
import { parseApiError } from '../api/client';
import PurchaseBlock from '../components/PurchaseBlock';
import PersonName from '../components/PersonName';

export default function PersonHistory() {
  const { userId } = useParams();
  const { household } = useHousehold();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'missing' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    historyApi
      .person(household.id, userId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err.response?.status;
        if (code === 404 || code === 400) setStatus('missing');
        else { setError(parseApiError(err).message); setStatus('error'); }
      });
    return () => { cancelled = true; };
  }, [household.id, userId]);

  return (
    <div className="page">
      <TopBar showBell />
      <Link to="/history" className="back-link">← Back to history</Link>

      {status === 'loading' && <p className="muted">Loading…</p>}
      {status === 'missing' && <p>We couldn't find that person.</p>}
      {status === 'error' && <div className="alert" role="alert">{error}</div>}

      {status === 'ready' && (
        <>
          <h1><PersonName id={data.person.id} name={data.person.name} /></h1>
          <p className="muted">
            {data.purchaseCount} purchase{data.purchaseCount === 1 ? '' : 's'} in the last 12 months
            {data.truncated && ' (showing the most recent 500)'}
          </p>

          {data.byItem.length === 0 && (
            <div className="panel empty"><p className="muted">Nothing bought yet.</p></div>
          )}

          {data.byItem.map((group) => (
            <section key={group.item.id} className="panel section">
              <div className="group-head">
                <h2>{group.item.name}</h2>
                <span className="badge">bought {group.times} time{group.times === 1 ? '' : 's'}</span>
              </div>
              <div className="buy-stack">
                {group.purchases.map((p) => (
                  <PurchaseBlock
                    key={p.id}
                    quantity={p.quantity}
                    unit={group.item.unit}
                    pricePaise={p.pricePaise}
                    when={p.boughtAt}
                    note={p.note}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
