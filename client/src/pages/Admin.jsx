import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MainHeader from '../components/MainHeader';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import { useItems } from '../hooks/useItems';
import { useConfirm } from '../hooks/useConfirm';
import PersonName from '../components/PersonName';
import { STANDARD_UNITS, cleanUnit } from '../utils/units';

export default function Admin() {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { items, status, error, reload, addItem, deleteItem } = useItems(household.id);
  const confirm = useConfirm();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Form states for "Add new product" card
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [adding, setAdding] = useState(false);

  const me = household.members.find((m) => m.id === user.id);
  const isAdmin = me?.role === 'admin';

  // Toggle selection
  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  // Add Product from Top Card
  async function handleAddProduct(e) {
    e.preventDefault();
    if (adding || !name.trim()) return;
    setAdding(true);
    setActionError(null);
    try {
      await addItem({ name: name.trim(), unit: unit.trim() || undefined });
      setName('');
      setUnit('');
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Could not add product.');
    } finally {
      setAdding(false);
    }
  }

  // Delete selected products
  async function handleDeleteSelected() {
    if (busy || selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ok = await confirm({
      title: `Delete ${count} product${count > 1 ? 's' : ''}?`,
      message: `Permanently delete ${count} product${count > 1 ? 's' : ''} and all associated purchase history? This cannot be undone.`,
      confirmLabel: `Delete ${count} product${count > 1 ? 's' : ''}`,
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setActionError(null);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteItem(id);
      }
      setSelectedIds(new Set());
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed deleting some items.');
    } finally {
      setBusy(false);
    }
  }

  // Delete single product from row
  async function handleDeleteSingle(item) {
    if (busy || !item) return;
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: `Permanently delete this product and all associated purchase history? This cannot be undone.`,
      confirmLabel: 'Delete product',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setActionError(null);
    try {
      await deleteItem(item.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed deleting item.');
    } finally {
      setBusy(false);
    }
  }

  // Filtered items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

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
          title="Admin Control Panel"
          subtitle={`Manage household items and settings for ${household.name}.`}
          onOpenMenu={() => setDrawerOpen(true)}
        />

        {!isAdmin ? (
          <div className="panel section">
            <h2>Admin Access Required</h2>
            <p className="muted">You are a standard member. Only household administrators can access the admin control panel.</p>
            <Link to="/" className="btn btn-secondary btn-small" style={{ display: 'inline-block', marginTop: '1rem' }}>
              ← Back to Shelf
            </Link>
          </div>
        ) : (
          <>
            {actionError && <div className="alert">{actionError}</div>}
            {error && <div className="alert">{error}</div>}

            {/* Top row, two cards side by side (flex 2 / 1) */}
            <div className="admin-top-cards-row">
              {/* Card 1: Add new product card (flex 2) */}
              <div className="panel admin-card-flex2">
                <h2>Add new product</h2>
                <p className="muted small">Quickly add shared restockable items to the household shelf.</p>
                <form className="admin-inline-add-form" onSubmit={handleAddProduct} noValidate>
                  <input
                    type="text"
                    placeholder="Product name (e.g. Dish soap)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {STANDARD_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn btn-small"
                    disabled={adding || !name.trim()}
                  >
                    {adding ? 'Adding…' : 'Add product'}
                  </button>
                </form>
              </div>

              {/* Card 2: Household summary card (flex 1) */}
              <div className="panel admin-card-flex1">
                <h2>Household summary</h2>
                <div style={{ marginTop: '0.6rem' }}>
                  <span className="muted small" style={{ display: 'block', marginBottom: '4px' }}>INVITE CODE</span>
                  <code className="invite-code" style={{ fontSize: '1.15rem' }}>{household.inviteCode}</code>
                </div>

                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="muted small">Members</span>
                    <strong style={{ fontSize: '0.85rem' }}>{household.members.length} / {household.maxMembers}</strong>
                  </div>
                  {/* Thin progress bar */}
                  <div className="members-progress-track">
                    <div
                      className="members-progress-fill"
                      style={{ width: `${Math.min(100, (household.members.length / household.maxMembers) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Products Table Card */}
            <section className="panel section" style={{ marginTop: '1.25rem' }}>
              <div className="admin-table-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2>Household products ({items.length})</h2>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => reload()}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Refreshing…' : 'Refresh list'}
                  </button>
                </div>

                <input
                  type="search"
                  className="search-input-field"
                  placeholder="Filter products…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '220px' }}
                />
              </div>

              {filteredItems.length === 0 ? (
                <div className="empty">
                  <p><strong>No products found.</strong></p>
                  <p className="muted">Use the form above to add your first product.</p>
                </div>
              ) : (
                <div className="order-card" style={{ margin: 0 }}>
                  <div className="order-head admin-table-grid">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === items.length && items.length > 0}
                        onChange={toggleAll}
                        aria-label="Select all products"
                      />
                      <span>Product name &amp; status</span>
                    </span>
                    <span>Unit</span>
                    <span>Times bought</span>
                    <span>Last restocked by</span>
                    <span style={{ textAlign: 'right' }}>Action</span>
                  </div>

                  <ul className="order-list">
                    {filteredItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const isLow = item.status === 'low';

                      return (
                        <li
                          key={item.id}
                          className={`order-row admin-table-grid ${isSelected ? 'row-selected' : ''}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(item.id)}
                              aria-label={`Select ${item.name}`}
                            />
                            <div>
                              <strong style={{ fontSize: '0.98rem' }}>{item.name}</strong>
                              <span style={{ marginLeft: '8px' }}>
                                <span className={`badge ${isLow ? 'badge-accent' : ''}`}>
                                  {isLow ? 'Running low' : 'In stock'}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div>
                            <span className="buy-label">Unit</span>
                            {cleanUnit(item.unit)}
                          </div>

                          <div>
                            <span className="buy-label">Times bought</span>
                            {item.purchaseCount ?? 0}
                          </div>

                          <div>
                            <span className="buy-label">Last restocked</span>
                            {item.lastBoughtBy ? (
                              <PersonName id={item.lastBoughtBy.id} name={item.lastBoughtBy.name} />
                            ) : (
                              <span className="muted">Not yet</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => handleDeleteSingle(item)}
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* Floating Selection Bar (Centered at bottom when rows are selected) */}
            {selectedIds.size > 0 && (
              <div className="floating-selection-pill-bar" role="toolbar" aria-label="Bulk actions">
                <button
                  className="pill-close-btn"
                  onClick={() => setSelectedIds(new Set())}
                  aria-label="Clear selection"
                >
                  ✕
                </button>
                <span className="pill-selection-count">
                  {selectedIds.size} product{selectedIds.size > 1 ? 's' : ''} selected
                </span>
                <span className="pill-divider">|</span>
                <button
                  className="pill-action-btn pill-delete-btn"
                  onClick={handleDeleteSelected}
                  disabled={busy}
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
