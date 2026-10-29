/**
 * Pure helpers for report review in the staff console: content snapshot display, which actions a report
 * allows, RPC arguments for public.sx_staff_report_action and audit <-> report linkage.
 * The server re-validates everything; these only drive the UI.
 */
import { readableBody } from './chat-replies';

export type ReportAction = 'warn' | 'ban_user' | 'delete_content';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed' | string;

export type ReportSnapshot = {
  type?: 'message' | 'story' | string;
  body?: string | null;
  caption?: string | null;
  kind?: string | null;
  media_type?: string | null;
  has_media?: boolean | null;
  view_once?: boolean | null;
  visibility?: string | null;
  created_at?: string | null;
  captured_at?: string | null;
  backfilled?: boolean | null;
  sender_id?: string | null;
  owner_id?: string | null;
  /** type 'profile' (account report): display name / username at report time. */
  display_name?: string | null;
  username?: string | null;
};

export type ReportLike = {
  id: string;
  status: ReportStatus;
  message_id: string | null;
  story_id: string | null;
  reported_user_id?: string | null;
  content_snapshot?: ReportSnapshot | null;
  action_taken?: ReportAction | string | null;
  action_ref?: string | null;
};

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  warn: 'Waarschuwen',
  ban_user: 'Gebruiker bannen',
  delete_content: 'Content verwijderen',
};

export const MIN_ACTION_REASON = 8;
export const MAX_ACTION_REASON = 1000;
export const BAN_DURATIONS: { label: string; minutes: number | null }[] = [
  { label: '1 uur', minutes: 60 }, { label: '24 uur', minutes: 1440 }, { label: '7 dagen', minutes: 10080 },
  { label: '30 dagen', minutes: 43200 }, { label: 'Permanent', minutes: null },
];

export const isReportOpen = (r: Pick<ReportLike, 'status'>) => r.status === 'open' || r.status === 'reviewing';

const KIND_LABEL: Record<string, string> = { text: 'Tekstbericht', photo: 'Foto', video: 'Video', voice: 'Spraakbericht', snap: 'Snap' };

export type SnapshotView = { title: string; text: string | null; media: string | null; meta: string[]; missing: boolean };

/** Human readable view of the captured content (text first, media only as an indicator). */
export function describeSnapshot(report: Pick<ReportLike, 'message_id' | 'story_id' | 'content_snapshot'> & { target_user_id?: string | null }): SnapshotView {
  const s = report.content_snapshot;
  if (s?.type === 'profile') {
    const who = [s.display_name?.trim(), s.username ? `@${s.username}` : null].filter(Boolean).join(' · ');
    return { title: 'Account', text: who || null, media: null, meta: s.backfilled ? ['Achteraf vastgelegd'] : [], missing: false };
  }
  const isStory = s?.type === 'story' || (!s && !!report.story_id);
  if (!s) {
    return { title: isStory ? 'Story' : 'Chatbericht', text: null, media: null, missing: true,
      meta: ['Geen momentopname opgeslagen (melding van vóór de migratie of content al verwijderd).'] };
  }
  const meta: string[] = [];
  if (isStory) {
    if (s.visibility) meta.push(s.visibility === 'everyone' ? 'Openbaar' : 'Vrienden');
    const media = s.media_type === 'video' ? 'Video-story' : 'Foto-story';
    if (s.backfilled) meta.push('Achteraf vastgelegd');
    return { title: 'Story', text: s.caption?.trim() || null, media, meta, missing: false };
  }
  const kind = (s.kind && KIND_LABEL[s.kind]) || 'Chatbericht';
  if (s.view_once) meta.push('Eenmalig bekijken');
  if (s.backfilled) meta.push('Achteraf vastgelegd');
  const media = s.has_media ? `${kind} (media niet in console te bekijken)` : null;
  return { title: kind, text: readableBody(s.body)?.trim() || null, media, meta, missing: false };
}

export type ActionAvailability = { action: ReportAction; label: string; enabled: boolean; why: string | null };

/** Which "take action" buttons a report offers, and why a disabled one is disabled. */
export function reportActions(report: ReportLike): ActionAvailability[] {
  const open = isReportOpen(report);
  const closed = open ? null : 'Melding is al afgehandeld.';
  const noUser = report.reported_user_id ? null : 'Gemelde gebruiker onbekend.';
  const noContent = report.message_id || report.story_id ? null : 'Content bestaat niet meer.';
  const row = (action: ReportAction, why: string | null): ActionAvailability =>
    ({ action, label: REPORT_ACTION_LABEL[action], enabled: !why, why });
  return [
    row('warn', closed ?? noUser),
    row('delete_content', closed ?? noContent),
    row('ban_user', closed ?? noUser),
  ];
}

