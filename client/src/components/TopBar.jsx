import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import PersonName from './PersonName';

// showBell is only true on pages inside a household (the bell and the links
// need a household, and the NotificationProvider only exists there).
export default function TopBar({ showBell = false }) {
  const { user, logout } = useAuth();
  const { household } = useHousehold();

  const me = household?.members?.find((m) => m.id === user.id);
  const isAdmin = me?.role === 'admin';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="brand">Split Shelf</span>
        {showBell && (
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Shelf</NavLink>
            <NavLink to="/history">History</NavLink>
            {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          </nav>
        )}
      </div>
      <div className="topbar-right">
        {showBell && <NotificationBell />}
        <PersonName id={user.id} name={user.name} />
        <ThemeToggle />
        <button className="btn btn-secondary btn-small" onClick={logout}>Log out</button>
      </div>
    </header>
  );
}
