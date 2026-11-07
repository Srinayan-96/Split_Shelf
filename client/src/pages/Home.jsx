import { useState } from 'react';
import TopBar from '../components/TopBar';
import ItemCard from '../components/ItemCard';
import AddItemForm from '../components/AddItemForm';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import { useItems } from '../hooks/useItems';
import { useConfirm } from '../hooks/useConfirm';
import { parseApiError } from '../api/client';
import ShelfSkeleton from '../components/ShelfSkeleton';
import PersonName from '../components/PersonName';

export default function Home() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { household, leave, regenerateCode } = useHousehold();
  const { items, status, error: itemsError, reload, addItem, markLow, markBought } = useItems(household.id);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copyState, setCopyState] = useState('idle'); // 'idle' | 'copied' | 'failed'

  const me = household.members.find((m) => m.id === user.id);
  const isAdmin = me?.role === 'admin';
  const isLastMember = household.members.length === 1;
  const lowCount = items.filter((i) => i.status === 'low').length;

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    const ok = await confirm({
      title: 'Leave this household?',
      message: isLastMember
        ? 'You are the last member. Leaving will DELETE this household and everything in it.'
        : 'You can rejoin later with the invite code.',
      confirmLabel: 'Leave',
      danger: true,
    });
    if (ok) run(leave);
  }

  async function handleNewCode() {
    const ok = await confirm({
      title: 'Create a new invite code?',
      message: 'The old code will stop working straight away.',
      confirmLabel: 'Create new code',
    });
    if (ok) run(regenerateCode);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }

  return (
    <div className="page">
      <TopBar showBell />

      <div className="dash-head">
        <div>
          <h1>{household.name}</h1>
          <p className="muted">Shared shelf for this household.</p>
        </div>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="stat-row">
        <article className="stat stat-rose">
          <span>On the shelf</span>
          <strong>{status === 'ready' ? items.length : '—'}</strong>
        </article>
        <article className="stat stat-amber">
          <span>Running low</span>
          <strong>{status === 'ready' ? lowCount : '—'}</strong>
        </article>
        <article className="stat stat-violet">
          <span>Members</span>
          <strong>{household.members.length}<small> / {household.maxMembers}</small></strong>
        </article>
        <article className="stat stat-teal">
          <span>Your role</span>
          <strong>{isAdmin ? 'Admin' : 'Member'}</strong>
        </article>
      </div>

      <div className="dash-layout">
      <section className="section">
        <h2>Your shelf</h2>
        <AddItemForm onAdd={addItem} />

        {status === 'loading' && (
          <>
            <span className="sr-only" role="status">Loading your shelf…</span>
            <ShelfSkeleton />
          </>
        )}

        {status === 'error' && (
          <div className="stack">
            <div className="alert" role="alert">{itemsError}</div>
            <button className="btn btn-small" onClick={() => reload()}>Try again</button>
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <div className="panel empty">
            <p><strong>Nothing on the shelf yet.</strong></p>
            <p className="muted">
              Add the things you share, like toilet paper or dish soap. Log each purchase and
              Split Shelf will learn how long things last.
            </p>
          </div>
        )}

        {status === 'ready' && items.length > 0 && (
          <div className="shelf-grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onLow={markLow} onBought={markBought} />
            ))}
          </div>
        )}
      </section>

      <aside className="side-stack">
      <section className="panel section">
        <h2>Invite flatmates</h2>
        <div className="code-row">
          <code className="code">{household.inviteCode}</code>
          <button className="btn btn-secondary btn-small" onClick={copyCode}>
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Press Ctrl+C' : 'Copy'}
          </button>
          {isAdmin && (
            <button className="btn btn-secondary btn-small" onClick={handleNewCode} disabled={busy}>
              New code
            </button>
          )}
        </div>
      </section>

      <section className="panel section">
        <h2>Members</h2>
        <ul className="member-list">
          {household.members.map((m) => (
            <li key={m.id}>
              <span>
                <PersonName id={m.id} name={m.name} suffix={m.id === user.id ? ' (you)' : ''} />
              </span>
              <span className={`badge ${m.role === 'admin' ? 'badge-accent' : ''}`}>{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
      </aside>
      </div>

      <button className="btn btn-danger btn-small" onClick={handleLeave} disabled={busy}>
        Leave household
      </button>
    </div>
  );
}