export type ReportActionArgs = { p_report_id: string; p_action: ReportAction; p_reason: string; p_duration_minutes: number | null };

/** Validated RPC arguments, or an error message in Dutch. */
export function buildReportActionArgs(
  report: ReportLike, action: ReportAction, reason: string, durationMinutes: number | null = null,
): { ok: true; args: ReportActionArgs } | { ok: false; error: string } {
  const availability = reportActions(report).find(a => a.action === action);
  if (!availability) return { ok: false, error: 'Onbekende actie.' };
  if (!availability.enabled) return { ok: false, error: availability.why || 'Actie niet beschikbaar.' };
  const trimmed = reason.trim();
  if (trimmed.length < MIN_ACTION_REASON) return { ok: false, error: `Geef een reden van minimaal ${MIN_ACTION_REASON} tekens.` };
  if (trimmed.length > MAX_ACTION_REASON) return { ok: false, error: `Reden is langer dan ${MAX_ACTION_REASON} tekens.` };
  if (action !== 'ban_user' && durationMinutes !== null) return { ok: false, error: 'Een duur geldt alleen voor bans.' };
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 525600)) {
    return { ok: false, error: 'Duur moet tussen 1 minuut en 365 dagen liggen.' };
  }
  return { ok: true, args: { p_report_id: report.id, p_action: action, p_reason: trimmed, p_duration_minutes: action === 'ban_user' ? durationMinutes : null } };
}

/** Confirmation copy for the take-action dialog. */
export function actionConfirmText(action: ReportAction, who: string, durationLabel?: string): { title: string; message: string; destructive: boolean } {
  if (action === 'warn') return { title: 'Waarschuwing geven', message: `${who} krijgt een waarschuwing. De melding wordt afgehandeld en gekoppeld in de auditlog.`, destructive: false };
  if (action === 'delete_content') return { title: 'Content verwijderen', message: 'De gemelde content wordt verwijderd voor alle kijkers. De momentopname blijft bij de melding bewaard.', destructive: true };
  return { title: 'Gebruiker bannen', message: `${who} wordt geband (${durationLabel || 'Permanent'}). De ban wordt aan deze melding gekoppeld in de auditlog.`, destructive: true };
}

type AuditLike = { action: string; entity_type: string | null; entity_id: string | null; metadata?: Record<string, unknown> | null };

/** True when an audit row belongs to the report: the report row itself or an action taken from it. */
export function auditLinkedToReport(entry: AuditLike, reportId: string): boolean {
  if (entry.entity_type === 'sx_report' && entry.entity_id === reportId) return true;
  return entry.metadata?.report_id === reportId;
}

/** Short label for a resolved report, e.g. "Afgehandeld · Gebruiker bannen". */
export function reportOutcomeLabel(report: Pick<ReportLike, 'status' | 'action_taken'>): string {
  const base = report.status === 'open' ? 'Open' : report.status === 'reviewing' ? 'In review' : report.status === 'dismissed' ? 'Afgewezen' : 'Afgehandeld';
  const action = report.action_taken && (REPORT_ACTION_LABEL as Record<string, string>)[report.action_taken];
  return action ? `${base} · ${action}` : base;
}

/** Report queue category: snap (view-once chat media), story (friends), highlight (Uitgelicht: public story), chat. */
export type ReportCategory = 'snap' | 'story' | 'highlight' | 'chat' | 'account';
export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = { snap: 'Snap', story: 'Story', highlight: 'Uitgelicht', chat: 'Chat', account: 'Account' };
export function reportCategory(r: Pick<ReportLike, 'message_id' | 'story_id' | 'content_snapshot'> & { target_user_id?: string | null }): ReportCategory {
  const s = r.content_snapshot;
  if (s?.type === 'profile' || (!r.message_id && !r.story_id && r.target_user_id)) return 'account';
  if (s?.type === 'story' || (!s && r.story_id)) return s?.visibility === 'everyone' ? 'highlight' : 'story';
  return s?.kind === 'snap' ? 'snap' : 'chat';
}
