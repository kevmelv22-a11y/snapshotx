/** Pure helpers for group invite links (snapshot-x.nl/g/<token>). */
import { GROUP_MAX_MEMBERS } from './group-chat';

export const GROUP_INVITE_PATH = '/g' as const;
export const GROUP_INVITE_TTL_DAYS = 7;

export const GROUP_INVITE_TEXT = {
  action: 'Uitnodigingslink',
  shareTitle: 'Uitnodiging voor Snapshot X-groep',
  copied: 'Link gekopieerd',
  revoke: 'Link intrekken',
  join: 'Lid worden',
  already: 'Je zit al in deze groep',
  expired: 'Deze uitnodiging is verlopen of ingetrokken.',
  full: `Deze groep is vol (max ${GROUP_MAX_MEMBERS} leden).`,
  blocked: 'Je kunt deze groep niet joinen.',
  signedOut: 'Log in om lid te worden van deze groep.',
} as const;

/** Hex token from sx_create_group_invite (32 chars). */
export function isGroupInviteToken(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[0-9a-f]{32}$/i.test(raw.trim());
}

/** Apex share URL (Android App Links use apex only). */
export function groupInviteUrl(token: string, origin = 'https://snapshot-x.nl'): string {
  const t = String(token ?? '').trim().toLowerCase();
  if (!isGroupInviteToken(t)) throw new Error('Ongeldige uitnodigingstoken');
  return `${origin.replace(/\/$/, '')}${GROUP_INVITE_PATH}/${t}`;
}

export function parseGroupInviteSegment(seg: string | undefined | null): string | null {
  const t = (seg ?? '').trim().toLowerCase();
  return isGroupInviteToken(t) ? t : null;
}

/** Map join RPC errors to Dutch UI copy. */
export function groupInviteErrorText(err: unknown): string | null {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/expired|revoked|invite not found/i.test(msg)) return GROUP_INVITE_TEXT.expired;
  if (/full/i.test(msg)) return GROUP_INVITE_TEXT.full;
  if (/blocked|interaction blocked/i.test(msg)) return GROUP_INVITE_TEXT.blocked;
  if (/sign in required|42501/i.test(msg)) return GROUP_INVITE_TEXT.signedOut;
  return null;
}
