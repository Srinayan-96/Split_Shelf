import { Link } from 'react-router-dom';
import { hueIndex } from '../utils/memberColor';

export default function PersonName({ id, name, href, suffix }) {
  const label = name || 'Member';
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  const body = (
    <span className="person">
      <span className="avatar" data-hue={hueIndex(id || label)} aria-hidden="true">{initial}</span>
      <span>{label}{suffix}</span>
    </span>
  );
  if (!href) return body;
  return <Link to={href} className="person-link">{body}</Link>;
}
