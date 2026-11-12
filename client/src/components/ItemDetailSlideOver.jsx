import { useEffect, useRef, useState } from 'react';
import * as itemsApi from '../api/items';
import { parseApiError } from '../api/client';
import { formatDate, formatMoney, formatQty, runOutInfo, timeAgo, todayInputValue, dateInputToIso, rupeesToPaise } from '../utils/format';
import { newKey } from '../utils/newKey';
import PersonName from './PersonName';
import MarkLowModal from './MarkLowModal';
import { STANDARD_UNITS, cleanUnit } from '../utils/units';

export default function ItemDetailSlideOver({
  itemId,
  householdId,
  isAdmin,
  currentUserId,
  onClose,
  onItemUpdated,
  onItemDeleted,
  initialOpenForm = false,
  initialTab = 'purchases',
}) {
  const [data, setData] = useState(null); // { item, history }
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'missing' | 'error'
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab); // 'purchases' | 'notes' | 'activity'
  const [formOpen, setFormOpen] = useState(initialOpenForm);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Purchase Form State
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState('');
  const [unit, setUnit] = useState('');
  const [formError, setFormError] = useState(null);
  const [markLowOpen, setMarkLowOpen] = useState(false);
  const boughtKey = useRef(null);

  // Sync unit when item data loads
  useEffect(() => {
    if (data?.item?.unit) {
      setUnit(cleanUnit(data.item.unit));
    }
  }, [data?.item?.unit]);

  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Trap escape & store trigger element focus ONLY once on initial mount
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    panelRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, []);

  // Load item detail
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    itemsApi
      .detail(householdId, itemId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const code = err.response?.status;
          if (code === 404 || code === 400) setStatus('missing');
          else {
            setError(parseApiError(err).message);
            setStatus('error');
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [householdId, itemId]);

  const item = data?.item;
  const history = data?.history || [];
  const isLow = item?.status === 'low';
  const runOut = runOutInfo(item?.predictedRunOutAt);

  // Purchase Form Submit
  async function handleSavePurchase(e) {
    e.preventDefault();
    if (busy) return;

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return setFormError('Quantity must be more than 0.');
    const money = rupeesToPaise(price);
    if (money.error) return setFormError(money.error);
    setFormError(null);

    const details = { quantity: qty };
    if (unit.trim()) details.unit = unit.trim();
    if (money.value !== null) details.pricePaise = money.value;
    if (note.trim()) details.note = note.trim();
    if (date && date !== todayInputValue()) details.boughtAt = dateInputToIso(date);

    setBusy(true);
    setActionMessage(null);
    const key = boughtKey.current ?? newKey();
    boughtKey.current = key;

    try {
      const { item: updatedItem } = await itemsApi.markBought(householdId, itemId, {
        idempotencyKey: key,
        ...details,
      });
      boughtKey.current = null;
      setFormOpen(false);
      setQuantity('1');
      setPrice('');
      setNote('');
      if (onItemUpdated) onItemUpdated(updatedItem);
      if (onClose) onClose();
    } catch (err) {
      if (err.response) {
        boughtKey.current = null;
        setFormError(err.response?.data?.message || 'Could not record purchase');
      } else {
        setFormError('Connection issue. Tap Save again to retry without duplicating.');
      }
    } finally {
      setBusy(false);
    }
  }

  // Mark Low
  function handleMarkLow() {
    if (busy || isLow) return;
    setMarkLowOpen(true);
  }

  async function handleConfirmMarkLow(details) {
    setBusy(true);
    setActionMessage(null);
    try {
      const { item: updatedItem } = await itemsApi.markLow(householdId, itemId, details);
      setData((prev) => (prev ? { ...prev, item: updatedItem } : prev));
      if (onItemUpdated) onItemUpdated(updatedItem);
    } catch (err) {
      setActionMessage(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (busy || !isAdmin) return;
    if (!window.confirm(`Delete "${item.name}" and all purchase history? This cannot be undone.`)) return;

    setBusy(true);
    try {
      await itemsApi.remove(householdId, itemId);
      if (onItemDeleted) onItemDeleted(itemId);
      onClose();
    } catch (err) {
      setActionMessage(parseApiError(err).message);
      setBusy(false);
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/items/${itemId}`;
    navigator.clipboard?.writeText(url);
    setActionMessage('Link copied to clipboard!');
    setTimeout(() => setActionMessage(null), 2500);
  }

  // Notes tab data
  const notesList = history.filter((h) => Boolean(h.note?.trim()));

  return (
    <div
      className="slide-over-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="slide-over-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={item ? item.name : 'Item details'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. HEADER (fixed, 44px buttons) */}
        <div className="slide-over-header">
          <button
            className="panel-icon-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="header-actions-right">
            <button
              className="panel-icon-btn"
              onClick={handleCopyLink}
              title="Copy link"
              aria-label="Copy link to this item"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. BODY (scrolls) */}
        <div className="slide-over-body">
          {actionMessage && <div className="note" style={{ margin: '0 0 1rem' }}>{actionMessage}</div>}

          {status === 'loading' && <p className="muted">Loading details…</p>}
          {status === 'missing' && <p>This item does not exist or was deleted.</p>}
          {status === 'error' && <div className="alert">{error}</div>}

          {status === 'ready' && item && (
            <>
              <h2 className="slide-over-title">{item.name}</h2>

              {/* Property rows: 140px | 1fr */}
              <div className="prop-grid">
                <div className="prop-row">
                  <span className="prop-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Status</span>
                  </span>
                  <div className="prop-value">
                    <span className={`badge ${isLow ? 'badge-accent' : ''}`}>
                      {isLow ? 'Running low' : 'OK'}
                    </span>
                  </div>
                </div>

                <div className="prop-row">
                  <span className="prop-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span>Total available</span>
                  </span>
                  <div className="prop-value">
                    {item.currentStock ?? item.lastQuantity ?? 0} {cleanUnit(item.unit)}
                  </div>
                </div>

                {isLow && item.lowUnitsLeft != null && (
                  <div className="prop-row">
                    <span className="prop-label">
                      <span>Units left</span>
                    </span>
                    <div className="prop-value" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {item.lowUnitsLeft} {cleanUnit(item.unit)} left
                      {item.lowNote && (
                        <div className="muted small" style={{ fontStyle: 'italic', marginTop: '2px' }}>
                          "{item.lowNote}"
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="prop-row">
                  <span className="prop-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    <span>Times bought</span>
                  </span>
                  <div className="prop-value">{item.purchaseCount ?? history.length} time{item.purchaseCount === 1 ? '' : 's'}</div>
                </div>

                <div className="prop-row">
                  <span className="prop-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Last bought</span>
                  </span>
                  <div className="prop-value">
                    {item.lastBoughtBy ? (
                      <span className="prop-person-time">
                        <PersonName id={item.lastBoughtBy.id} name={item.lastBoughtBy.name} />
                        <span className="muted small">· {timeAgo(item.lastBoughtAt)}</span>
                      </span>
                    ) : (
                      'Not yet'
                    )}
                  </div>
                </div>

                <div className="prop-row">
                  <span className="prop-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    <span>Next turn</span>
                  </span>
                  <div className="prop-value">
                    {item.nextTurn ? (
                      <PersonName
                        id={item.nextTurn.id}
                        name={item.nextTurn.id === currentUserId ? 'You' : item.nextTurn.name}
                      />
                    ) : (
                      'Anyone'
                    )}
                  </div>
                </div>

                {isLow && item.lowMarkedBy && (
                  <div className="prop-row">
                    <span className="prop-label">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                      <span>Marked low by</span>
                    </span>
                    <div className="prop-value">
                      <PersonName
                        id={item.lowMarkedBy.id}
                        name={item.lowMarkedBy.id === currentUserId ? 'You' : item.lowMarkedBy.name}
                      />
                      <span className="muted small">· {timeAgo(item.lowMarkedAt)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Forecast box */}
              <div className="forecast-box">
                <strong>Forecast:</strong>{' '}
                {runOut
                  ? runOut.text
                  : `Needs 3 purchases at least a day apart${item.forecastGaps != null ? ` (${item.forecastGaps + (item.purchaseCount ? 1 : 0)} so far)` : ''}.`}
              </div>

              {/* PURCHASE FORM */}
              {formOpen && (
                <div className="panel-purchase-container">
                  <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Record a purchase</h3>
                  {formError && <div className="alert">{formError}</div>}

                  <form onSubmit={handleSavePurchase} noValidate>
                    <div className="panel-qty-unit-row">
                      <div className="field">
                        <label htmlFor="so-qty">Quantity</label>
                        <input
                          id="so-qty"
                          type="number"
                          min="1"
                          step="any"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="so-unit">Unit</label>
                        <select
                          id="so-unit"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                        >
                          {STANDARD_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                          {!STANDARD_UNITS.some((u) => u.value === unit) && unit && (
                            <option value={unit}>{unit}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="so-price">Price (₹, optional)</label>
                      <input
                        id="so-price"
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 120.50"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="so-date">Date bought</label>
                      <input
                        id="so-date"
                        type="date"
                        max={todayInputValue()}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="so-note">Note (optional)</label>
                      <textarea
                        id="so-note"
                        rows="2"
                        placeholder="e.g. 3-pack from the corner shop"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    <div className="panel-form-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setFormOpen(false)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn"
                        disabled={busy}
                      >
                        {busy ? 'Saving…' : 'Save purchase'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TABS: Purchases (n) | Notes (n) | Activity */}
              <div className="panel-tabs-bar">
                <button
                  className={`panel-tab ${activeTab === 'purchases' ? 'active' : ''}`}
                  onClick={() => setActiveTab('purchases')}
                >
                  Purchases ({history.length})
                </button>
                <button
                  className={`panel-tab ${activeTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notes')}
                >
                  Notes ({notesList.length})
                </button>
                <button
                  className={`panel-tab ${activeTab === 'activity' ? 'active' : ''}`}
                  onClick={() => setActiveTab('activity')}
                >
                  Activity
                </button>
              </div>

              {/* TAB CONTENT: Purchases */}
              {activeTab === 'purchases' && (
                <div className="panel-tab-content">
                  {history.length === 0 ? (
                    <div className="dashed-empty-box">
                      No purchases yet. Tap <strong>I bought this</strong> to record the first one.
                    </div>
                  ) : (
                    <div className="buy-stack">
                      {history.map((h) => (
                        <div key={h.id} className="buy-block">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <PersonName id={h.boughtBy?.id} name={h.boughtBy?.name || h.boughtBy} />
                            <span className="muted small">{formatDate(h.boughtAt)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span>Quantity {formatQty(h.quantity)} {item.unit && `· ${item.unit}`}</span>
                            <strong>{formatMoney(h.pricePaise)}</strong>
                          </div>
                          {h.note && (
                            <div className="recent-note" style={{ marginTop: '0.35rem' }}>
                              “{h.note}”
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: Notes */}
              {activeTab === 'notes' && (
                <div className="panel-tab-content">
                  {notesList.length === 0 ? (
                    <div className="dashed-empty-box">
                      No notes yet. Add one when you record a purchase.
                    </div>
                  ) : (
                    <div className="buy-stack">
                      {notesList.map((h) => (
                        <div key={h.id} className="buy-block">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <PersonName id={h.boughtBy?.id} name={h.boughtBy?.name || h.boughtBy} />
                            <span className="muted small">{formatDate(h.boughtAt)}</span>
                          </div>
                          <p style={{ margin: '0.25rem 0 0', fontStyle: 'italic' }}>
                            “{h.note}”
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: Activity */}
              {activeTab === 'activity' && (
                <div className="panel-tab-content">
                  <div className="activity-timeline">
                    {isLow && item.lowMarkedBy && (
                      <div className="timeline-item">
                        <span className="timeline-dot" />
                        <div>
                          <span>
                            {item.lowMarkedBy.id === currentUserId ? 'You' : item.lowMarkedBy.name} marked it as running low
                          </span>
                          <span className="muted small" style={{ display: 'block' }}>
                            {timeAgo(item.lowMarkedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                    {history.slice(0, 8).map((h) => (
                      <div key={h.id} className="timeline-item">
                        <span className="timeline-dot" />
                        <div>
                          <span>
                            {h.boughtBy?.name || h.boughtBy} bought {formatQty(h.quantity)} {item.unit}
                          </span>
                          <span className="muted small" style={{ display: 'block' }}>
                            {formatDate(h.boughtAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {!isLow && history.length === 0 && (
                      <div className="dashed-empty-box">No recent activity recorded.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. ACTION BAR (fixed bottom, border-top) */}
        {status === 'ready' && item && (
          <div className="slide-over-action-bar">
            <button
              className="btn btn-small"
              onClick={() => setFormOpen((o) => !o)}
              style={{ flex: 1 }}
              disabled={busy}
            >
              {formOpen ? 'Close form' : 'I bought this'}
            </button>

            <button
              className="btn btn-secondary btn-small"
              onClick={handleMarkLow}
              disabled={busy || isLow}
            >
              {isLow ? 'Marked low' : 'Running low'}
            </button>

            {isAdmin && (
              <button
                className="btn btn-danger btn-small"
                onClick={handleDelete}
                disabled={busy}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </aside>

      {markLowOpen && (
        <MarkLowModal
          item={item}
          onClose={() => setMarkLowOpen(false)}
          onConfirm={handleConfirmMarkLow}
        />
      )}
    </div>
  );
}

