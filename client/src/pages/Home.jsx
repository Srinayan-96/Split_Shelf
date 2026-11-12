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

export default function Home() {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { items, status, error: itemsError, reload, addItem, markLow, deleteItem } = useItems(household.id);

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

        {/* D. BOARD VIEW */}
        {status === 'ready' && activeTab === 'board' && (
          <div className="board-container">
            {/* Column 1: Running Low */}
            <div className="board-column">
              <div className="board-column-header">
                <span className="column-title">Running low</span>
                <span className="count-pill-accent">{lowItems.length}</span>
              </div>

              <div className="column-cards-list">
                {lowItems.length === 0 ? (
                  <div className="dashed-empty-note">
                    Nothing is running low. Tap Running low on an item to flag it for everyone.
                  </div>
                ) : (
                  lowItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onLow={handleMarkLow}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 2: In Stock */}
            <div className="board-column">
              <div className="board-column-header">
                <span className="column-title">In stock</span>
                <span className="count-pill">{inStockItems.length}</span>
              </div>

              <div className="column-cards-list">
                {inStockItems.length === 0 ? (
                  <div className="dashed-empty-note">
                    All items are either running low or nothing has been added yet.
                  </div>
                ) : (
                  inStockItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onLow={handleMarkLow}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* LIST VIEW (Alternative representation) */}
        {status === 'ready' && activeTab === 'list' && (
          <div className="panel list-table-card">
            {items.length === 0 ? (
              <div className="empty">
                <p><strong>Nothing on the shelf yet.</strong></p>
                <p className="muted">Click "+ Add item" in the sidebar to add products.</p>
              </div>
            ) : (
              <div className="order-card" style={{ margin: 0 }}>
                <div className="order-head">
                  <span>Product Name</span>
                  <span>Unit</span>
                  <span>Times Bought</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                <ul className="order-list">
                  {items.map((item) => (
                    <li key={item.id} className="order-row">
                      <div className="order-item">
                        <button
                          className="item-name-btn"
                          onClick={() => handleOpenDetail(item.id, 'purchases')}
                        >
                          {item.name}
                        </button>
                      </div>
                      <div><span className="buy-label">Unit</span>{item.unit || '—'}</div>
                      <div><span className="buy-label">Purchases</span>{item.purchaseCount ?? 0}</div>
                      <div>
                        <span className={`badge ${item.status === 'low' ? 'badge-accent' : ''}`}>
                          {item.status === 'low' ? 'Running low' : 'In stock'}
                        </span>
                      </div>
                      <div>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handleOpenDetail(item.id, 'purchases')}
                        >
                          View
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
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
            onItemUpdated={() => reload({ silent: true })}
            onItemDeleted={() => reload({ silent: true })}
            initialOpenForm={openPurchaseForm}
            initialTab={detailTab}
          />
        )}
      </main>
    </div>
  );
}
