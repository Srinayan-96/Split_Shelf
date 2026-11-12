import { useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import AddItemForm from '../components/AddItemForm';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import { useItems } from '../hooks/useItems';
import { useConfirm } from '../hooks/useConfirm';
import PersonName from '../components/PersonName';

export default function Admin() {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { items, status, error, reload, addItem, deleteItem } = useItems(household.id);
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const me = household.members.find((m) => m.id === user.id);
  const isAdmin = me?.role === 'admin';

  async function handleDelete(item) {
    if (busyId) return;
    const ok = await confirm({
      title: 'Delete this item?',
      message: `"${item.name}" and all of its purchase history will be permanently deleted from the household.`,
      confirmLabel: 'Delete item',
      danger: true,
    });
    if (!ok) return;

    setBusyId(item.id);
    setActionError(null);
    try {
      await deleteItem(item.id);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Could not delete item.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <TopBar showBell />
      
      <div className="dash-head">
        <h1>Admin Control Panel</h1>
        <p className="muted">
          Manage household items and settings for <strong>{household.name}</strong>.
        </p>
      </div>

      {!isAdmin ? (
        <div className="panel section">
          <h2>Admin Access Required</h2>
          <p className="muted">You are currently a standard member. Only household administrators can access item management and admin controls.</p>
          <Link to="/" className="btn btn-secondary btn-small" style={{ display: 'inline-block', marginTop: '1rem' }}>
            ← Back to Shelf
          </Link>
        </div>
      ) : (
        <>
          {actionError && <div className="alert" role="alert">{actionError}</div>}
          {error && <div className="alert" role="alert">{error}</div>}

          {/* Quick Add Product */}
          <section className="panel section">
            <h2>Add New Product</h2>
            <p className="muted small">Add a product to the shelf that members can restock and track.</p>
            <AddItemForm onAdd={addItem} />
          </section>

          {/* Manage / Delete Existing Products */}
          <section className="panel section">
            <div className="group-head" style={{ marginBottom: '1rem' }}>
              <h2>Household Products ({items.length})</h2>
              <button className="btn btn-secondary btn-small" onClick={() => reload()} disabled={status === 'loading'}>
                {status === 'loading' ? 'Refreshing…' : 'Refresh list'}
              </button>
            </div>

            {status === 'loading' && items.length === 0 && (
              <p className="muted">Loading products…</p>
            )}

            {items.length === 0 && status !== 'loading' ? (
              <div className="empty">
                <p><strong>No products added yet.</strong></p>
                <p className="muted">Use the form above to add your first shared item.</p>
              </div>
            ) : (
              <div className="order-card" style={{ margin: 0 }}>
                <div className="order-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto' }}>
                  <span>Product Name</span>
                  <span>Unit</span>
                  <span>Times Bought</span>
                  <span>Last Restocked By</span>
                  <span>Action</span>
                </div>
                <ul className="order-list">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="order-row"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto' }}
                    >
                      <div className="order-item">
                        <strong>
                          <Link to={`/items/${item.id}`}>{item.name}</Link>
                        </strong>
                        <span className="muted small">
                          Status: {item.status === 'low' ? 'Running Low' : 'In Stock'}
                        </span>
                      </div>

                      <div>
                        <span className="buy-label">Unit</span>
                        {item.unit || '—'}
                      </div>

                      <div>
                        <span className="buy-label">Purchases</span>
                        {item.purchaseCount ?? 0}
                      </div>

                      <div>
                        <span className="buy-label">Last restocked</span>
                        {item.lastBoughtBy ? (
                          <PersonName id={item.lastBoughtBy.id} name={item.lastBoughtBy.name} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>

                      <div>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handleDelete(item)}
                          disabled={busyId === item.id}
                          title="Delete product"
                        >
                          {busyId === item.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Household Info */}
          <section className="panel section">
            <h2>Household Summary</h2>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <div>
                <span className="buy-label">Invite Code</span>
                <p style={{ margin: '0.2rem 0' }}><code className="code">{household.inviteCode}</code></p>
              </div>
              <div>
                <span className="buy-label">Members</span>
                <p style={{ margin: '0.2rem 0', fontWeight: 600 }}>{household.members.length} / {household.maxMembers}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
