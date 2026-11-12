import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards';
import HouseholdLayout from './components/HouseholdLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ItemDetail from './pages/ItemDetail';
import History from './pages/History';
import PersonHistory from './pages/PersonHistory';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<HouseholdLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/items/:itemId" element={<ItemDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/people/:userId" element={<PersonHistory />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
