import { useContext } from 'react';
import { HouseholdContext } from '../context/HouseholdContext';

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>');
  return ctx;
}
