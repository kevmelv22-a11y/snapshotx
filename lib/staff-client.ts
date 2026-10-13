/** Data client for the staff console: the real Supabase client, or the in-memory StaffMock when a dev
 *  harness (app/dev-staff) activated it. The mock implements only the subset app/staff uses. */
import { supabase } from './supabase';
import { staffMock } from './staff-mock';

export function staffDb(): typeof supabase {
  return (staffMock() as unknown as typeof supabase | null) ?? supabase;
}
export const isStaffMock = () => !!staffMock();
