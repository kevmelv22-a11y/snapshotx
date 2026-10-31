/**
 * Chat drafts (concepten): text you typed but didn't send stays in that chat when you switch chats
 * (split view on web), leave the chat or reload. Device-local per account (stores/chatDrafts.ts).
 * Pure helpers so node tests can load them.
 */
export type Draft = { text: string; at: number };
export type DraftMap = Record<string, Draft>;

export const DRAFT_MAX = 50;
export const DRAFT_MAX_AGE_MS = 7 * 86400e3;
export const DRAFT_MAX_CHARS = 2000;
export const DRAFT_LABEL = 'Concept';

/** Store / replace / remove (empty or whitespace-only) the draft for one chat; keeps at most DRAFT_MAX newest. */
export function setDraft(map: DraftMap | undefined, threadId: string, text: string, now: number): DraftMap {
  const next: DraftMap = { ...(map ?? {}) };
  const t = String(text ?? '').slice(0, DRAFT_MAX_CHARS);
  if (!threadId) return next;
  if (!t.trim()) delete next[threadId];
  else next[threadId] = { text: t, at: now };
  return pruneDrafts(next, now);
}

/** Drop drafts older than DRAFT_MAX_AGE_MS and keep the DRAFT_MAX most recent. */
export function pruneDrafts(map: DraftMap | undefined, now: number): DraftMap {
  const live = Object.entries(map ?? {}).filter(([, d]) => d && typeof d.text === 'string' && d.text.trim() && Number.isFinite(d.at) && now - d.at <= DRAFT_MAX_AGE_MS);
  live.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(live.slice(0, DRAFT_MAX));
}

export function draftOf(map: DraftMap | undefined, threadId: string | null | undefined, now: number): string {
  const d = threadId ? map?.[threadId] : undefined;
  return d && now - d.at <= DRAFT_MAX_AGE_MS ? d.text : '';
}

/** One-line preview for the chat list: "Concept: Zie je morgen…". */
export function draftPreview(text: string, max = 40): string {
  const one = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!one) return '';
  return `${DRAFT_LABEL}: ${one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one}`;
}
