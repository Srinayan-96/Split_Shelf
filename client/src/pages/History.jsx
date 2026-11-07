import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useHousehold } from '../hooks/useHousehold';
import * as historyApi from '../api/history';
import { parseApiError } from '../api/client';
import { dayLabel, formatDate, formatMoney } from '../utils/format';
import { hueIndex } from '../utils/memberColor';
import PersonName from '../components/PersonName';

const PAGE = 20;

// [{ label: 'Today', rows: [...] }, { label: 'Yesterday', rows: [...] }, ...]
function groupByDay(purchases) {
  const groups = [];
  purchases.forEach((p) => {
    const label = dayLabel(p.boughtAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(p);
    else groups.push({ label, rows: [p] });
  });
  return groups;
}

export default function History() {
  const { household } = useHousehold();
  const [people, setPeople] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      historyApi.people(household.id),
      historyApi.feed(household.id, { limit: PAGE }),
    ])
      .then(([peopleList, feed]) => {
        if (cancelled) return;
        setPeople(peopleList);
        setPurchases(feed.purchases);
        setCursor(feed.nextCursor);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(parseApiError(err).message);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [household.id]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const feed = await historyApi.feed(household.id, { limit: PAGE, before: cursor });
      setPurchases((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...feed.purchases.filter((p) => !seen.has(p.id))];
      });
      setCursor(feed.nextCursor);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page">
      <TopBar showBell />
      <h1>History</h1>

      {status === 'loading' && <p className="muted">Loading…</p>}
      {error && <div className="alert" role="alert">{error}</div>}

      {status === 'ready' && (
        <>
          <section className="section">
            <h2>Who bought what</h2>
            <p className="muted small">Last 12 months. Tap a person to see what they bought.</p>
            <div className="people-grid">
              {people.map((p) => (
                <Link key={p.id} to={`/history/people/${p.id}`} className="person-card" data-hue={hueIndex(p.id)}>
                  <PersonName id={p.id} name={p.name} />
                  <span>{p.purchases} purchase{p.purchases === 1 ? '' : 's'}</span>
                  <span className="muted small">
                    {p.lastBoughtAt ? `Last: ${formatDate(p.lastBoughtAt)}` : 'Nothing yet'}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="section">
            <h2>All purchases</h2>
            {purchases.length === 0 && (
              <div className="panel empty">
                <p><strong>No purchases yet.</strong></p>
                <p className="muted">Log one from the shelf with “I bought this”.</p>
              </div>
            )}

            {groupByDay(purchases).map((group) => (
              <div key={group.label} className="order-card day-group">
                <h3 className="day-label">{group.label}</h3>
                <div className="order-head" aria-hidden="true">
                  <span>Item</span>
                  <span>Quantity</span>
                  <span>Unit</span>
                  <span>Bought by</span>
                  <span>Price</span>
                </div>
                <ul className="order-list">
                  {group.rows.map((p) => (
                    <li key={p.id} className="order-row">
                      <div className="order-item">
                        <strong>{p.item.name}</strong>
                        {p.note && <span className="muted small">Note: {p.note}</span>}
                      </div>
                      <div><span className="buy-label">Quantity</span>{p.quantity ?? 1}</div>
                      <div><span className="buy-label">Unit</span>{p.item.unit || '—'}</div>
                      <div>
                        <span className="buy-label">Bought by</span>
                        <PersonName id={p.boughtBy.id} name={p.boughtBy.name} href={`/history/people/${p.boughtBy.id}`} />
                      </div>
                      <div className="money">
                        <span className="buy-label">Price</span>
                        {formatMoney(p.pricePaise)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {cursor && (
              <button className="btn btn-secondary btn-small" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Show older'}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
