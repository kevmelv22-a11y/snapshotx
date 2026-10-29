/**
 * Snapchat-style reporting (App Store guideline 1.2: report + block for user-generated content).
 * A report is about a chat message, a story or a whole account (profile ⋯ › Account melden) and always has
 * a reason category; extra detail is optional except for "Iets anders".
 *
 * Server: migration 20261029030000_report_reasons_accounts.sql adds sx_reports.category + target_user_id.
 * Until it is applied, message/story reports fall back to the legacy columns (the category is also in the
 * reason text, so nothing is lost); account reports need the migration (the live insert policy requires a
 * message or story) and show ACCOUNT_REPORT_UNAVAILABLE instead. Pure (no React Native imports): tested with `npx tsx --test`.
 */
import { dbErrorKind } from './db-errors';

export type ReportReasonId = 'nudity' | 'harassment' | 'hate' | 'threat' | 'self_harm' | 'drugs' | 'impersonation' | 'spam' | 'other';
export type ReportTarget = { kind: 'message'; id: string } | { kind: 'story'; id: string } | { kind: 'account'; id: string; name?: string | null };

export type ReportReason = { id: ReportReasonId; label: string; hint: string };

export const REPORT_REASONS: ReportReason[] = [
  { id: 'nudity', label: 'Naaktheid of seksuele inhoud', hint: 'Naakt- of seksueel beeld, of iemand die erom vraagt.' },
  { id: 'harassment', label: 'Intimidatie of pesten', hint: 'Iemand wordt lastiggevallen, uitgescholden of buitengesloten.' },
  { id: 'hate', label: 'Haatzaaiende uitlatingen', hint: 'Haat tegen mensen om wie ze zijn: afkomst, geloof, gender, geaardheid.' },
  { id: 'threat', label: 'Bedreiging, geweld of gevaar', hint: 'Dreigen met geweld, of beelden van geweld.' },
  { id: 'self_harm', label: 'Zelfbeschadiging of zelfmoord', hint: 'Iemand die zichzelf iets wil aandoen.' },
  { id: 'drugs', label: 'Drugs, wapens of illegale handel', hint: 'Verkoop of aanbod van drugs, wapens of andere verboden zaken.' },
  { id: 'impersonation', label: 'Doet zich voor als iemand anders', hint: 'Nepaccount of iemand die zich als jou of een ander voordoet.' },
  { id: 'spam', label: 'Spam of oplichting', hint: 'Reclame, nepwinacties, phishing of geld afhandig maken.' },
  { id: 'other', label: 'Iets anders', hint: 'Beschrijf kort wat er aan de hand is.' },
];

const BY_ID = new Map(REPORT_REASONS.map(r => [r.id, r]));
export const reportReason = (id: string | null | undefined) => (id ? BY_ID.get(id as ReportReasonId) ?? null : null);
export const reportReasonLabel = (id: string | null | undefined) => reportReason(id)?.label ?? null;

/** Reasons offered for a target: "Doet zich voor als iemand anders" only makes sense for an account. */
export function reasonsFor(target: ReportTarget['kind']): ReportReason[] {
  return REPORT_REASONS.filter(r => r.id !== 'impersonation' || target === 'account');
}

export const MIN_OTHER_DETAIL = 10;
export const MAX_DETAIL = 800;
/** sx_reports.reason check: 10..1000 characters. */
const REASON_MIN = 10, REASON_MAX = 1000;

/** NL crisis line shown with "Zelfbeschadiging of zelfmoord" (113 Zelfmoordpreventie). */
export const SELF_HARM_HELP = 'Gaat het niet goed met jou of iemand anders? Praat anoniem met 113 Zelfmoordpreventie: bel 113 of 0800-0113 (gratis), of chat via 113.nl. Bij direct gevaar: bel 112.';

export function reportTitle(target: ReportTarget['kind']): string {
  return target === 'account' ? 'Account melden' : target === 'story' ? 'Story melden' : 'Bericht melden';
}

