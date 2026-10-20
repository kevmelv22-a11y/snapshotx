import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { getInstallationId } from './deviceIdentity';
import { DemoClient } from './demo-client';

/** Web demo build: EXPO_PUBLIC_DEMO_MODE=1 swaps in an in-memory client (no Supabase traffic at all). */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!DEMO_MODE && (!url || !key)) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env');

const fetchWithInstallationId: typeof fetch = async (input, init) => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  try { headers.set('x-snaplion-device-id', await getInstallationId()); } catch {}
  return fetch(input, { ...init, headers });
};

export const supabase = DEMO_MODE ? (new DemoClient() as unknown as ReturnType<typeof createClient>) : createClient(url!, key!, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  global: { fetch: fetchWithInstallationId },
});
