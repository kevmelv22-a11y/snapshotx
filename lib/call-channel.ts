import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Joins a broadcast-only Realtime channel and resolves once it is subscribed. */
export function joinBroadcast(topic: string, onMessage?: (event: string, payload: unknown) => void, timeoutMs = 10000): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    const ch = supabase.channel(topic, { config: { broadcast: { self: false, ack: false } } });
    if (onMessage) ch.on('broadcast', { event: '*' }, (m: { event: string; payload: unknown }) => onMessage(m.event, m.payload));
    const t = setTimeout(() => { void supabase.removeChannel(ch); reject(new Error('Geen verbinding met de belserver.')); }, timeoutMs);
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(ch); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); void supabase.removeChannel(ch); reject(new Error('Geen verbinding met de belserver.')); }
    });
  });
}

export async function sendBroadcast(ch: RealtimeChannel, event: string, payload: object) {
  await ch.send({ type: 'broadcast', event, payload });
}

/** One-shot: send a single message to a topic (e.g. an invite or a decline) and leave. */
export async function sendOnce(topic: string, event: string, payload: object) {
  const ch = await joinBroadcast(topic);
  try { await sendBroadcast(ch, event, payload); } finally { void supabase.removeChannel(ch); }
}

/** The call currently on screen (to answer "busy" to a second incoming call). */
export const activeCall: { id: string | null } = { id: null };
