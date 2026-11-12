import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MainHeader from '../components/MainHeader';
import { useHousehold } from '../hooks/useHousehold';
import { useItems } from '../hooks/useItems';
import * as historyApi from '../api/history';
import { parseApiError } from '../api/client';
import { formatDate, formatMoney, formatQty } from '../utils/format';
import { cleanUnit } from '../utils/units';

export default function PersonHistory() {
  const { userId } = useParams();
  const { household } = useHousehold();
  const { items, addItem } = useItems(household.id);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');

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

  // Flatten all purchases for "All items" tab
  const allPurchases = useMemo(() => {
    if (!data?.byItem) return [];
    const list = [];
    data.byItem.forEach((g) => {
      g.purchases.forEach((p) => {
        list.push({ ...p, item: g.item });
      });
    });
    return list.sort((a, b) => new Date(b.boughtAt) - new Date(a.boughtAt));
  }, [data]);

  // Total spent calculation
  const totalSpentPaise = useMemo(() => {
    return allPurchases.reduce((sum, p) => sum + (p.pricePaise || 0), 0);
  }, [allPurchases]);

  // Selected item group
  const activeGroup = useMemo(() => {
    if (!data?.byItem || selectedTab === 'all') return null;
    return data.byItem.find((g) => String(g.item.id) === String(selectedTab));
  }, [data, selectedTab]);

  // Purchases displayed in active tab
  const displayedPurchases = useMemo(() => {
    if (selectedTab === 'all') return allPurchases;
    return (activeGroup?.purchases || []).map((p) => ({ ...p, item: activeGroup.item }));
  }, [selectedTab, allPurchases, activeGroup]);

  const personName = data?.person?.name || 'Member';
  const personInitial = (personName[0] || 'M').toUpperCase();

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
          title={personName}
          subtitle={
            data
              ? `${data.purchaseCount} purchase${data.purchaseCount === 1 ? '' : 's'} in the last 12 months`
              : 'Detailed purchase history.'
          }
          onOpenMenu={() => setDrawerOpen(true)}
        />

        <div style={{ marginBottom: '18px' }}>
          <Link
            to="/history"
            className="btn btn-secondary btn-small"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            ← Back to history
          </Link>
        </div>

        {status === 'loading' && <p className="muted">Loading member purchases…</p>}
        {status === 'missing' && <p>We couldn't find that person.</p>}
        {error && <div className="alert">{error}</div>}

        {status === 'ready' && data && (
          <div className="person-history-container">
            {/* Person Summary Card */}
            <div className="person-summary-card">
              <div className="person-summary-info">
                <div className="person-summary-avatar">{personInitial}</div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--text)' }}>
                    {personName}
                  </h2>
                  <span className="muted small">
                    Active member of {household?.name}
                  </span>
                </div>
              </div>

              <div className="person-summary-stats">
                <div className="person-stat-chip">
                  <span className="muted" style={{ marginRight: '6px' }}>Total bought:</span>
                  <strong>{data.purchaseCount}</strong>
                </div>
                <div className="person-stat-chip">
                  <span className="muted" style={{ marginRight: '6px' }}>Unique products:</span>
                  <strong>{data.byItem.length}</strong>
                </div>
                {totalSpentPaise > 0 && (
                  <div className="person-stat-chip" style={{ borderColor: 'var(--accent)' }}>
                    <span className="muted" style={{ marginRight: '6px' }}>Total spent:</span>
                    <strong style={{ color: 'var(--accent)' }}>{formatMoney(totalSpentPaise)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Product Tabs Bar */}
            {data.byItem.length > 0 && (
              <div className="product-tabs-bar" role="tablist" aria-label="Filter purchases by product">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedTab === 'all'}
                  className={`tab-pill-btn ${selectedTab === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedTab('all')}
                >
                  <span>All items</span>
                  <span className="pill-badge">{allPurchases.length}</span>
                </button>

                {data.byItem.map((group) => {
                  const isActive = String(selectedTab) === String(group.item.id);
                  return (
                    <button
                      key={group.item.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`tab-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedTab(String(group.item.id))}
                    >
                      <span>{group.item.name}</span>
                      <span className="pill-badge">{group.times}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Purchases Table Card */}
            {displayedPurchases.length === 0 ? (
              <div className="panel empty" style={{ marginTop: '8px' }}>
                <p className="muted">Nothing bought yet in the last 12 months.</p>
              </div>
            ) : (
              <div className="order-card" style={{ margin: 0 }}>
                <div className="person-history-grid-header">
                  <span>Date bought</span>
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span>Note</span>
                </div>

                <ul className="order-list">
                  {displayedPurchases.map((p) => (
                    <li key={p.id} className="person-history-grid-row">
                      <div>
                        <strong>{formatDate(p.boughtAt)}</strong>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
                          {p.item?.name || 'Product'}
                        </strong>
                      </div>

                      <div>
                        <span className="card-pill" style={{ display: 'inline-block' }}>
                          {formatQty(p.quantity)} {cleanUnit(p.item?.unit)}
                        </span>
                      </div>

                      <div>
                        {p.pricePaise != null ? (
                          <strong style={{ color: 'var(--accent)' }}>{formatMoney(p.pricePaise)}</strong>
                        ) : (
                          <span className="muted">No price</span>
                        )}
                      </div>

                      <div>
                        {p.note ? (
                          <span className="person-note-text">“{p.note}”</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
