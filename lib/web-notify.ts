/**
 * Snapchat Web desktop notifications: when the SnapShot X tab is in the background, a browser notification
 * says WHO sent you something, never the content (same rule as push on the phone).
 * Opt-in per browser (localStorage) + browser permission + the account's Meldingen prefs + per-chat mute.
 * Pure helpers; the DOM wiring is components/web/WebNotifier.tsx.
 */
export const WEB_NOTIFY_KEY = 'sx.webnotify.v1';
export type BrowserPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export type NotifyInput = {
  browserOn: boolean; permission: BrowserPermission; hidden: boolean;
  /** shouldNotify(prefs,'chats') from lib/notification-prefs.ts */
  prefsAllow: boolean; muted: boolean;
  senderId: string | null | undefined; me: string; kind: string | null | undefined;
};

export function shouldWebNotify(i: NotifyInput): boolean {
  return i.browserOn && i.permission === 'granted' && i.hidden && i.prefsAllow && !i.muted
    && !!i.senderId && i.senderId !== i.me && i.kind !== 'system';
}

const WHAT: Record<string, string> = { snap: 'een snap', photo: 'een foto', video: 'een video', voice: 'een spraakbericht', sticker: 'een sticker' };

/** "Noor" / "stuurde je een snap"; group: "Weekend crew" / "Noor stuurde een chat". */
export function webNotifyContent(sender: string | null | undefined, kind: string | null | undefined, groupTitle?: string | null): { title: string; body: string } {
  const who = (sender ?? '').trim() || 'Een vriend';
  const what = WHAT[String(kind ?? '')] ?? 'een chat';
  const group = (groupTitle ?? '').trim();
  return group ? { title: group, body: `${who} stuurde ${what}` } : { title: who, body: `stuurde je ${what}` };
}

/** Description under the switch in Meldingen (web). */
export function webNotifyStatus(permission: BrowserPermission, on: boolean): string {
  if (permission === 'unsupported') return 'Deze browser ondersteunt geen meldingen.';
  if (permission === 'denied') return 'Geblokkeerd door je browser. Sta meldingen toe via het slotje naast het adres en zet deze schakelaar opnieuw aan.';
  if (on && permission === 'granted') return 'Aan: je krijgt een melding als SnapShot X op de achtergrond open staat.';
  return 'Krijg een melding op je computer als iemand je een chat of snap stuurt terwijl SnapShot X op de achtergrond open staat.';
}

export function permissionOf(n: { permission?: unknown } | null | undefined): BrowserPermission {
  const p = n?.permission;
  return p === 'granted' || p === 'denied' || p === 'default' ? p : 'unsupported';
}
