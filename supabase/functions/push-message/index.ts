// Database Webhook target: fires on INSERT into public.sx_messages.
// Sends one Expo push notification per recipient, per message.
// Privacy: the push body NEVER includes chat text, media, or captions —
// only a generic phrase plus the sender's display name and message kind.
// Deploy: supabase functions deploy push-message
// The invocation token and Expo access token are stored in Supabase Vault;
// only this server-side function may read them via service_role-only RPCs.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: 'public';
  record: { id: string; thread_id: string; sender_id: string; kind: string };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// verify_jwt is disabled for this function: the webhook supplies a dedicated
// 256-bit token, not a user JWT or a Supabase API key. Fail closed.
async function authorizedServerCall(req: Request): Promise<boolean> {
  const supplied = req.headers.get('x-snapshotx-job-key') || '';
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const { data: expected, error } = await supabase.rpc('sx_internal_job_token');
  if (error || typeof expected !== 'string') {
    console.error('Server invocation token unavailable', error?.message);
    return false;
  }
  let difference = supplied.length ^ expected.length;
  for (let i = 0; i < Math.max(supplied.length, expected.length); i++) {
    difference |= (supplied.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
}

function bodyFor(kind: string, viewOnce: boolean, senderName: string): string {
  if (kind === 'snap') return `${senderName} stuurde je een snap${viewOnce ? ' (eenmalig te openen)' : ''}.`;
  if (kind === 'voice') return `${senderName} stuurde een spraakbericht.`;
  if (kind === 'photo' || kind === 'video') return `${senderName} stuurde media.`;
  return `${senderName} stuurde je een bericht.`;
}

Deno.serve(async (req) => {
  if (!await authorizedServerCall(req)) return new Response('unauthorized', { status: 401 });
  try {
    const payload: WebhookPayload = await req.json();
    if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'sx_messages') {
      return new Response('ignored', { status: 200 });
    }
    const messageId = payload.record.id;

    const { data: recipients, error } = await supabase.rpc('sx_push_recipients', {
      p_message_id: messageId,
    });
    if (error) throw error;
    if (!recipients || recipients.length === 0) {
      return new Response('no recipients', { status: 200 });
    }

    const { data: expoAccessToken, error: tokenError } = await supabase.rpc('sx_internal_push_token');
    if (tokenError || typeof expoAccessToken !== 'string' || !expoAccessToken) {
      throw new Error('Expo access token is not available in Vault');
    }
    // Meldingen › Geluid (sx_preferences.notify_prefs.sound, migration 20261029120000). Column missing → sound on.
    const silent = new Set<string>();
    const prefRows = await supabase.from('sx_preferences').select('user_id, notify_prefs')
      .in('user_id', [...new Set(recipients.map((r: any) => r.user_id))]);
    if (!prefRows.error) for (const row of prefRows.data || []) if ((row as any).notify_prefs?.sound === false) silent.add((row as any).user_id);
    const messages = recipients
      .filter((r: any) => !!r.expo_token)
      .map((r: any) => ({
        to: r.expo_token,
        sound: silent.has(r.user_id) ? null : 'default',
        title: 'SnapShot X',
        body: bodyFor(r.kind, r.view_once, r.sender_name || 'Iemand'),
        // No message text or media ever included here — only enough to deep-link.
        data: { thread_id: payload.record.thread_id, message_id: messageId },
      }));

    if (messages.length > 0) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Authorization: `Bearer ${expoAccessToken}`,
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) throw new Error(`Expo push send failed: HTTP ${res.status}`);
      const result = await res.json();
      const tickets = Array.isArray(result.data) ? result.data : [result.data];
      if (tickets.length !== messages.length || tickets.some((ticket: { status?: string }) => ticket?.status !== 'ok')) {
        throw new Error('Expo rejected at least one push ticket; delivery was not recorded');
      }
    }

    // Expo acceptance is not device delivery. A retry can still duplicate a
    // notification if the database insert fails after Expo accepts it.
    const deliveries = [...new Set(recipients.filter((r: any) => !!r.expo_token).map((r: any) => r.user_id))]
      .map((user_id) => ({ message_id: messageId, user_id }));
    if (deliveries.length) {
      const { error: delivError } = await supabase.from('sx_push_recipient_deliveries').upsert(deliveries, { onConflict: 'message_id,user_id' });
      if (delivError) throw delivError;
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 500 });
  }
});
