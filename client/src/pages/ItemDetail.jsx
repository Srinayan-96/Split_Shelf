import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useHousehold } from '../hooks/useHousehold';
import ItemDetailSlideOver from '../components/ItemDetailSlideOver';

// Kept for direct URL access (/items/:itemId), smoothly opening the slide-over
export default function ItemDetail() {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { household } = useHousehold();
  const navigate = useNavigate();

  const me = household?.members?.find((m) => m.id === user?.id);
  const isAdmin = me?.role === 'admin';

  return (
    <ItemDetailSlideOver
      itemId={itemId}
      householdId={household.id}
      isAdmin={isAdmin}
      currentUserId={user.id}
      onClose={() => navigate('/', { replace: true })}
    />
  );
}
