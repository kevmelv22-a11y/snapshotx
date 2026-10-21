import React, { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import StaffPanel from './staff';
import { activateStaffMock, deactivateStaffMock } from '../lib/staff-mock';

/** Dev-only: the real staff console wired to the in-memory StaffMock (no Supabase).
 *  ?as=owner|admin|mod picks the signed-in staff member (permission checks). */
export default function DevStaff() {
  const { as = 'owner' } = useLocalSearchParams<{ as?: 'owner' | 'admin' | 'mod' }>();
  const [ready] = useState(() => { activateStaffMock(as); return true; });
  useEffect(() => () => deactivateStaffMock(), []);
  return <>{ready && <><Stack.Screen options={{ headerShown: false }} /><StaffPanel /></>}</>;
}