/** Validation in Dutch, or null when the report can be sent. */
export function reportError(reason: ReportReasonId | null, detail: string): string | null {
  if (!reason || !BY_ID.has(reason)) return 'Kies waarom je dit meldt.';
  const d = detail.trim();
  if (reason === 'other' && d.length < MIN_OTHER_DETAIL) return `Beschrijf in minstens ${MIN_OTHER_DETAIL} tekens wat er aan de hand is.`;
  if (d.length > MAX_DETAIL) return `Je toelichting is langer dan ${MAX_DETAIL} tekens.`;
  return null;
}

function clamp(text: string): string {
  const t = text.length > REASON_MAX ? text.slice(0, REASON_MAX - 1) + '…' : text;
  return t.length < REASON_MIN ? t.padEnd(REASON_MIN, '.') : t;
}

/** Reason column text: "<categorie>: <toelichting>" (always within the 10..1000 check). */
export function reportReasonText(reason: ReportReasonId, detail: string): string {
  const label = reportReasonLabel(reason) ?? 'Melding';
  const d = detail.trim().replace(/\s+/g, ' ');
  return clamp(d ? `${label}: ${d}` : label);
}

export const ACCOUNT_REPORT_UNAVAILABLE = 'Account melden wordt nog klaargezet op de server. Meld in de tussentijd een bericht of story van dit account, of blokkeer het.';

export type ReportRow = {
  reporter_id: string; message_id: string | null; story_id: string | null; reason: string;
  category?: ReportReasonId; target_user_id?: string | null;
};

/** Row for the migrated sx_reports (category + target_user_id). */
export function buildReportRow(reporter: string, target: ReportTarget, reason: ReportReasonId, detail: string): ReportRow {
  return {
    reporter_id: reporter,
    message_id: target.kind === 'message' ? target.id : null,
    story_id: target.kind === 'story' ? target.id : null,
    reason: reportReasonText(reason, detail),
    category: reason,
    target_user_id: target.kind === 'account' ? target.id : null,
  };
}

/** Row for the live sx_reports before the migration (only the originally granted columns; message/story only). */
export function buildLegacyReportRow(reporter: string, target: ReportTarget, reason: ReportReasonId, detail: string): ReportRow {
  return {
    reporter_id: reporter,
    message_id: target.kind === 'message' ? target.id : null,
    story_id: target.kind === 'story' ? target.id : null,
    reason: reportReasonText(reason, detail),
  };
}

/** The new columns are missing (PGRST204/42703) or not granted (42501 column permission): use the legacy row. */
export function shouldFallBack(error: unknown): boolean {
  const k = dbErrorKind(error);
  return k === 'missing_column' || k === 'permission';
}

type Inserter = (row: ReportRow) => PromiseLike<{ error: unknown }>;
/** Insert with fallback; returns the error of the last attempt (null on success). */
export async function submitReport(insert: Inserter, reporter: string, target: ReportTarget, reason: ReportReasonId, detail: string): Promise<{ error: unknown; legacy: boolean }> {
  const first = await insert(buildReportRow(reporter, target, reason, detail));
  if (!first.error) return { error: null, legacy: false };
  if (!shouldFallBack(first.error)) return { error: first.error, legacy: false };
  if (target.kind === 'account') return { error: { message: ACCOUNT_REPORT_UNAVAILABLE, code: 'SX_ACCOUNT_REPORT' }, legacy: false };
  const second = await insert(buildLegacyReportRow(reporter, target, reason, detail));
  return { error: second.error ?? null, legacy: true };
}

/** Which target the /report route params describe (message_id, story_id or user_id). */
export function targetFromParams(p: { message_id?: string | string[]; story_id?: string | string[]; user_id?: string | string[]; name?: string | string[] }): ReportTarget | null {
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || '';
  if (one(p.message_id)) return { kind: 'message', id: one(p.message_id) };
  if (one(p.story_id)) return { kind: 'story', id: one(p.story_id) };
  if (one(p.user_id)) return { kind: 'account', id: one(p.user_id), name: one(p.name) || null };
  return null;
}
