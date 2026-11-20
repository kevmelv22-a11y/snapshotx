/** Mijn AI (Snapchat "My AI"-style chat buddy) — app side. The model runs in the Supabase edge function `my-ai`
 *  (supabase/functions/my-ai): the API key stays on the server, max AI_DAILY_LIMIT messages per day, nothing of the
 *  conversation is stored on the server. The history lives on this device only (stores/myAi.ts). Pure + unit-tested. */
import { AI_DAILY_LIMIT, AI_MAX_CHARS, AI_MAX_TURNS, type AiTurn } from '../supabase/functions/my-ai/logic';
export { AI_DAILY_LIMIT, AI_MAX_CHARS, AI_MAX_TURNS, type AiTurn };
export const AI_NAME = 'Mijn AI';
export const AI_MAX_STORED = 200;
export type AiMessage = AiTurn & { id: string; at: number; failed?: boolean };
export const AI_WELCOME = 'Hoi! Ik ben Mijn AI ✨ Vraag me iets: een leuk onderschrift voor je snap, een idee voor het weekend of hoe iets in Snapshot X werkt. Ik ben een AI, geen mens.';
export const AI_DISCLAIMER = 'Mijn AI is een AI-chatbot en kan fouten maken. Deel geen persoonlijke gegevens. Je berichten gaan naar een AI-dienst om een antwoord te maken en worden niet bewaard op onze server; de chat staat alleen op dit apparaat.';
export const AI_SUGGESTIONS = ['Bedenk een grappig onderschrift voor een strandfoto 🏖️', 'Wat kunnen we dit weekend doen met vrienden?', 'Hoe werkt een Gedeeld verhaal?', 'Vertel een mop 😄'] as const;

/** Turns sent to the server: the last AI_MAX_TURNS, failed/empty ones skipped. */
export function turnsForRequest(history: readonly AiMessage[]): AiTurn[] {
  return history.filter(m => !m.failed && m.content.trim()).slice(-AI_MAX_TURNS).map(m => ({ role: m.role, content: m.content.slice(0, AI_MAX_CHARS) }));
}
export function cleanInput(text: string): string | null {
  const t = text.replace(/\s+\n/g, '\n').trim();
  return t ? t.slice(0, AI_MAX_CHARS) : null;
}
/** Dutch text for an edge-function error code / HTTP status. */
export function aiErrorText(code: string | null | undefined, status?: number): string {
  if (code === 'quota' || status === 429) return `Je hebt vandaag al ${AI_DAILY_LIMIT} berichten naar Mijn AI gestuurd. Morgen kan het weer!`;
  if (code === 'auth' || status === 401) return 'Log opnieuw in om Mijn AI te gebruiken.';
  if (code === 'no_key') return 'Mijn AI is nog niet ingeschakeld. Probeer het later opnieuw.';
  if (code === 'bad_request' || status === 400) return 'Dat bericht kon niet worden verstuurd.';
  return 'Mijn AI is even niet bereikbaar. Probeer het zo opnieuw.';
}
/** Keep the stored history bounded. */
export function appendCapped(history: readonly AiMessage[], ...add: AiMessage[]): AiMessage[] { return [...history, ...add].slice(-AI_MAX_STORED); }
/** Demo mode (no backend): simple canned answers so the screen can be tried. */
export function demoReply(text: string): string {
  const t = text.toLowerCase();
  if (/onderschrift|caption/.test(t)) return 'Wat dacht je van: „Zon, zee en zero zorgen ☀️🌊”?';
  if (/weekend|doen/.test(t)) return 'Picknick in het park, samen fietsen of een filmavond met snacks 🍿 Maak er een Gedeeld verhaal van!';
  if (/gedeeld verhaal/.test(t)) return 'Ga naar Verhalen → Gedeelde verhalen → Nieuw. Kies een naam en vrienden; alleen de leden zien het en kunnen snaps toevoegen 👥';
  if (/mop|grap/.test(t)) return 'Waarom nam de smartphone een bril? Omdat hij zijn contacten kwijt was 🤓';
  if (/ben je (een )?mens|echt persoon/.test(t)) return 'Nee, ik ben een AI-chatbot, geen mens 🤖';
  return 'Leuke vraag! (Demo-modus: hier komt straks het echte antwoord van Mijn AI.) ✨';
}
let n = 0;
export const aiMessageId = (now = Date.now()) => `ai${now.toString(36)}${(++n).toString(36)}`;
export const aiMessage = (role: AiMessage['role'], content: string, now = Date.now()): AiMessage => ({ id: aiMessageId(now), role, content, at: now });
