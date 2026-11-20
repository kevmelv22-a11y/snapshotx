/** Staffpaneel › AI-meldingen: in-app reports of Mijn AI replies (public.sx_ai_reports), read via the staff-only RPC
 *  public.sx_staff_ai_reports (20261121000000). Read-only list; the table has no client SELECT policy. Pure. */
import { AI_REPORT_REASONS, type AiReportReason } from './my-ai';

export type StaffAiReport = { id: string; reason: AiReportReason | string; reply_text: string; prompt_text: string | null; detail: string | null; created_at: string; reporter_id: string; reporter_username: string | null };
export const AI_REPORTS_TEXT = {
  nav: 'AI-meldingen',
  intro: 'Gemelde antwoorden van Mijn AI. Het antwoord en de vraag ervoor zijn door de melder meegestuurd (AI-chats staan verder niet op de server). Alleen lezen.',
  empty: 'Nog geen AI-meldingen.',
} as const;
export function aiReasonLabel(reason: string): string {
  return AI_REPORT_REASONS.find(r => r.id === reason)?.label ?? 'Iets anders';
}
/** Rows from the RPC → newest first, junk dropped. */
export function cleanAiReports(rows: unknown): StaffAiReport[] {
  if (!Array.isArray(rows)) return [];
  return (rows as StaffAiReport[]).filter(r => r && typeof r.id === 'string' && typeof r.reply_text === 'string' && typeof r.created_at === 'string')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
/** Per-reason counts for the chips ("Klopt niet / misleidend · 2"). */
export function aiReasonCounts(rows: readonly StaffAiReport[]): { reason: string; label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.reason, (m.get(r.reason) ?? 0) + 1);
  return AI_REPORT_REASONS.filter(x => m.has(x.id)).map(x => ({ reason: x.id, label: x.label, count: m.get(x.id)! }));
}
