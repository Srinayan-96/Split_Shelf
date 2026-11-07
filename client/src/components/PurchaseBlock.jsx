import { formatDate, formatMoney, formatQty } from '../utils/format';
import PersonName from './PersonName';

// One purchase, laid out as labeled cells so quantity, unit and price
// are never read as one number.
export default function PurchaseBlock({
  quantity,
  unit,
  pricePaise,
  who,
  whoHref,
  when,
  note,
  extra,
}) {
  const person = who && typeof who === 'object' ? who : { name: who };

  return (
    <article className="buy-block">
      <dl className="buy-grid">
        <div>
          <dt>Quantity</dt>
          <dd>{formatQty(quantity ?? 1)}</dd>
        </div>
        <div>
          <dt>Unit</dt>
          <dd>{unit || '—'}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatMoney(pricePaise)}</dd>
        </div>
        {who && (
          <div>
            <dt>Bought by</dt>
            <dd>
              <PersonName id={person.id} name={person.name} href={whoHref} />
            </dd>
          </div>
        )}
        {when && (
          <div>
            <dt>Date</dt>
            <dd className="is-detail">{formatDate(when)}</dd>
          </div>
        )}
        {extra && (
          <div>
            <dt>{extra.label}</dt>
            <dd className="is-detail">{extra.value}</dd>
          </div>
        )}
      </dl>
      {note && <p className="buy-note">Note: {note}</p>}
    </article>
  );
}
