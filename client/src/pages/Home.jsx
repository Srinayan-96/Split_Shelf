import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MainHeader from '../components/MainHeader';
import ItemCard from '../components/ItemCard';
import ShelfSkeleton from '../components/ShelfSkeleton';
import ItemDetailSlideOver from '../components/ItemDetailSlideOver';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import { useItems } from '../hooks/useItems';
import { parseApiError } from '../api/client';
import { timeAgo } from '../utils/format';

export default function Home() {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { items, status, error: itemsError, reload, addItem, markLow, deleteItem, replaceItem } = useItems(household.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'list'
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState(null);

  // Selected Item for Slide-Over Panel
  const [selectedItemId, setSelectedItemId] = useState(() => searchParams.get('item'));
  const [openPurchaseForm, setOpenPurchaseForm] = useState(false);
  const [detailTab, setDetailTab] = useState('purchases');

  const me = household.members.find((m) => m.id === user.id);
  const isAdmin = me?.role === 'admin';

  // Live filter into Running Low vs In Stock
  const { lowItems, inStockItems } = useMemo(() => {
    const low = [];
    const stock = [];
    items.forEach((item) => {
      if (item.status === 'low') low.push(item);
      else stock.push(item);
    });
    return { lowItems: low, inStockItems: stock };
  }, [items]);

  // Order items with Running low first for List view
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.status === 'low' && b.status !== 'low') return -1;
      if (a.status !== 'low' && b.status === 'low') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [items]);

  // Open detail panel helper
  function handleOpenDetail(itemId, tab = 'purchases', openForm = false) {
    setSelectedItemId(itemId);
    setDetailTab(tab);
    setOpenPurchaseForm(openForm);
    setSearchParams({ item: itemId });
  }

  function handleCloseDetail() {
    setSelectedItemId(null);
    setOpenPurchaseForm(false);
    setSearchParams({});
  }

  // Mark Low handler
  async function handleMarkLow(itemId) {
    try {
      await markLow(itemId);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  return (
    <div className="app-shell-layout">
      {/* 248px Fixed Sidebar */}
      <Sidebar
        itemsCount={items.length}
        onAddItem={addItem}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <main className="main-content-area">
        {/* Main Header */}
        <MainHeader
          title={household.name}
          subtitle="Shared shelf for this household."
          onOpenMenu={() => setDrawerOpen(true)}
        />

        {error && <div className="alert" role="alert">{error}</div>}
        {itemsError && <div className="alert" role="alert">{itemsError}</div>}

        {/* B. Stats row: 4 equal cards */}
        <section className="stats-row" aria-label="Household statistics">
          <article className="stat-card">
            <span className="stat-label">On the shelf</span>
            <strong className="stat-value">{status === 'ready' ? items.length : '—'}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Running low</span>
            <strong className="stat-value">{status === 'ready' ? lowItems.length : '—'}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Members</span>
            <strong className="stat-value">
              {household.members.length} <span className="stat-sub">/ {household.maxMembers}</span>
            </strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Your role</span>
            <strong className="stat-value">{isAdmin ? 'Admin' : 'Member'}</strong>
          </article>
        </section>

        {/* C. Tab strip with title "Your shelf" and tabs Board | List */}
        <div className="shelf-tabs-strip">
          <h2 className="shelf-strip-title">Your shelf</h2>
          <div className="strip-tab-group" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'board'}
              className={`strip-tab-btn ${activeTab === 'board' ? 'active' : ''}`}
              onClick={() => setActiveTab('board')}
            >
              Board
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'list'}
              className={`strip-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              List
            </button>
          </div>
        </div>

        {status === 'loading' && <ShelfSkeleton />}

        {/* D. DYNAMIC BOARD VIEW */}
        {status === 'ready' && activeTab === 'board' && (
          <div className="board">
            {/* A. RUNNING LOW section (render only when at least one item is low) */}
            {lowItems.length > 0 && (
              <section className="board-section board-section--low" aria-label="Running low items">
                <div className="board-section-header">
                  <h3 className="section-title">Running low</h3>
                  <span className="count-pill-accent">{lowItems.length}</span>
                </div>
                <div className="low-cards-grid">
                  {lowItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onLow={handleMarkLow}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* B. IN STOCK section (always rendered) */}
            <section className="board-section board-section--stock" aria-label="In stock items">
              <div className="board-section-header">
                <h3 className="section-title">In stock</h3>
                <span className="count-pill">{inStockItems.length}</span>
              </div>
              {inStockItems.length === 0 ? (
                <div className="dashed-empty-note">
                  {items.length === 0
                    ? 'Nothing on the shelf yet. Click "+ Add item" in the sidebar to add products.'
                    : 'All items are currently running low.'}
                </div>
              ) : (
                <div className={`in-stock-grid ${lowItems.length === 0 ? 'in-stock-grid--full' : ''}`}>
                  {inStockItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onLow={handleMarkLow}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* 4. REAL GRID LIST TAB */}
        {status === 'ready' && activeTab === 'list' && (
          <div className="list-table-card">
            {items.length === 0 ? (
              <div className="dashed-empty-note" style={{ margin: '20px' }}>
                Nothing on the shelf yet. Click "+ Add item" in the sidebar to add products.
              </div>
            ) : (
              <div className="list-table-scroll">
                <div className="list-grid-inner">
                  {/* Header Row: 46px, background var(--surface-raised), 12px uppercase labels */}
                  <div className="list-table-header" role="row">
                    <span>Product name</span>
                    <span>Unit</span>
                    <span>Times bought</span>
                    <span>Status</span>
                    <span>Last bought</span>
                    <span>Action</span>
                  </div>

                  {/* Data Rows: min-height 64px, Running low items ordered first */}
                  <div className="list-table-body" role="rowgroup">
                    {sortedItems.map((item) => {
                      const isLow = item.status === 'low';
                      return (
                        <div key={item.id} className="list-table-row" role="row">
                          <div className="list-col-name">
                            <button
                              type="button"
                              className="item-name-btn"
                              onClick={() => handleOpenDetail(item.id, 'purchases')}
                            >
                              {item.name}
                            </button>
                          </div>

                          <div className="list-col-unit">
                            <span>{item.unit || '—'}</span>
                          </div>

                          <div className="list-col-bought">
                            <span>{item.purchaseCount ?? 0}</span>
                          </div>

                          <div className="list-col-status">
                            <span className={`badge ${isLow ? 'badge-accent' : ''}`}>
                              {isLow ? 'Running low' : 'In stock'}
                            </span>
                          </div>

                          <div className="list-col-last">
                            {item.lastBoughtBy ? (
                              <div className="person">
                                <span className="avatar avatar-22">
                                  {item.lastBoughtBy.name?.[0]?.toUpperCase() || '?'}
                                </span>
                                <span>
                                  {item.lastBoughtBy.name} · {timeAgo(item.lastBoughtAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="muted">Not yet</span>
                            )}
                          </div>

                          <div className="list-col-action">
                            <div className="list-row-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-compact"
                                onClick={() => handleOpenDetail(item.id, 'purchases')}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn btn-compact"
                                onClick={() => handleOpenDetail(item.id, 'purchases', true)}
                              >
                                I bought this
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. ITEM DETAIL SLIDE-OVER PANEL */}
        {selectedItemId && (
          <ItemDetailSlideOver
            itemId={selectedItemId}
            householdId={household.id}
            isAdmin={isAdmin}
            currentUserId={user.id}
            onClose={handleCloseDetail}
            onItemUpdated={(updated) => {
              if (updated) replaceItem(updated);
              reload({ silent: true });
            }}
            onItemDeleted={() => reload({ silent: true })}
            initialOpenForm={openPurchaseForm}
            initialTab={detailTab}
          />
        )}
      </main>
    </div>
  );
}
