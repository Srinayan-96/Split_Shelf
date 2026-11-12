import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MainHeader from '../components/MainHeader';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import { useItems } from '../hooks/useItems';
import * as historyApi from '../api/history';
import { parseApiError } from '../api/client';
import { dayLabel, formatDate, formatMoney, formatQty } from '../utils/format';
import PersonName from '../components/PersonName';

const PAGE = 20;

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
  const { user } = useAuth();
  const { household } = useHousehold();
  const { items, addItem } = useItems(household.id);
  const [people, setPeople] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'mine' | 'price'
  const [searchQuery, setSearchQuery] = useState('');

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
    return () => {
      cancelled = true;
    };
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

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      // Tab filter
      if (activeFilter === 'mine' && p.boughtBy?.id !== user.id) return false;
      if (activeFilter === 'price' && p.pricePaise == null) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const itemName = p.item?.name?.toLowerCase() || '';
        const buyerName = p.boughtBy?.name?.toLowerCase() || '';
        const note = p.note?.toLowerCase() || '';
        if (!itemName.includes(q) && !buyerName.includes(q) && !note.includes(q)) return false;
      }
      return true;
    });
  }, [purchases, activeFilter, searchQuery, user.id]);

  return (
    <div className="app-shell-layout">
      <Sidebar
        itemsCount={items.length}
        onAddItem={addItem}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <main className="main-content-area">
        <MainHeader
          title="History"
          subtitle="Who bought what in the last 12 months. Tap a person to see their purchases."
          onOpenMenu={() => setDrawerOpen(true)}
        />

        {status === 'loading' && (
          <div className="history-skeleton-section" aria-busy="true">
            <div className="history-people-grid">
              <div className="history-person-card history-card-skeleton">
                <span className="muted">Loading members…</span>
              </div>
              <div className="history-person-card history-card-skeleton">
                <span className="muted">Loading members…</span>
              </div>
              <div className="history-person-card history-card-skeleton">
                <span className="muted">Loading members…</span>
              </div>
            </div>
            <div style={{ marginTop: '24px' }}>
              <p className="muted">Loading purchases feed…</p>
            </div>
          </div>
        )}
        {error && <div className="alert">{error}</div>}

        {status === 'ready' && (
          <>
            {/* People row: 3-column grid of cards */}
            <section className="people-grid-section" aria-label="Members purchase statistics">
              <div className="history-people-grid">
                {people.map((p) => (
                  <Link
                    key={p.id}
                    to={`/history/people/${p.id}`}
                    className="history-person-card"
                  >
                    <div className="person-card-top">
                      <PersonName id={p.id} name={p.name} />
                      <strong className="person-purchases-count">
                        {p.purchases} <span className="stat-sub">buys</span>
                      </strong>
                    </div>
                    <div className="person-card-bottom">
                      <span className="muted small">
                        {p.lastBoughtAt ? `Last: ${formatDate(p.lastBoughtAt)}` : 'Nothing yet'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Toolbar: Title "All purchases", Tabs, Search, Filter */}
            <section className="purchases-feed-section">
              <div className="history-toolbar">
                <div className="toolbar-left">
                  <h2 className="toolbar-title">All purchases</h2>
                  <div className="strip-tab-group">
                    <button
                      className={`strip-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setActiveFilter('all')}
                    >
                      All
                    </button>
                    <button
                      className={`strip-tab-btn ${activeFilter === 'mine' ? 'active' : ''}`}
                      onClick={() => setActiveFilter('mine')}
                    >
                      Mine
                    </button>
                    <button
                      className={`strip-tab-btn ${activeFilter === 'price' ? 'active' : ''}`}
                      onClick={() => setActiveFilter('price')}
                    >
                      With price
                    </button>
                  </div>
                </div>

                <div className="toolbar-right">
                  <input
                    type="search"
                    className="search-input-field"
                    placeholder="Search purchases…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Table Card */}
              <div className="panel history-table-panel">
                {filteredPurchases.length === 0 ? (
                  <div className="empty">
                    <p><strong>No purchases found.</strong></p>
                    <p className="muted">
                      {searchQuery ? 'Try matching another name or item.' : 'Log one from the shelf with "I bought this".'}
                    </p>
                  </div>
                ) : (
                  <div className="history-feed-table">
                    {/* Header Row */}
                    <div className="history-table-header">
                      <span>Item</span>
                      <span>Quantity</span>
                      <span>Unit</span>
                      <span>Bought by</span>
                      <span>Price</span>
                    </div>

                    {/* Group by day */}
                    {groupByDay(filteredPurchases).map((group) => (
                      <div key={group.label} className="day-purchase-group">
                        <div className="day-separator-row">
                          <span className="day-label-text">{group.label}</span>
                        </div>
                        {group.rows.map((p) => (
                          <div key={p.id} className="history-table-row">
                            <div className="col-item-details">
                              <strong className="item-title-text">{p.item?.name || 'Deleted item'}</strong>
                              {p.note && <span className="item-note-text">Note: “{p.note}”</span>}
                            </div>
                            <div className="col-cell">
                              <span className="buy-label">Qty</span>
                              {formatQty(p.quantity ?? 1)}
                            </div>
                            <div className="col-cell">
                              <span className="buy-label">Unit</span>
                              {p.item?.unit || '—'}
                            </div>
                            <div className="col-cell">
                              <span className="buy-label">By</span>
                              <PersonName
                                id={p.boughtBy?.id}
                                name={p.boughtBy?.name}
                                href={`/history/people/${p.boughtBy?.id}`}
                              />
                            </div>
                            <div className="col-cell col-price">
                              <span className="buy-label">Price</span>
                              <strong>{formatMoney(p.pricePaise)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cursor && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading older…' : 'Show older'}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
