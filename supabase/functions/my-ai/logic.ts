// Pure logic for the "Mijn AI" edge function (no Deno / network here, so it is unit-tested from node:
// lib/my-ai.test.mjs). Shared with the app via lib/my-ai.ts (limits + Dutch errors).
export const AI_DAILY_LIMIT = 40;
export const AI_MAX_TURNS = 12;
export const AI_MAX_CHARS = 1000;
export const AI_MAX_TOKENS = 450;
export type AiTurn = { role: 'user' | 'assistant'; content: string };

export const SYSTEM_PROMPT = [
  'Je bent "Mijn AI", de vriendelijke AI-chatbuddy in de app Snapshot X (een Nederlandse foto- en chatapp, vergelijkbaar met Snapchat).',
  'Antwoord standaard in het Nederlands, kort en luchtig (meestal 1 tot 4 zinnen), met af en toe een passende emoji. Antwoord in een andere taal als de gebruiker die taal schrijft.',
  'Je bent een AI en geen mens: zeg dat eerlijk als iemand het vraagt. Doe je nooit voor als een echte vriend, medewerker of persoon.',
  'De gebruikers kunnen tieners zijn (13+). Geef geen seksuele, gewelddadige, haatdragende of illegale inhoud, geen hulp bij drugs, wapens, zelfbeschadiging, pesten of het hacken van accounts.',
  'Bij signalen van zelfbeschadiging, zelfmoordgedachten of acuut gevaar: reageer warm en serieus en verwijs naar 113 Zelfmoordpreventie (bel 113 of 0800-0113, of chat via 113.nl) of bij direct gevaar naar 112. Voor jongeren kan ook De Kindertelefoon (0800-0432).',
  'Vraag nooit om wachtwoorden, adressen, telefoonnummers of andere persoonlijke gegevens en raad aan die niet te delen.',
  'Geef geen medisch, juridisch of financieel advies als feit; raad dan aan een deskundige te raadplegen.',
  'Je kunt geen berichten versturen, geen snaps zien en niets in de app voor de gebruiker doen; je kunt wel tips geven over hoe Snapshot X werkt (snaps, verhalen, Gedeeld verhaal, Snap Map, Vriend-emoji\'s, Spelletjes, Herinneringen).',
].join('\n');

/** Validate + trim the client history: only user/assistant turns, non-empty, max chars, last AI_MAX_TURNS, must end with a user turn. */
export function cleanHistory(input: unknown): { ok: true; turns: AiTurn[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'bad_request' };
  const turns: AiTurn[] = [];
  for (const t of input.slice(-AI_MAX_TURNS * 2)) {
    const role = (t as { role?: unknown })?.role, content = (t as { content?: unknown })?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const c = content.replace(/\u0000/g, '').trim().slice(0, AI_MAX_CHARS);
    if (c) turns.push({ role, content: c });
  }
  const last = turns.slice(-AI_MAX_TURNS);
  while (last.length && last[0].role !== 'user') last.shift();
  if (!last.length || last[last.length - 1].role !== 'user') return { ok: false, error: 'bad_request' };
  return { ok: true, turns: last };
}
/** OpenAI-compatible chat body (Groq + OpenAI). `user` is a one-way hash, never the real id/email. */
export function chatRequest(model: string, turns: readonly AiTurn[], userHash: string) {
  return { model, temperature: 0.7, max_tokens: AI_MAX_TOKENS, user: userHash, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...turns] };
}
/** First assistant text from an OpenAI-compatible response, trimmed to a safe size. */
export function replyFrom(json: unknown): string | null {
  const c = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof c !== 'string') return null;
  const t = c.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return t ? t.slice(0, 2000) : null;
}
