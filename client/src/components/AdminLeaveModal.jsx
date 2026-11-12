import { useState } from 'react';
import { parseApiError } from '../api/client';

export default function AdminLeaveModal({ household, currentUserId, onClose, onLeave }) {
  const otherMembers = (household?.members || []).filter(
    (m) => String(m.id) !== String(currentUserId)
  );

  const [selectedAdminId, setSelectedAdminId] = useState(
    () => otherMembers[0]?.id || ''
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Transfer admin and leave
  async function handleAssignAndLeave(e) {
    e.preventDefault();
    if (busy || !selectedAdminId) return;
    setBusy(true);
    setError(null);
    try {
      await onLeave({
        action: 'reassign_and_leave',
        newAdminUserId: selectedAdminId,
      });
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
      setBusy(false);
    }
  }

  // Delete household and all data
  async function handleDeleteHousehold() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLeave({ action: 'delete' });
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-leave-title"
    >
      <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 className="modal-title" id="admin-leave-title">Leave Household</h2>
            <p className="modal-subtitle">
              You are an admin of <strong>{household?.name}</strong>. Choose what happens next:
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {error && <div className="alert" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* OPTION 1: Assign another admin and leave */}
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text)', fontWeight: 600 }}>
              1. Assign another admin & leave
            </h3>
            <p className="muted small" style={{ margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Transfer admin rights to one of your flatmates so they can manage the household after you leave.
            </p>

            {otherMembers.length > 0 ? (
              <form onSubmit={handleAssignAndLeave}>
                <div className="field" style={{ marginBottom: '12px' }}>
                  <label htmlFor="new-admin-select" style={{ fontSize: '12px' }}>
                    Select new admin:
                  </label>
                  <select
                    id="new-admin-select"
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    disabled={busy}
                    style={{ width: '100%' }}
                  >
                    {otherMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.role === 'admin' ? '(Already an Admin)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-small"
                  disabled={busy || !selectedAdminId}
                  style={{ width: '100%' }}
                >
                  {busy ? 'Processing…' : 'Assign admin & leave'}
                </button>
              </form>
            ) : (
              <p className="muted small">No other members in this household.</p>
            )}
          </div>

          {/* OPTION 2: Delete household and all data */}
          <div
            style={{
              background: 'rgba(255, 75, 75, 0.05)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text)', fontWeight: 600 }}>
              2. Delete household and all data
            </h3>
            <p className="muted small" style={{ margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Permanently delete <strong>{household?.name}</strong>, including all shelf items, purchase history, and notifications for all members.
            </p>

            {!confirmDelete ? (
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                style={{ width: '100%' }}
              >
                Delete household & its data
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text)', fontWeight: 600 }}>
                  Are you absolutely sure? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    style={{ flex: 1 }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={handleDeleteHousehold}
                    disabled={busy}
                    style={{ flex: 1, borderColor: '#ff4d4f', color: '#ff4d4f' }}
                  >
                    {busy ? 'Deleting…' : 'Confirm delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
            style={{ width: '100%' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
