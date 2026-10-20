/** Real token store: writes to public.sx_push_tokens (schema.sql + migration 20261013190000_push_tokens_devices.sql).
 *  Not exercised in dev/tests — use MemoryTokenStore there. */
import { supabase } from '../supabase';
import type { TokenStore } from './push';

export const supabaseTokenStore: TokenStore = {
  async upsert({ token, platform, device_id }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Log opnieuw in.');
    const { error } = await supabase.from('sx_push_tokens')
      .upsert({ user_id: user.id, token, platform, device_id, updated_at: new Date().toISOString() }, { onConflict: 'user_id,token' });
    if (error) throw error;
  },
  async remove(token) {
    const { error } = await supabase.from('sx_push_tokens').delete().eq('token', token);
    if (error) throw error;
  },
};
