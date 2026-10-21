/**
 * Group chat management ("Groepsinfo"): permission checks, member limits, system-line texts and RPC error
 * mapping. Pure (no React Native imports) so it runs under `node --test`; the demo client (lib/demo-client.ts)
 * uses the same rules so the web demo behaves like the SQL RPCs in
 * supabase/migrations/20261021150000_group_chat_management.sql (which also builds the same Dutch lines).
 */

/** Max members of a group INCLUDING the creator (same cap as sx_open_thread: 20 friends max). */
export const GROUP_MAX_MEMBERS = 20;
/** sx_open_thread stores left(group_title, 80). */
export const GROUP_TITLE_MAX = 80;
/** sx_messages_system_no_media: system body ≤ 200 chars. */
const SYSTEM_MAX = 200;

export type GroupThreadInfo = { title?: string | null; isGroup?: boolean | null; memberCount: number };

/** A thread is a group when the server says so, or it has a name, or more than 2 members. */
export function isGroupThread(t: GroupThreadInfo): boolean {
  return !!t.isGroup || !!(t.title && t.title.trim()) || t.memberCount > 2;
}

/** Trimmed, single-spaced, ≤ 80 chars; null when empty (empty names are rejected). */
export function normalizeGroupTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, GROUP_TITLE_MAX).trim();
  return t ? t : null;
}

/** Header/list title: the group name, else the member names ("Aria, Eva en Cleo"), else 'Chat'. */
export function groupDisplayTitle(title: string | null | undefined, names: readonly string[]): string {
  const t = normalizeGroupTitle(title ?? '');
  return t ?? (names.length ? joinNames(names) : 'Chat');
}

/** Any member may rename the group and add friends (Snapchat behaviour); only the creator removes others. */
export function canRename(isMember: boolean): boolean { return isMember; }
export function canAddMembers(isMember: boolean, memberCount: number): boolean { return isMember && memberCount < GROUP_MAX_MEMBERS; }
export function canRemoveMember(me: string, creatorId: string | null | undefined, target: string, memberIds: readonly string[]): boolean {
  return !!me && !!creatorId && me === creatorId && target !== me && memberIds.includes(me) && memberIds.includes(target);
}

/** How many more people fit in the group. */
export function remainingSlots(memberCount: number): number {
  return Math.max(0, GROUP_MAX_MEMBERS - memberCount);
}

/** Friends that can still be added: not a member yet, unique, in list order. */
export function addableFriends<F extends { id: string }>(friends: readonly F[], memberIds: readonly string[]): F[] {
  const seen = new Set(memberIds);
  return friends.filter(f => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

/** Dutch reason why the selection cannot be added, or null when it is fine. */
export function validateAdd(memberCount: number, selected: readonly string[]): string | null {
  const n = new Set(selected).size;
  if (!n) return 'Kies minstens één vriend.';
  if (memberCount + n > GROUP_MAX_MEMBERS) {
    const left = remainingSlots(memberCount);
    return left ? `Er passen nog maar ${left} ${left === 1 ? 'persoon' : 'personen'} bij (max ${GROUP_MAX_MEMBERS}).` : `Deze groep is vol (max ${GROUP_MAX_MEMBERS} leden).`;
  }
  return null;
}

/** May the selection grow by one more friend? (Checklist toggle guard.) */
export function canSelectMore(memberCount: number, selectedCount: number): boolean {
  return memberCount + selectedCount < GROUP_MAX_MEMBERS;
}

/** "Lisa", "Lisa en Tim", "Lisa, Tim en Noor". */
export function joinNames(names: readonly string[]): string {
  const n = names.map(x => x.trim()).filter(Boolean);
  if (n.length <= 1) return n[0] ?? '';
  return `${n.slice(0, -1).join(', ')} en ${n[n.length - 1]}`;
}

const cap = (s: string) => s.slice(0, SYSTEM_MAX);
const who = (s: string | null | undefined) => (s ?? '').trim() || 'Iemand';

export const groupRenameText = (actor: string, title: string) => cap(`${who(actor)} heeft de groep hernoemd naar ${title}`);
export const groupAddText = (actor: string, added: readonly string[]) => cap(`${who(actor)} heeft ${joinNames(added.map(who))} toegevoegd`);
export const groupRemoveText = (actor: string, removed: string) => cap(`${who(actor)} heeft ${who(removed)} uit de groep verwijderd`);
export const groupLeaveText = (leaver: string) => cap(`${who(leaver)} heeft de groep verlaten`);

/** True for the system lines above (chat shows them with a 👥 icon). */
export function isGroupChangeText(body: string | null | undefined): boolean {
  return !!body && /heeft (de groep (hernoemd naar|verlaten)|.+ (toegevoegd|uit de groep verwijderd)$)/.test(body);
}

/** Members sorted for the list: me first, then the creator, then by name. */
export function sortMembers<M extends { id: string; name: string }>(members: readonly M[], me: string, creatorId: string | null | undefined): M[] {
  const rank = (m: M) => (m.id === me ? 0 : m.id === creatorId ? 1 : 2);
  return [...members].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'nl'));
}

/** Exception texts raised by the group RPCs (SQL and demo client) → Dutch UI copy. */
export const GROUP_ERRORS = {
  auth: 'Sign in required',
  notMember: 'Not a member of this group',
  notGroup: 'Not a group chat',
  notCreator: 'Only the group creator can remove members',
  full: 'Group is full (max 20)',
  notFriend: 'Only unblocked friends can be added',
  badTitle: 'Invalid group name',
  noTarget: 'Member not found',
  self: 'Use leave to remove yourself',
} as const;

const NL: Record<string, string> = {
  [GROUP_ERRORS.auth]: 'Log opnieuw in om dit te doen.',
  [GROUP_ERRORS.notMember]: 'Je bent geen lid meer van deze groep.',
  [GROUP_ERRORS.notGroup]: 'Dit is geen groepschat.',
  [GROUP_ERRORS.notCreator]: 'Alleen de maker van de groep kan leden verwijderen.',
  [GROUP_ERRORS.full]: `Deze groep is vol (max ${GROUP_MAX_MEMBERS} leden).`,
  [GROUP_ERRORS.notFriend]: 'Je kunt alleen vrienden toevoegen die je niet hebt geblokkeerd.',
  [GROUP_ERRORS.badTitle]: `Geef de groep een naam (max ${GROUP_TITLE_MAX} tekens).`,
  [GROUP_ERRORS.noTarget]: 'Dit lid zit niet (meer) in de groep.',
  [GROUP_ERRORS.self]: 'Gebruik "Groep verlaten" om jezelf te verwijderen.',
};

/** Dutch message for a group RPC error, or null when it is not one of ours (fall back to friendlyError). */
export function groupErrorText(e: unknown): string | null {
  const msg = String((e as { message?: unknown } | null)?.message ?? '');
  for (const [k, v] of Object.entries(NL)) if (msg.includes(k)) return v;
  if (/Could not find the function public\.sx_(rename_group|add_group_members|remove_group_member|leave_group)/.test(msg) || (e as { code?: unknown } | null)?.code === 'PGRST202')
    return 'Groepsbeheer is nog niet actief op de server (database-update nodig).';
  return null;
}
