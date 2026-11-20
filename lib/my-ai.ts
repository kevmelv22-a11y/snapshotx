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
/** In-app melding of an AI reply (Google Play generative-AI policy). Stored in public.sx_ai_reports (insert own only). */
export type AiReportReason = 'offensive' | 'harmful' | 'sexual' | 'wrong' | 'other';
export const AI_REPORT_REASONS: readonly { id: AiReportReason; label: string }[] = [
  { id: 'offensive', label: 'Beledigend of haatdragend' }, { id: 'harmful', label: 'Gevaarlijk of schadelijk advies' },
  { id: 'sexual', label: 'Seksueel of ongepast' }, { id: 'wrong', label: 'Klopt niet / misleidend' }, { id: 'other', label: 'Iets anders' },
];
/** Row for sx_ai_reports: the reported reply + the question right before it (both trimmed to the column limits). */
export function aiReportRow(reporterId: string, reason: AiReportReason, history: readonly AiMessage[], replyId: string, detail?: string | null) {
  const i = history.findIndex(m => m.id === replyId), reply = history[i];
  if (!reply || reply.role !== 'assistant') return null;
  const prompt = [...history.slice(0, i)].reverse().find(m => m.role === 'user');
  const d = (detail ?? '').trim();
  return { reporter_id: reporterId, reason, reply_text: reply.content.slice(0, 2000), prompt_text: prompt ? prompt.content.slice(0, 1000) : null, detail: d ? d.slice(0, 800) : null };
}
/** Explicit permission before the first message leaves the device (App Store guideline 5.1.2(i), Nov 2025: name the
 *  third-party AI, say what is sent, affirmative "Toestaan", easy to withdraw). Stored per account on this device; bump
 *  AI_CONSENT_VERSION when the providers or the data sent change, so everyone is asked again. */
export const AI_CONSENT_VERSION = 1;
export const AI_CONSENT = {
  title: 'Mijn AI gebruikt een externe AI-dienst',
  points: [
    'Je berichten aan Mijn AI en de laatste berichten van dit gesprek gaan naar Groq (VS); als die niet werkt naar OpenAI (VS). Zij maken het antwoord.',
    'We sturen geen naam, e-mailadres, gebruikersnaam, locatie, foto’s of chats met vrienden mee — alleen een onherkenbare code om misbruik te beperken.',
    'Wij bewaren het gesprek niet op onze server; het staat alleen op dit apparaat.',
    'Je kunt je toestemming altijd intrekken via het schildje bovenaan.',
  ],
  allow: 'Toestaan', deny: 'Niet nu', withdraw: 'Toestemming intrekken',
  withdrawTitle: 'Toestemming voor Mijn AI intrekken?',
  withdrawMessage: 'Mijn AI stuurt dan niets meer naar de AI-dienst. Je gesprek blijft op dit apparaat staan tot je het wist.',
  denied: 'Zonder toestemming stuurt Mijn AI niets door. Je kunt het later altijd nog toestaan.',
} as const;
export function hasAiConsent(consents: Readonly<Record<string, number>> | undefined, uid: string): boolean {
  return !!uid && (consents?.[uid] ?? 0) >= AI_CONSENT_VERSION;
}
