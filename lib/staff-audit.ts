/** Pure helpers for the staff console audit views (no React / Supabase imports, so they are unit-testable with node --test). */

export type BanTarget = { user_id?: string | null; ip?: string | null; device_id?: string | null };
export type BanRow = { id: string; ban_type: 'user' | 'ip' | 'device'; target_user_id: string | null; target_ip: string | null; target_device_id: string | null };
export type ProfileName = { id: string; username: string | null; display_name: string | null };
export type AuditLike = { action: string; entity_type: string | null; entity_id: string | null; metadata?: Record<string, unknown> | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client-side pre-check only; the server (uuid parameter type + login-history check) stays authoritative. */
export function isUuid(value: string): boolean { return UUID_RE.test(value.trim()); }

export function isBanAudit(entry: AuditLike): boolean {
  return entry.entity_type === 'sx_staff_ban' || entry.action === 'sx_staff_ban_create' || entry.action === 'sx_staff_ban_revoke';
}

function str(value: unknown): string | null { return typeof value === 'string' && value.length > 0 ? value : null; }

/** Ban target from audit metadata.target, falling back to the ban row (entity_id = ban id). */
export function banTargetOf(entry: AuditLike, bansById?: ReadonlyMap<string, BanRow>): BanTarget | null {
  const raw = entry.metadata?.target;
  if (raw && typeof raw === 'object') {
    const t = raw as Record<string, unknown>;
    const target: BanTarget = { user_id: str(t.user_id), ip: str(t.ip), device_id: str(t.device_id) };
    if (target.user_id || target.ip || target.device_id) return target;
  }
  const ban = entry.entity_id ? bansById?.get(entry.entity_id) : undefined;
  if (!ban) return null;
  if (ban.ban_type === 'user') return { user_id: ban.target_user_id };
  if (ban.ban_type === 'ip') return { ip: ban.target_ip };
  return { device_id: ban.target_device_id };
}

/** Human readable ban target: @username (or display name) for users, else the user id; IP / device id for IP / device bans. */
export function describeBanTarget(target: BanTarget | null, profiles: ReadonlyMap<string, ProfileName>): string | null {
  if (!target) return null;
  if (target.user_id) {
    const p = profiles.get(target.user_id);
    if (p?.username) return `@${p.username}`;
    if (p?.display_name) return `${p.display_name} (${target.user_id})`;
    return `gebruiker ${target.user_id}`;
  }
  if (target.ip) return `IP ${target.ip}`;
  if (target.device_id) return `apparaat ${target.device_id}`;
  return null;
}

/** Target label for any audit row: ban rows resolve to the banned user/IP/device, other rows keep the short entity id. */
export function auditTargetLabel(entry: AuditLike, profiles: ReadonlyMap<string, ProfileName>, bansById?: ReadonlyMap<string, BanRow>): string {
  if (isBanAudit(entry)) {
    const label = describeBanTarget(banTargetOf(entry, bansById), profiles);
    if (label) return label;
  }
  return entry.entity_id ? `#${entry.entity_id.slice(0, 8)}` : 'geen ID';
}

/** User ids referenced by ban audit rows that still need a profile lookup. */
export function missingBanUserIds(entries: AuditLike[], profiles: ReadonlyMap<string, ProfileName>, bansById?: ReadonlyMap<string, BanRow>): string[] {
  const ids = new Set<string>();
  for (const e of entries) {
    if (!isBanAudit(e)) continue;
    const uid = banTargetOf(e, bansById)?.user_id;
    if (uid && !profiles.has(uid)) ids.add(uid);
  }
  return [...ids];
}

/** Ban audit rows without metadata.target whose ban row must be fetched to resolve the target. */
export function banIdsWithoutTarget(entries: AuditLike[], bansById: ReadonlyMap<string, BanRow>): string[] {
  const ids = new Set<string>();
  for (const e of entries) if (isBanAudit(e) && e.entity_id && !banTargetOf(e) && !bansById.has(e.entity_id)) ids.add(e.entity_id);
  return [...ids];
}

/** Readable nl-NL timestamp (format from upstream 8d494f7's formatLocalTime). */
export function formatStaffTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Tijd onbekend' : d.toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
}
