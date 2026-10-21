/** Step 9: push notifications — provider abstraction + mock. Pure (no expo imports);
 *  the expo-notifications provider lives in pushExpo.ts, token storage in pushTokens.ts. */
export type PushKind = 'snap' | 'chat' | 'screenshot' | 'friend_request';
export type PushEvent =
  | { kind: 'snap'; from: string; threadId: string }
  | { kind: 'chat'; from: string; threadId: string; preview?: string }
  | { kind: 'screenshot'; from: string; threadId: string; what: 'chat' | 'snap' | 'story' }
  | { kind: 'friend_request'; from: string; requestId: string };
export type PushPayload = { title: string; body: string; data: { kind: PushKind; route: string }; channel: 'messages' | 'social' };
export type Delivered = PushPayload & { id: string; at: number };

export interface PushProvider {
  readonly name: 'mock' | 'expo';
  requestPermission(): Promise<boolean>;
  getToken(): Promise<string | null>;
  /** Local presentation (foreground or mock). Server-side sends go through the push-message edge function. */
  present(p: PushPayload): Promise<string>;
  onReceive(cb: (d: Delivered) => void): () => void;
}

/** Privacy: never include snap content; chat preview only when the user allows previews. */
export function buildPayload(e: PushEvent, opts: { previews?: boolean } = {}): PushPayload {
  switch (e.kind) {
    case 'snap': return { title: e.from, body: 'Nieuwe snap 👻', data: { kind: 'snap', route: `/chat/${e.threadId}` }, channel: 'messages' };
    case 'chat': return { title: e.from, body: opts.previews && e.preview ? e.preview.slice(0, 120) : 'Nieuw bericht', data: { kind: 'chat', route: `/chat/${e.threadId}` }, channel: 'messages' };
    case 'screenshot': return { title: e.from, body: `heeft een screenshot gemaakt van je ${e.what === 'chat' ? 'chat' : e.what}`, data: { kind: 'screenshot', route: `/chat/${e.threadId}` }, channel: 'messages' };
    case 'friend_request': return { title: 'Vriendschapsverzoek', body: `${e.from} wil je toevoegen`, data: { kind: 'friend_request', route: '/friends' }, channel: 'social' };
  }
}

export function isValidExpoToken(t: string): boolean { return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(t); }

export class MockPushProvider implements PushProvider {
  readonly name = 'mock' as const;
  delivered: Delivered[] = [];
  private subs = new Set<(d: Delivered) => void>();
  private n = 0;
  private granted: boolean; private now: () => number;
  constructor(granted = true, now: () => number = Date.now) { this.granted = granted; this.now = now; }
  async requestPermission() { return this.granted; }
  async getToken() { return this.granted ? 'ExponentPushToken[mock-device-0001]' : null; }
  async present(p: PushPayload) {
    const d: Delivered = { ...p, id: `mock-${++this.n}`, at: this.now() };
    this.delivered.unshift(d);
    this.subs.forEach(s => s(d));
    return d.id;
  }
  onReceive(cb: (d: Delivered) => void) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
}

export interface TokenStore { upsert(row: { token: string; platform: string; device_id: string }): Promise<void>; remove(token: string): Promise<void> }
export class MemoryTokenStore implements TokenStore {
  rows = new Map<string, { token: string; platform: string; device_id: string }>();
  async upsert(r: { token: string; platform: string; device_id: string }) { this.rows.set(r.token, r); }
  async remove(t: string) { this.rows.delete(t); }
}

/** Ask permission → get token → store it. Returns the token or null (denied/invalid). */
export async function registerForPush(p: PushProvider, store: TokenStore, device: { platform: string; deviceId: string }): Promise<string | null> {
  if (!(await p.requestPermission())) return null;
  const token = await p.getToken();
  if (!token || !isValidExpoToken(token)) return null;
  await store.upsert({ token, platform: device.platform, device_id: device.deviceId });
  return token;
}
