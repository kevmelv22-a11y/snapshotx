/**
 * DEMO MODE (EXPO_PUBLIC_DEMO_MODE=1): an in-memory stand-in for the Supabase client so the web build can be
 * tried on a phone without ANY backend. Implements the supabase-js subset the app uses (from/rpc/auth/storage/
 * channel/functions) over seeded tables. Staff RPCs/tables come from the step-11 StaffMock (signed in as the
 * mock owner "kevin"). Data lives in memory and resets on reload. Never makes a network request.
 */
import { StaffMock, seedStaffMock, MOCK_IDS, type Row } from './staff-mock';

type Err = { message: string; code?: string; details?: string };
type Res = { data: unknown; error: Err | null; count?: number | null };
const H = 3600e3, D = 86400e3;
const ME = MOCK_IDS.owner;
export const DEMO_EMAIL = 'demo@snapshotx.app';

let seq = 0;
const newId = () => `de${(Date.now() % 1e6).toString(16).padStart(6, '0')}-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;

/** Placeholder "photo" for a storage path: a deterministic gradient SVG with an emoji + caption. */
const ART: Record<string, [string, string, string, string]> = {
  'demo/strand.svg': ['#ffb347', '#ff5e62', '🏖️', 'Strand'], 'demo/koffie.svg': ['#8e5c3b', '#d9a066', '☕', 'Koffie'],
  'demo/concert.svg': ['#4b134f', '#c94b4b', '🎸', 'Concert'], 'demo/fiets.svg': ['#11998e', '#38ef7d', '🚲', 'Fietsen'],
  'demo/pizza.svg': ['#f12711', '#f5af19', '🍕', 'Pizza'], 'demo/zonsondergang.svg': ['#0f2027', '#ff7e5f', '🌅', 'Avond'],
  'demo/hond.svg': ['#56ab2f', '#a8e063', '🐶', 'Max'], 'demo/stad.svg': ['#2c3e50', '#4ca1af', '🏙️', 'Amsterdam'],
};
function artUrl(path: string) {
  const [a, b, e, t] = ART[path] ?? ['#333', '#777', '📷', 'Demo'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/><text x="360" y="620" font-size="260" text-anchor="middle">${e}</text><text x="360" y="820" font-size="72" font-family="Helvetica,Arial" fill="white" text-anchor="middle">${t}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const EXTRA = { noor: '0b000000-0000-4000-8000-000000000016', tim: '0b000000-0000-4000-8000-000000000017' };
const T = { aria: 'c0000000-0000-4000-8000-0000000000a1', eva: 'c0000000-0000-4000-8000-0000000000a2', crew: 'c0000000-0000-4000-8000-000000000002' };

function seedDemo(m: StaffMock) {
  seedStaffMock(m);
  const I = MOCK_IDS, iso = (o: number) => m.iso(o);
  m.t.profiles.push({ id: EXTRA.noor, username: 'noor', display_name: 'Noor El Amrani', created_at: iso(-3 * D), is_verified: false },
    { id: EXTRA.tim, username: 'tim_vd', display_name: 'Tim van Dijk', created_at: iso(-20 * D), is_verified: false });
  m.t.profiles.forEach((p, i) => { p.gender = 'male'; p.avatar_path = null; p.activity_score = 400 + i * 37; });
  // Demo look: Kevin = the default character; his 4 friends have their own portraits (lib/avatar/friendArt).
  Object.assign(m.profile(ME)!, { username: 'kv.savage', display_name: 'Kevin', activity_score: 84732 });
  Object.assign(m.profile(I.aria)!, { display_name: 'Aria de Vries' });
  [I.aria, I.eva, I.cleo, EXTRA.noor].forEach(id => { m.profile(id)!.gender = 'female'; });
  Object.assign(m.profile(I.eva)!, { display_name: 'Eva Smit' });
  Object.assign(m.profile(I.cleo)!, { display_name: 'Cleo Jansen' });
  const friends = [I.aria, I.eva, I.cleo, EXTRA.noor];
  m.t.sx_friends = friends.flatMap(f => [{ user_id: ME, friend_id: f, created_at: iso(-30 * D) }, { user_id: f, friend_id: ME, created_at: iso(-30 * D) }]);
  m.t.sx_friend_requests = [{ id: 'fr000000-0000-4000-8000-000000000001', sender_id: EXTRA.tim, recipient_id: ME, status: 'pending', created_at: iso(-2 * H) }];
  m.t.sx_threads.push({ id: T.aria, title: null, created_at: iso(-10 * D), member_count: 2, retention_mode: 'keep' }, { id: T.eva, title: null, created_at: iso(-4 * D), member_count: 2, retention_mode: 'keep' });
  m.t.sx_threads.forEach(t => { t.retention_mode ??= 'keep'; });
  m.t.sx_members = [
    { thread_id: T.aria, user_id: ME }, { thread_id: T.aria, user_id: I.aria }, { thread_id: T.eva, user_id: ME }, { thread_id: T.eva, user_id: I.eva },
    ...[ME, EXTRA.noor, I.eva, I.cleo, I.aria].map(u => ({ thread_id: T.crew, user_id: u })),
    { thread_id: 'c0000000-0000-4000-8000-000000000001', user_id: I.aria }, { thread_id: 'c0000000-0000-4000-8000-000000000001', user_id: I.bram },
  ];
  const msg = (thread_id: string, sender_id: string, body: string, ago: number, kind = 'text', media_path: string | null = null) =>
    ({ id: newId(), thread_id, sender_id, body, kind, media_path, view_once: kind === 'snap', created_at: iso(-ago), expires_at: null });
  m.t.sx_messages.push(
    msg(T.aria, I.aria, 'Hé Kevin! Kom je vanavond ook naar het concert? 🎸', 5 * H), msg(T.aria, ME, 'Ja zeker, om 8 uur bij de ingang?', 4.8 * H),
    msg(T.aria, I.aria, 'Top, tot dan! 🙌', 4.7 * H), msg(T.aria, I.aria, 'photo', 1.2 * H, 'snap', 'demo/concert.svg'),
    msg(T.eva, I.eva, 'Heb je de foto’s van zaterdag nog?', 26 * H), msg(T.eva, ME, 'Komen eraan! Even zoeken 😅', 25 * H), msg(T.eva, I.eva, 'Haha oké 😄', 20 * H),
    msg(T.crew, I.cleo, 'Wie neemt de bal mee?', 3.5 * H), msg(T.crew, EXTRA.noor, 'Ik! ⚽', 3.4 * H));
  const st = (owner_id: string, path: string, caption: string | null, ago: number, visibility = 'friends') =>
    ({ id: newId(), owner_id, media_path: path, media_type: 'photo', caption, visibility, created_at: iso(-ago), expires_at: iso(24 * H - ago) });
  m.t.sx_stories.forEach((s, i) => { s.media_path = i ? 'demo/stad.svg' : 'demo/pizza.svg'; s.media_type = 'photo'; s.expires_at = m.iso(16 * H); });
  m.t.sx_stories.push(st(I.aria, 'demo/strand.svg', 'Zon, zee en zand ☀️', 2 * H, 'everyone'), st(I.aria, 'demo/koffie.svg', null, 1 * H),
    st(I.eva, 'demo/hond.svg', 'Max is jarig! 🎂', 3 * H, 'everyone'), st(I.cleo, 'demo/fiets.svg', 'Rondje Vondelpark', 5 * H),
    st(EXTRA.noor, 'demo/zonsondergang.svg', 'Wat een avond', 7 * H, 'everyone'));
  m.t.sx_story_views = []; m.t.sx_story_reactions = []; m.t.sx_reactions = []; m.t.sx_receipts = []; m.t.sx_blocks = [];
  m.t.sx_highlight_likes = []; m.t.sx_highlight_shares = []; m.t.sx_location_allowed = []; m.t.sx_push_tokens = [];
  m.t.sx_preferences = [{ user_id: ME, language: 'nl', find_me: true }];
  const loc = (user_id: string, lat: number, lng: number, ago: number) => ({ user_id, latitude: lat, longitude: lng, sharing: true, home_confirmed: false, updated_at: iso(-ago), share_audience: 'friends', ghost_until: null, ghost_forever: false });
  m.t.sx_locations = [loc(ME, 52.3676, 4.9041, 5 * 60e3), loc(I.aria, 52.3731, 4.8922, 10 * 60e3), loc(I.eva, 52.3584, 4.8811, 40 * 60e3), loc(I.cleo, 52.3600, 4.9200, 2 * H), loc(EXTRA.noor, 52.3791, 4.9003, 15 * 60e3)];
  m.t.memories = [{ id: newId(), owner_id: ME, storage_path: 'demo/zonsondergang.svg', media_type: 'photo', created_at: iso(-40 * D), private: false, caption: null, deleted_at: null },
    { id: newId(), owner_id: ME, storage_path: 'demo/pizza.svg', media_type: 'photo', created_at: iso(-370 * D), private: false, caption: 'Pizza-avond', deleted_at: null }];
  m.t.sx_memory_vault = []; m.t.sx_avatar_outfits = [];
}

const PK: Record<string, string[]> = {
  sx_story_views: ['story_id', 'viewer_id'], sx_preferences: ['user_id'], sx_locations: ['user_id'], sx_reactions: ['message_id', 'user_id'],
  sx_story_reactions: ['story_id', 'user_id'], sx_highlight_likes: ['story_id', 'user_id'], sx_push_tokens: ['user_id'], sx_avatar_outfits: ['user_id'],
  sx_memory_vault: ['user_id'], sx_receipts: ['message_id', 'user_id'], sx_location_allowed: ['owner_id', 'friend_id'], sx_members: ['thread_id', 'user_id'],
};
type Listener = { table: string; event: string; filter?: string; cb: (p: unknown) => void };

class DemoQuery implements PromiseLike<Res> {
  private f: ((r: Row) => boolean)[] = []; private ord: [string, boolean][] = []; private lim = Infinity; private off = 0;
  private one: 'single' | 'maybe' | null = null; private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row[] = []; private patch: Row = {}; private conflict?: string[]; private returning = false; private head = false; private count = false;
  constructor(private c: DemoClient, private name: string) {}
  select(_cols?: string, o?: { count?: string; head?: boolean }) { if (this.op !== 'select') this.returning = true; this.head = !!o?.head; this.count = !!o?.count; return this; }
  insert(v: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(v) ? v : [v]; return this; }
  upsert(v: Row | Row[], o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = Array.isArray(v) ? v : [v]; this.conflict = o?.onConflict?.split(',').map(s => s.trim()); return this; }
  update(v: Row) { this.op = 'update'; this.patch = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: unknown) { this.f.push(r => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.f.push(r => r[k] !== v); return this; }
  gt(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) > (v as string)); return this; }
  gte(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) >= (v as string)); return this; }
  lt(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) < (v as string)); return this; }
  lte(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) <= (v as string)); return this; }
  in(k: string, v: unknown[]) { this.f.push(r => v.includes(r[k])); return this; }
  is(k: string, v: unknown) { this.f.push(r => (r[k] ?? null) === v); return this; }
  ilike(k: string, p: string) { const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); this.f.push(r => re.test(String(r[k] ?? ''))); return this; }
  like(k: string, p: string) { return this.ilike(k, p); }
  match(o: Row) { Object.entries(o).forEach(([k, v]) => this.eq(k, v)); return this; }
  not(k: string, op: string, v: unknown) { const q = new DemoQuery(this.c, this.name); (q as unknown as Record<string, (a: string, b: unknown) => void>)[op]?.(k, v); const g = q.f[0]; if (g) this.f.push(r => !g(r)); return this; }
  order(k: string, o?: { ascending?: boolean }) { this.ord.push([k, o?.ascending ?? true]); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.off = a; this.lim = b - a + 1; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  abortSignal() { return this; }
  throwOnError() { return this; }
  private run(): Res {
    // Fault injection (see DemoClient.faults): reproduce live's missing GRANTs exactly as PostgREST reports them.
    if (this.c.faults.denied.has(this.name)) return { data: null, error: { message: `permission denied for table ${this.name}`, code: '42501' } };
    const t = this.c.m.table(this.name), now = this.c.m.iso();
    let out: Row[] = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      for (const raw of this.payload) {
        const row: Row = { ...raw };
        const keys = this.conflict ?? PK[this.name] ?? ['id'];
        const hit = this.op === 'upsert' && keys.every(k => row[k] != null) ? t.find(r => keys.every(k => r[k] === row[k])) : undefined;
        if (hit) { Object.assign(hit, row); out.push(hit); continue; }
        if (!PK[this.name] && row.id == null) row.id = newId();
        if (row.created_at == null && this.name !== 'sx_locations') row.created_at = now;
        if (this.name === 'sx_friend_requests') row.status ??= 'pending';
        if (this.name === 'sx_stories') row.expires_at ??= this.c.m.iso(24 * H);
        if (this.name === 'memories') row.deleted_at ??= null;
        t.push(row); out.push(row); this.c.emit(this.name, 'INSERT', row);
      }
    } else {
      let rows = t.filter(r => this.f.every(g => g(r)));
      if (this.op === 'update') { rows.forEach(r => { Object.assign(r, this.patch); this.c.emit(this.name, 'UPDATE', r); }); out = rows; }
      else if (this.op === 'delete') { this.c.m.t[this.name] = t.filter(r => !rows.includes(r)); rows.forEach(r => this.c.emit(this.name, 'DELETE', r)); out = rows; }
      else {
        for (const [k, asc] of [...this.ord].reverse()) rows = [...rows].sort((a, b) => (a[k] == null ? -1 : b[k] == null ? 1 : a[k]! < b[k]! ? -1 : a[k]! > b[k]! ? 1 : 0) * (asc ? 1 : -1));
        const total = rows.length; rows = rows.slice(this.off, this.off + this.lim);
        if (this.head) return { data: null, error: null, count: total };
        return this.wrap(rows, this.count ? total : null);
      }
    }
    if (!this.returning) return { data: null, error: null };
    return this.wrap(out, null);
  }
  private wrap(rows: Row[], count: number | null): Res {
    const data = JSON.parse(JSON.stringify(rows)) as Row[];
    if (this.one) {
      if (data.length === 1 || (this.one === 'maybe' && data.length === 0)) return { data: data[0] ?? null, error: null };
      if (this.one === 'maybe') return { data: data[0], error: null };
      // Same text supabase-js/PostgREST returns for .single() on 0 rows (the live "Cannot coerce" error).
      return { data: null, error: { message: 'Cannot coerce the result to a single JSON object', code: 'PGRST116', details: `The result contains ${data.length} rows` } };
    }
    return { data, error: null, count };
  }
  then<A, B>(ok?: ((v: Res) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    let v: Res; try { v = this.run(); } catch (e) { v = { data: null, error: { message: (e as Error).message } }; }
    return new Promise<Res>(r => setTimeout(() => r(v), 30)).then(ok, bad);
  }
}

const REPLIES = ['Haha 😄', 'Klinkt goed!', 'Echt? 😮', 'Top 👍', 'Zie je straks!', 'Haha ja precies', '🔥🔥'];

/**
 * Demo-only fault injection to reproduce the live backend state without touching it:
 * `?demo_faults=live` (or localStorage 'sx-demo-faults') = no GRANT on sx_locations/sx_stories/sx_friends,
 * no profiles row for the signed-in user and no sx_ensure_profile RPC (migration 20261019120000 not applied).
 * Also accepts a comma list: table names (denied), 'no-profile', 'no-ensure'.
 */
function readFaults(): { denied: Set<string>; noProfile: boolean; noEnsure: boolean } {
  let raw = '';
  try {
    const q = new URLSearchParams(String(globalThis.location?.search ?? '')).get('demo_faults');
    if (q !== null) globalThis.localStorage?.setItem('sx-demo-faults', q);
    raw = q ?? globalThis.localStorage?.getItem('sx-demo-faults') ?? '';
  } catch {}
  const parts = raw.split(',').map(x => x.trim()).filter(Boolean).flatMap(x => (x === 'live' ? ['sx_locations', 'sx_stories', 'sx_friends', 'no-profile', 'no-ensure'] : [x]));
  return { denied: new Set(parts.filter(x => /^(sx_[a-z_]+|memories|profiles)$/.test(x))), noProfile: parts.includes('no-profile'), noEnsure: parts.includes('no-ensure') };
}

export class DemoClient {
  m = new StaffMock(seedDemo, ME);
  faults = readFaults();
  private listeners = new Set<Listener>();
  private authCbs = new Set<(e: string, s: unknown) => void>();
  private uploads: Record<string, string> = {};
  private session: Row | null = null;
  private meta: Row = { display_name: 'Kevin', gender: 'male' };
  constructor() {
    try {
      const meta = JSON.parse(globalThis.localStorage?.getItem('sx-demo-meta') ?? 'null') as Row | null;
      if (meta) { Object.assign(this.meta, meta); Object.assign(this.m.profile(ME) ?? {}, { gender: meta.gender === 'female' ? 'female' : 'male', ...(meta.display_name ? { display_name: meta.display_name } : {}), ...(meta.username ? { username: meta.username } : {}) }); }
      if (globalThis.localStorage?.getItem('sx-demo-signed-in') === '1') this.session = this.makeSession();
    } catch {}
    if (this.faults.noProfile) this.m.t.profiles = this.m.t.profiles.filter(p => p.id !== ME);
  }
  private makeSession(): Row {
    return { access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: ME, email: DEMO_EMAIL, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: this.meta, created_at: this.m.iso(-400 * D) } };
  }
  private setSession(s: Row | null, event: string) {
    this.session = s;
    try { globalThis.localStorage?.setItem('sx-demo-signed-in', s ? '1' : '0'); globalThis.localStorage?.setItem('sx-demo-meta', JSON.stringify(this.meta)); } catch {}
    this.authCbs.forEach(cb => setTimeout(() => cb(event, s), 0));
  }
  emit(table: string, event: string, row: Row) {
    for (const l of this.listeners) {
      if (l.table !== table || (l.event !== '*' && l.event !== event)) continue;
      if (l.filter) { const [k, v] = l.filter.split('=eq.'); if (String(row[k]) !== v) continue; }
      setTimeout(() => l.cb({ eventType: event, new: row, old: {}, table, schema: 'public' }), 10);
    }
    if (table === 'sx_messages' && event === 'INSERT' && row.sender_id === ME && row.kind !== 'system') this.autoReply(String(row.thread_id));
  }
  private autoReply(threadId: string) {
    const peers = this.m.table('sx_members').filter(x => x.thread_id === threadId && x.user_id !== ME).map(x => String(x.user_id));
    if (!peers.length) return;
    setTimeout(() => {
      const row = { id: newId(), thread_id: threadId, sender_id: peers[Math.floor(Math.random() * peers.length)], kind: 'text', body: REPLIES[Math.floor(Math.random() * REPLIES.length)], media_path: null, created_at: this.m.iso(), expires_at: null };
      this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row);
    }, 1800);
  }
  from(table: string) { return new DemoQuery(this, table); }
  private appRpcs: Record<string, (a: Row) => unknown> = {
    sx_open_thread: a => {
      const ps = (a.participants as string[]) ?? [];
      if (ps.length === 1) { const mine = this.m.table('sx_members').filter(x => x.user_id === ME).map(x => x.thread_id);
        const hit = mine.find(t => { const mem = this.m.table('sx_members').filter(x => x.thread_id === t); return mem.length === 2 && mem.some(x => x.user_id === ps[0]); });
        if (hit) return hit; }
      const id = newId();
      this.m.table('sx_threads').push({ id, title: a.group_title ?? null, created_at: this.m.iso(), member_count: ps.length + 1, retention_mode: 'keep' });
      [ME, ...ps].forEach(u => this.m.table('sx_members').push({ thread_id: id, user_id: u }));
      return id;
    },
    sx_accept_friend: a => {
      const r = this.m.table('sx_friend_requests').find(x => x.id === a.request_id); if (!r) throw new Error('request not found');
      r.status = 'accepted'; const now = this.m.iso();
      this.m.table('sx_friends').push({ user_id: r.sender_id, friend_id: r.recipient_id, created_at: now }, { user_id: r.recipient_id, friend_id: r.sender_id, created_at: now });
      return null;
    },
    sx_claim_snap: () => true,
    sx_set_retention: a => {
      const t = this.m.table('sx_threads').find(x => x.id === a.p_thread_id); if (t) t.retention_mode = a.p_mode;
      const row = { id: newId(), thread_id: a.p_thread_id, sender_id: ME, kind: 'system', body: a.p_text, created_at: this.m.iso(), expires_at: null };
      this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row); return null;
    },
    sx_hide_suggestion: () => null,
    sx_suggest_friends: a => {
      const fr = new Set(this.m.table('sx_friends').filter(x => x.user_id === ME).map(x => x.friend_id));
      return this.m.table('profiles').filter(p => p.id !== ME && !fr.has(p.id)).slice(0, Number(a.p_limit ?? 20)).map(p => ({ user_id: p.id, username: p.username, display_name: p.display_name, mutuals: 2 }));
    },
    sx_highlight_feed: () => this.m.table('sx_stories').filter(s => s.visibility === 'everyone' && String(s.expires_at) > this.m.iso()).map(s => ({
      id: s.id, owner_id: s.owner_id, created_at: s.created_at, caption: s.caption ?? null, media_path: s.media_path, media_type: s.media_type,
      likes: this.m.table('sx_highlight_likes').filter(l => l.story_id === s.id).length + 12, shares: 3, views: 240,
      liked: this.m.table('sx_highlight_likes').some(l => l.story_id === s.id && l.user_id === ME) })),
    sx_friend_avatar_outfits: () => [],
    // Mirrors public.sx_ensure_profile() (migration 20261019120000): create the own row from the sign-up metadata.
    sx_ensure_profile: () => {
      let p = this.m.profile(ME);
      if (!p) {
        const hex = ME.replace(/-/g, '').slice(0, 8), wanted = String(this.meta.username ?? '').toLowerCase();
        const username = /^[a-z0-9_]{3,24}$/.test(wanted) && !this.m.table('profiles').some(x => x.username === wanted) ? wanted : `user_${hex}`;
        p = { id: ME, username, display_name: String(this.meta.display_name ?? username), created_at: this.m.iso(), is_verified: false, gender: this.meta.gender === 'female' ? 'female' : 'male', avatar_path: null, activity_score: 0 };
        this.m.table('profiles').push(p);
      }
      return [{ id: p.id, username: p.username, display_name: p.display_name }];
    },
  };
  async rpc(name: string, args: Row = {}): Promise<Res> {
    await new Promise(r => setTimeout(r, 30));
    const fn = name === 'sx_ensure_profile' && this.faults.noEnsure ? undefined : this.appRpcs[name] ?? this.m.rpcs[name];
    if (!fn) return { data: null, error: { message: `Could not find the function public.${name}`, code: 'PGRST202' } };
    try { return { data: JSON.parse(JSON.stringify(fn(args) ?? null)), error: null }; }
    catch (e) { return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }; }
  }
  channel(_name: string) {
    const mine: Listener[] = [];
    const ch = {
      on: (type: string, f: { event?: string; table?: string; filter?: string }, cb: (p: unknown) => void) => { if (type === 'postgres_changes' && f.table) mine.push({ table: f.table, event: f.event ?? '*', filter: f.filter, cb }); return ch; },
      subscribe: (cb?: (s: string) => void) => { mine.forEach(l => this.listeners.add(l)); setTimeout(() => cb?.('SUBSCRIBED'), 0); return ch; },
      unsubscribe: async () => { mine.forEach(l => this.listeners.delete(l)); return 'ok'; },
      send: async () => 'ok', track: async () => 'ok', untrack: async () => 'ok', presenceState: () => ({}),
    };
    return ch;
  }
  async removeChannel(ch: { unsubscribe: () => Promise<string> }) { await ch?.unsubscribe?.(); return 'ok'; }
  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, body: unknown, o?: { contentType?: string }) => {
        try { this.uploads[path] = URL.createObjectURL(body instanceof Blob ? body : new Blob([body as ArrayBuffer], { type: o?.contentType })); } catch {}
        return { data: { path }, error: null };
      },
      createSignedUrl: async (path: string) => ({ data: { signedUrl: this.uploads[path] ?? artUrl(path) }, error: null }),
      remove: async (paths: string[]) => ({ data: paths.map(name => ({ name })), error: null }),
    }),
  };
  functions = { invoke: async (_name: string, _o?: unknown) => ({ data: { ok: true }, error: null }) };
  auth = {
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      this.authCbs.add(cb); setTimeout(() => cb('INITIAL_SESSION', this.session), 0);
      return { data: { subscription: { unsubscribe: () => { this.authCbs.delete(cb); } } } };
    },
    getSession: async () => ({ data: { session: this.session }, error: null }),
    getUser: async () => ({ data: { user: (this.session?.user as Row) ?? null }, error: null }),
    signInWithPassword: async (_c: { email: string; password: string }) => {
      // Logging in = Kevin (male start look) again.
      Object.assign(this.meta, { display_name: 'Kevin', gender: 'male' }); delete this.meta.demo_account; delete this.meta.username; Object.assign(this.m.profile(ME) ?? {}, { gender: 'male', username: 'kv.savage', display_name: 'Kevin' }); const s = this.makeSession(); this.setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null }; },
    signUp: async (c: { options?: { data?: Row } }) => {
      // Demo registration: you become the demo user with the chosen name + character set (Man/Vrouw).
      const d = c?.options?.data ?? {}; Object.assign(this.meta, d);
      // Own wardrobe per demo registration (all demo accounts share the mock user id; see stores/wardrobe wardrobeKeyFor).
      this.meta.demo_account = String(d.username ?? d.display_name ?? newId()).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || newId();
      const p = this.m.profile(ME); if (p) Object.assign(p, { gender: d.gender === 'female' ? 'female' : 'male', ...(d.display_name ? { display_name: d.display_name } : {}), ...(d.username ? { username: d.username } : {}) });
      const s = this.makeSession(); this.setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null }; },
    signOut: async () => { this.setSession(null, 'SIGNED_OUT'); return { error: null }; },
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async (u: { data?: Row }) => { if (u?.data) Object.assign(this.meta, u.data); const s = this.makeSession(); this.session = s; return { data: { user: s.user }, error: null }; },
    exchangeCodeForSession: async () => ({ data: { session: this.session }, error: null }),
    setSession: async () => ({ data: { session: this.session }, error: null }),
    startAutoRefresh: () => {}, stopAutoRefresh: () => {},
  };
}
