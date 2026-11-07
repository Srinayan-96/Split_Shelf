import { Outlet } from 'react-router-dom';
import { HouseholdProvider } from '../context/HouseholdContext';
import { NotificationProvider } from '../context/NotificationContext';
import { useHousehold } from '../hooks/useHousehold';
import Onboarding from '../pages/Onboarding';

// Decides what a logged-in user sees: loading, an error with retry,
// onboarding (no household yet), or the real app.
function HouseholdGate() {
  const { household, status, loadError, reload } = useHousehold();

  if (status === 'loading') return <div className="center-screen">Loading…</div>;

  if (status === 'error') {
    return (
      <div className="center-screen">
        <div className="stack">
          <div className="alert" role="alert">{loadError}</div>
          <button className="btn" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }

  if (!household) return <Onboarding />;

  // The notification state lives HERE, above every page, so moving between
  // pages doesn't reset the badge or start a second poller.
  return (
    <NotificationProvider>
      <Outlet />
    </NotificationProvider>
  );
}

export default function HouseholdLayout() {
  // Sits INSIDE ProtectedRoute, so logging out removes it and its state with it.
  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  );
}
