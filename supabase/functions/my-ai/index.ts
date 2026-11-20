// "Mijn AI" (Snapchat My AI-style chat buddy). verify_jwt = true: only signed-in Snapshot X users.
// - The LLM key never leaves the server: env LLM_API_KEY / GROQ_API_KEY / OPENAI_API_KEY or the existing
//   service_role-only Vault getters public.get_llm_api_key() / get_openai_api_key() (same as the analyze function).
// - Per user max AI_DAILY_LIMIT messages per day via public.sx_ai_take_quota (service_role only, migration 20261120080000).
// - Nothing of the conversation is stored on the server; the app keeps the history on the device only.
// Deploy: supabase functions deploy my-ai   (verify_jwt stays on)
import { AI_DAILY_LIMIT, chatRequest, cleanHistory, replyFrom } from './logic.ts';

const env = (k: string) => Deno.env.get(k) || undefined;
const URL_ = env('SUPABASE_URL')!, SRK = env('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  return r.json();
}
const keyCache: Record<string, string | undefined> = {};
async function vaultKey(name: string): Promise<string | undefined> {
  if (name in keyCache) return keyCache[name];
  try { const v = await rpc(name); keyCache[name] = typeof v === 'string' && v ? v : undefined; } catch { keyCache[name] = undefined; }
  return keyCache[name];
}
async function providers() {
  return [
    { name: 'groq', url: env('LLM_URL') ?? 'https://api.groq.com/openai/v1/chat/completions', model: env('MY_AI_MODEL') ?? env('LLM_MODEL') ?? 'openai/gpt-oss-120b', key: env('LLM_API_KEY') ?? env('GROQ_API_KEY') ?? await vaultKey('get_llm_api_key') },
    { name: 'openai', url: 'https://api.openai.com/v1/chat/completions', model: env('OPENAI_MODEL') ?? 'gpt-4o-mini', key: env('OPENAI_API_KEY') ?? await vaultKey('get_openai_api_key') },
  ].filter(p => !!p.key);
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const auth = req.headers.get('Authorization') ?? '';
  const who = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SRK, Authorization: auth } });
  const user = who.ok ? await who.json() as { id?: string } : null;
  if (!user?.id) return json(401, { error: 'auth' });
  let body: { messages?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  const h = cleanHistory(body?.messages);
  if (!h.ok) return json(400, { error: h.error });
  const list = await providers();
  if (!list.length) return json(503, { error: 'no_key' });
  let remaining: number;
  try { remaining = Number(await rpc('sx_ai_take_quota', { p_user: user.id, p_limit: AI_DAILY_LIMIT })); } catch (e) { console.error('quota', (e as Error).message); return json(503, { error: 'unavailable' }); }
  if (!(remaining >= 0)) return json(429, { error: 'quota', limit: AI_DAILY_LIMIT });
  const userHash = await sha256(`sx-my-ai:${user.id}`);
  for (const p of list) {
    try {
      const r = await fetch(p.url, { method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(chatRequest(p.model, h.turns, userHash)) });
      if (!r.ok) { console.warn('provider', p.name, r.status); continue; }
      const reply = replyFrom(await r.json());
      if (reply) return json(200, { reply, remaining });
    } catch (e) { console.warn('provider', p.name, (e as Error).message); }
  }
  return json(502, { error: 'unavailable' });
});
