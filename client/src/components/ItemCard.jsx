import { timeAgo } from '../utils/format';
import PersonName from './PersonName';

export default function ItemCard({ item, onLow, onOpenDetail }) {
  const isLow = item.status === 'low';

  return (
    <article className={`item-card ${isLow ? 'is-low-card' : ''}`}>
      {/* Row 1: item name as button + status badge */}
      <div className="item-card-row1">
        <button
          className="item-name-btn"
          onClick={() => onOpenDetail(item.id, 'purchases')}
          title="Open item details"
        >
          {item.name}
        </button>
        <span className={`badge ${isLow ? 'badge-accent' : ''}`}>
          {isLow ? 'Running low' : 'In stock'}
        </span>
      </div>

      {/* Row 2: two pill chips */}
      <div className="item-card-pills">
        <span className="card-pill">Unit {item.unit || '—'}</span>
        <span className="card-pill">Bought {item.purchaseCount ?? 0} times</span>
      </div>

      {/* Row 3: avatar + last bought */}
      <div className="item-card-meta-row">
        {item.lastBoughtBy ? (
          <>
            <PersonName id={item.lastBoughtBy.id} name={item.lastBoughtBy.name} />
            <span className="muted small">· {timeAgo(item.lastBoughtAt)}</span>
          </>
        ) : (
          <span className="muted small">Last bought: not yet</span>
        )}
      </div>

      {/* Row 4: avatar + next turn */}
      <div className="item-card-meta-row">
        {item.nextTurn ? (
          <div className="turn-indicator">
            <span className="muted small">Next turn:</span>
            <PersonName id={item.nextTurn.id} name={item.nextTurn.name} />
          </div>
        ) : (
          <span className="muted small">Next turn: Anyone</span>
        )}
      </div>

      {/* Low items only: line "Marked low by..." */}
      {isLow && item.lowMarkedBy && (
        <div className="item-low-by-line">
          Marked low by <PersonName id={item.lowMarkedBy.id} name={item.lowMarkedBy.name} />{' '}
          <span className="muted small">· {timeAgo(item.lowMarkedAt)}</span>
        </div>
      )}

      {/* Action buttons (wrap, 40px tall, radius 10) */}
      <div className="item-card-actions">
        <button
          className="btn btn-secondary btn-compact"
          onClick={() => onLow(item.id)}
          disabled={isLow}
        >
          {isLow ? 'Marked low' : 'Running low'}
        </button>

        <button
          className="btn btn-compact"
          onClick={() => onOpenDetail(item.id, 'purchases', true)}
        >
          I bought this
        </button>

        <button
          className="btn btn-secondary btn-compact"
          onClick={() => onOpenDetail(item.id, 'purchases')}
        >
          Notes &amp; recent buys
        </button>
      </div>
    </article>
  );
}
