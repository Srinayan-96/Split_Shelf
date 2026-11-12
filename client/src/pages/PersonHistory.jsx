import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MainHeader from '../components/MainHeader';
import { useHousehold } from '../hooks/useHousehold';
import * as historyApi from '../api/history';
import { parseApiError } from '../api/client';
import { formatDate, formatMoney, formatQty } from '../utils/format';

export default function PersonHistory() {
  const { userId } = useParams();
  const { household } = useHousehold();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        else {
          setError(parseApiError(err).message);
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [household.id, userId]);

  return (
    <div className="app-shell-layout">
      <Sidebar
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <main className="main-content-area">
        <MainHeader
          title={data?.person?.name || 'Member Purchases'}
          subtitle={
            data
              ? `${data.purchaseCount} purchase${data.purchaseCount === 1 ? '' : 's'} in the last 12 months`
              : 'Detailed purchase history.'
          }
          onOpenMenu={() => setDrawerOpen(true)}
        />

        <Link to="/history" className="back-link">
          ← Back to history
        </Link>

        {status === 'loading' && <p className="muted">Loading member purchases…</p>}
        {status === 'missing' && <p>We couldn't find that person.</p>}
        {error && <div className="alert">{error}</div>}

        {status === 'ready' && data && (
          <div className="person-history-container">
            {data.byItem.length === 0 ? (
              <div className="panel empty">
                <p className="muted">Nothing bought yet in the last 12 months.</p>
              </div>
            ) : (
              data.byItem.map((group) => (
                <section key={group.item.id} className="panel section">
                  <div className="group-head">
                    <h2>{group.item.name}</h2>
                    <span className="badge">
                      bought {group.times} time{group.times === 1 ? '' : 's'}
                    </span>
                  </div>

                  <ul className="feed-list" style={{ marginTop: '0.75rem' }}>
                    {group.purchases.map((p) => (
                      <li key={p.id}>
                        <div>
                          <strong>{formatDate(p.boughtAt)}</strong>
                          <span className="muted">
                            {' '}
                            · {formatQty(p.quantity)} {group.item.unit}
                          </span>
                          {p.note && (
                            <div className="muted small" style={{ marginTop: '0.2rem' }}>
                              “{p.note}”
                            </div>
                          )}
                        </div>
                        <span className="money">{formatMoney(p.pricePaise)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
