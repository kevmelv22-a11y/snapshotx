/**
 * Step 11: in-memory MOCK of the staff backend (tables + RPCs used by app/staff). Mirrors the authorization
 * and validation of the SQL in migrations 20261008090000 / 20261008090100 / 20261013200000 (role checks,
 * UUID device ids, 180-day login-history check for IP/device bans, owner rules, audit row per action).
 * Dev/tests only — never talks to Supabase. Pure TS (no React Native imports).
 */
export type Row = Record<string, unknown> & { id?: string };
type Err = { message: string; code?: string };
type Res<T = unknown> = { data: T | null; error: Err | null };

const STAFF = ['MODERATOR', 'SENIOR MODERATOR', 'ADMIN', 'OWNER'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;
class SqlError extends Error { code?: string; constructor(m: string, code?: string) { super(m); this.code = code; } }
const deny = () => { throw new SqlError('not authorized', '42501'); };

let n = 0;
const uid = (p: number) => `${p.toString(16).padStart(8, '0')}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`;

export class StaffMock {
  t: Record<string, Row[]> = {};
  actorId: string;
  now: () => number;
  constructor(seedFn: (m: StaffMock) => void, actorId: string, now: () => number = Date.now) { this.actorId = actorId; this.now = now; seedFn(this); }
  iso(offsetMs = 0) { return new Date(this.now() + offsetMs).toISOString(); }
  id(p = 0xa0) { return uid(p); }
  table(name: string) { return (this.t[name] ??= []); }

  // ---------------------------------------------------------------- helpers mirrored from SQL
  rolesOf(user: string): string[] {
    const ids = this.table('user_roles').filter(r => r.user_id === user).map(r => r.role_id);
    return this.table('roles').filter(r => ids.includes(r.id)).map(r => String(r.name));
  }
  activeBans() { const t = this.now(); return this.table('sx_staff_bans').filter(b => !b.revoked_at && (!b.ends_at || Date.parse(String(b.ends_at)) > t)); }
  isBanned(user: string) { return this.activeBans().some(b => b.ban_type === 'user' && b.target_user_id === user); }
  requireStaff(roles = STAFF) { const a = this.actorId; if (!a || this.isBanned(a) || !this.rolesOf(a).some(r => roles.includes(r))) deny(); return a; }
  has(role: string) { return this.rolesOf(this.actorId).includes(role); }
  reason(r: unknown, min = 8) { const s = String(r ?? '').trim(); if (s.length < min || s.length > 1000) throw new SqlError(`A reason of at least ${min} characters is required`); return s; }
  audit(action: string, entity_type: string, entity_id: string, metadata: Row) {
    const rep = this.reportCtx; if (rep) metadata = { ...metadata, report_id: rep };
    this.table('audit_logs').unshift({ id: this.id(0xa1), actor_id: this.actorId, action, entity_type, entity_id, created_at: this.iso(), metadata });
  }
  reportCtx: string | null = null;
  profile(id: unknown) { return this.table('profiles').find(p => p.id === id); }

  // ---------------------------------------------------------------- RPCs
  rpcs: Record<string, (a: Row) => unknown> = {
    sx_staff_dashboard_counts: () => {
      this.requireStaff(); const r = this.table('sx_reports'), day = this.now() - 86400e3, b = this.activeBans();
      return { users_total: this.table('profiles').length, users_new_7d: this.table('profiles').filter(p => Date.parse(String(p.created_at)) > this.now() - 7 * 86400e3).length,
        reports_open: r.filter(x => x.status === 'open').length, reports_reviewing: r.filter(x => x.status === 'reviewing').length,
        reports_24h: r.filter(x => Date.parse(String(x.created_at)) > day).length, bans_active: b.length, bans_active_user: b.filter(x => x.ban_type === 'user').length,
        warnings_30d: this.table('sx_staff_warnings').length, chats_total: this.table('sx_threads').length };
    },
    sx_staff_search_users: a => {
      this.requireStaff(); const q = String(a.p_query ?? '').trim().toLowerCase().slice(0, 64);
      const rows = this.table('profiles').filter(p => !q || String(p.username ?? '').toLowerCase().includes(q) || String(p.display_name ?? '').toLowerCase().includes(q) || (/^[0-9a-f-]{4,36}$/.test(q) && String(p.id).startsWith(q)))
        .sort((x, y) => Number(String(y.username).toLowerCase() === q) - Number(String(x.username).toLowerCase() === q) || String(y.created_at).localeCompare(String(x.created_at)));
      const lim = Math.min(Math.max(Number(a.p_limit ?? 25), 1), 50), off = Math.max(Number(a.p_offset ?? 0), 0);
      return rows.slice(off, off + lim).map(p => ({ ...p, is_banned: this.isBanned(String(p.id)), total_count: rows.length }));
    },
    sx_staff_list_members: () => {
      this.requireStaff(['ADMIN', 'OWNER']);
      const ids = [...new Set(this.table('user_roles').map(r => String(r.user_id)))];
      return ids.map(id => { const p = this.profile(id); return { user_id: id, username: p?.username ?? null, display_name: p?.display_name ?? null, roles: this.rolesOf(id).filter(r => STAFF.includes(r)), is_banned: this.isBanned(id) }; }).filter(m => m.roles.length);
    },
    sx_staff_list_chats: () => {
      this.requireStaff();
      return this.table('sx_threads').map(t => { const ms = this.table('sx_messages').filter(m => m.thread_id === t.id); return { thread_id: t.id, title: t.title, created_at: t.created_at, member_count: Number(t.member_count ?? 2), last_message_at: ms.map(m => String(m.created_at)).sort().pop() ?? null }; });
    },
    sx_staff_read_chat: a => {
      this.requireStaff(); const r = this.reason(a.p_reason, 10);
      const t = this.table('sx_threads').find(x => x.id === a.p_thread_id); if (!t) throw new SqlError('thread not found');
      this.audit('sx_staff_chat_read', 'sx_thread', String(t.id), { reason: r });
      return this.table('sx_messages').filter(m => m.thread_id === t.id && !(m.kind === 'snap' && m.expired)).map(m => ({ message_id: m.id, sender_id: m.sender_id, kind: m.kind, body: m.deleted_at ? null : m.body, created_at: m.created_at, is_deleted: !!m.deleted_at }));
    },
    sx_staff_delete_message: a => this.deleteMessage(a.p_message_id, a.p_reason),
    sx_staff_remove_story: a => this.removeStory(a.p_story_id, a.p_reason),
    sx_staff_create_ban: a => this.createBan(a),
    sx_staff_revoke_ban: a => {
      this.requireStaff(); const r = this.reason(a.p_reason);
      const b = this.activeBans().find(x => x.id === a.p_ban_id); if (!b) throw new SqlError('active ban not found');
      Object.assign(b, { revoked_at: this.iso(), revoked_by: this.actorId, revoke_reason: r });
      this.audit('sx_staff_ban_revoke', 'sx_staff_ban', String(b.id), { type: b.ban_type, target: this.banTarget(b), reason: r, ban_reason: b.reason, old_status: 'active', new_status: 'revoked' });
      return null;
    },
    sx_review_report: a => {
      this.requireStaff(); const rep = this.table('sx_reports').find(x => x.id === a.p_report_id);
      if (!rep) throw new SqlError('report not found');
      if (!['reviewing', 'resolved', 'dismissed'].includes(String(a.p_status))) throw new SqlError('invalid status');
      if (!['open', 'reviewing'].includes(String(rep.status))) throw new SqlError('report already closed');
      const old = rep.status; Object.assign(rep, { status: a.p_status, reviewer_id: this.actorId, reviewed_at: this.iso(), review_note: a.p_note ?? rep.review_note ?? null });
      this.audit('sx_review_report', 'sx_report', String(rep.id), { report_id: rep.id, old_status: old, new_status: a.p_status, note: a.p_note ?? null, target: { user_id: rep.reported_user_id } });
      return null;
    },
    sx_staff_report_action: a => {
      const actor = this.requireStaff(); const act = String(a.p_action);
      if (!['warn', 'ban_user', 'delete_content'].includes(act)) throw new SqlError('invalid action');
      const r = this.reason(a.p_reason);
      if (act !== 'ban_user' && a.p_duration_minutes != null) throw new SqlError('duration only applies to bans');
      const rep = this.table('sx_reports').find(x => x.id === a.p_report_id); if (!rep) throw new SqlError('report not found');
      if (!['open', 'reviewing'].includes(String(rep.status))) throw new SqlError('report already closed');
      this.reportCtx = String(rep.id);
      try {
        let ref: unknown;
        if (act === 'delete_content') {
          if (rep.message_id) { this.deleteMessage(rep.message_id, r); ref = rep.message_id; }
          else if (rep.story_id) { this.removeStory(rep.story_id, r); ref = rep.story_id; }
          else throw new SqlError('reported content no longer exists');
        } else {
          if (!rep.reported_user_id) throw new SqlError('reported user unknown');
          ref = act === 'ban_user' ? this.createBan({ p_type: 'user', p_user_id: rep.reported_user_id, p_ip: null, p_device_id: null, p_duration_minutes: a.p_duration_minutes ?? null, p_reason: r }) : this.warn(rep.reported_user_id, r, String(rep.id));
        }
        const old = rep.status;
        Object.assign(rep, { status: 'resolved', reviewer_id: actor, reviewed_at: this.iso(), review_note: r, action_taken: act, action_ref: ref });
        this.audit('sx_staff_report_action', 'sx_report', String(rep.id), { action: act, action_ref: ref, reason: r, duration_minutes: a.p_duration_minutes ?? null, target: { user_id: rep.reported_user_id }, old_status: old, new_status: 'resolved' });
        return { report_id: rep.id, action: act, action_ref: ref };
      } finally { this.reportCtx = null; }
    },
    sx_manage_staff_role: a => {
      const actor = this.requireStaff(['ADMIN', 'OWNER']); const owner = this.has('OWNER'); const role = String(a.p_role), grant = !!a.p_grant, target = String(a.p_user_id);
      const roleRow = this.table('roles').find(r => r.name === role); if (!roleRow || !this.profile(target)) throw new SqlError('target not found');
      if (role === 'OWNER') {
        if (grant || target !== actor || !owner) deny();
        const others = this.table('user_roles').filter(r => r.role_id === roleRow.id && r.user_id !== actor && !this.isBanned(String(r.user_id))).length;
        if (!others) throw new SqlError('cannot remove the last owner', '42501');
      } else if (STAFF.includes(role)) {
        if (target === actor) deny();
        if (!(owner || (role === 'MODERATOR' && this.has('ADMIN')))) deny();
        if (!owner && this.rolesOf(target).includes('OWNER')) deny();
      } else deny();
      const had = this.rolesOf(target).includes(role);
      if (grant && !had) this.table('user_roles').push({ user_id: target, role_id: roleRow.id });
      if (!grant) this.t.user_roles = this.table('user_roles').filter(r => !(r.user_id === target && r.role_id === roleRow.id));
      this.audit(grant ? 'sx_staff_role_grant' : 'sx_staff_role_revoke', 'user_role', target, { role, target: { user_id: target }, old_status: had ? 'has_role' : 'no_role', new_status: grant ? 'has_role' : 'no_role' });
      return null;
    },
    // ---- new in 20261013200000_staff_panel_step11.sql
    sx_staff_warn_user: a => this.warn(a.p_user_id, this.reason(a.p_reason), null),
    sx_staff_set_plus: a => {
      this.requireStaff(['ADMIN', 'OWNER']); const r = this.reason(a.p_reason); const user = String(a.p_user_id);
      if (!this.profile(user)) throw new SqlError('invalid target user');
      const days = a.p_days == null ? null : Number(a.p_days);
      if (days != null && (days < 1 || days > 3650)) throw new SqlError('days must be between 1 and 3650');
      const live = this.table('sx_entitlements').filter(e => e.user_id === user && e.source === 'staff' && e.status === 'active');
      const was = this.plusOf(user);
      if (a.p_grant) {
        if (live.length) throw new SqlError('user already has a staff X+ grant');
        const id = this.id(0xe1);
        this.table('sx_entitlements').push({ id, user_id: user, tier: 'plus', source: 'staff', status: 'active', starts_at: this.iso(), expires_at: days ? this.iso(days * 86400e3) : null, will_renew: false });
        this.audit('sx_staff_plus_grant', 'sx_entitlement', id, { target: { user_id: user }, reason: r, days, old_status: was ? 'plus' : 'free', new_status: 'plus' });
        return id;
      }
      if (!live.length) throw new SqlError('no staff X+ grant to revoke');
      live.forEach(e => { e.status = 'revoked'; });
      this.audit('sx_staff_plus_revoke', 'sx_entitlement', String(live[0].id), { target: { user_id: user }, reason: r, old_status: 'plus', new_status: this.plusOf(user) ? 'plus' : 'free' });
      return null;
    },
    sx_staff_user_moderation: a => {
      this.requireStaff(); const user = String(a.p_user_id);
      return { warnings: this.table('sx_staff_warnings').filter(w => w.user_id === user).length, plus: this.plusOf(user), plus_source: this.table('sx_entitlements').find(e => e.user_id === user && e.status === 'active')?.source ?? null, banned: this.isBanned(user) };
    },
    sx_check_app_access: () => !this.isBanned(this.actorId),
  };

  plusOf(user: string) { const t = this.now(); return this.table('sx_entitlements').some(e => e.user_id === user && (e.status === 'active' || e.status === 'grace') && (!e.expires_at || Date.parse(String(e.expires_at)) > t)); }
  banTarget(b: Row) { return b.ban_type === 'user' ? { user_id: b.target_user_id } : b.ban_type === 'ip' ? { ip: b.target_ip } : { device_id: b.target_device_id }; }
  warn(user: unknown, reason: string, report: string | null) {
    this.requireStaff(); if (!this.profile(user) || user === this.actorId) throw new SqlError('invalid target user');
    const id = this.id(0xb1);
    this.table('sx_staff_warnings').push({ id, user_id: user, reason, issued_by: this.actorId, report_id: report, created_at: this.iso() });
    this.audit('sx_staff_warning_create', 'sx_staff_warning', id, { target: { user_id: user }, reason, old_status: 'no_warning', new_status: 'warned' });
    return id;
  }
  deleteMessage(mid: unknown, reason: unknown) {
    this.requireStaff(); const r = this.reason(reason);
    const m = this.table('sx_messages').find(x => x.id === mid && !x.deleted_at); if (!m) throw new SqlError('message not found');
    Object.assign(m, { deleted_at: this.iso(), body: null });
    this.audit('sx_staff_message_delete', 'sx_message', String(m.id), { reason: r, target: { user_id: m.sender_id }, old_status: 'visible', new_status: 'deleted' });
    return null;
  }
  removeStory(sid: unknown, reason: unknown) {
    this.requireStaff(); const r = this.reason(reason);
    const s = this.table('sx_stories').find(x => x.id === sid && !x.removed_at); if (!s) throw new SqlError('story not found');
    s.removed_at = this.iso();
    this.audit('sx_staff_story_remove', 'sx_story', String(s.id), { reason: r, target: { user_id: s.owner_id }, highlight: s.visibility === 'everyone', old_status: 'visible', new_status: 'removed' });
    return null;
  }
  createBan(a: Row) {
    const actor = this.requireStaff(); const type = String(a.p_type), r = this.reason(a.p_reason);
    const mins = a.p_duration_minutes == null ? null : Number(a.p_duration_minutes);
    if (!['user', 'ip', 'device'].includes(type)) throw new SqlError('invalid ban request');
    if (mins != null && (mins < 1 || mins > 525600)) throw new SqlError('duration must be between 1 minute and 365 days');
    const { p_user_id: u, p_ip: ip, p_device_id: dev } = a;
    if ((type === 'user' && (!u || ip || dev)) || (type === 'ip' && (u || !ip || dev)) || (type === 'device' && (u || ip || !dev))) throw new SqlError('target does not match ban type');
    // Postgres parameter types: uuid / inet casts fail before the function body runs.
    if (u && !UUID_RE.test(String(u))) throw new SqlError(`invalid input syntax for type uuid: "${u}"`, '22P02');
    if (dev && !UUID_RE.test(String(dev))) throw new SqlError(`invalid input syntax for type uuid: "${dev}"`, '22P02');
    if (ip && !IP_RE.test(String(ip))) throw new SqlError(`invalid input syntax for type inet: "${ip}"`, '22P02');
    const recent = this.table('sx_login_history').filter(h => Date.parse(String(h.logged_at)) > this.now() - 180 * 86400e3);
    const act = this.activeBans();
    if (type === 'user') {
      if (u === actor || !this.profile(u)) throw new SqlError('invalid target user');
      if (this.rolesOf(String(u)).some(x => STAFF.includes(x)) && !this.has('OWNER')) throw new SqlError('only owner may ban staff');
      if (act.some(b => b.ban_type === 'user' && b.target_user_id === u)) throw new SqlError('user already has an active ban');
    } else if (type === 'ip') {
      if (!recent.some(h => h.ip_address === ip)) throw new SqlError('IP not found in recent login history');
      if (act.some(b => b.ban_type === 'ip' && b.target_ip === ip)) throw new SqlError('IP already has an active ban');
    } else {
      if (!recent.some(h => h.device_id === dev)) throw new SqlError('device not found in recent login history');
      if (act.some(b => b.ban_type === 'device' && b.target_device_id === dev)) throw new SqlError('device already has an active ban');
    }
    const id = this.id(0xba);
    const row: Row = { id, ban_type: type, target_user_id: u ?? null, target_ip: ip ?? null, target_device_id: dev ?? null, reason: r, issued_by: actor, created_at: this.iso(), ends_at: mins == null ? null : this.iso(mins * 60e3), revoked_at: null };
    this.table('sx_staff_bans').unshift(row);
    this.audit('sx_staff_ban_create', 'sx_staff_ban', id, { type, target: this.banTarget(row), reason: r, duration_minutes: mins, old_status: 'not_banned', new_status: 'active' });
    return id;
  }

  // ---------------------------------------------------------------- client surface (subset of supabase-js)
  async rpc(name: string, args: Row = {}): Promise<Res> {
    const fn = this.rpcs[name];
    if (!fn) return { data: null, error: { message: `Could not find the function public.${name}`, code: 'PGRST202' } };
    try { return { data: structuredClone(fn(args) ?? null) as never, error: null }; }
    catch (e) { return { data: null, error: { message: (e as Error).message, code: (e as SqlError).code } }; }
  }
  from(table: string) { return new Query(this, table); }
  auth = { getUser: async () => ({ data: { user: { id: this.actorId } }, error: null }) };
}

/** Read-only query builder; RLS: staff tables are only readable by staff (mirrors the policies). */
class Query implements PromiseLike<Res<Row[]>> {
  private f: ((r: Row) => boolean)[] = []; private ord: [string, boolean] | null = null; private lim = 1000; private single = false;
  private m: StaffMock; private name: string;
  constructor(m: StaffMock, name: string) { this.m = m; this.name = name; }
  select(_cols?: string) { return this; }
  eq(c: string, v: unknown) { this.f.push(r => r[c] === v); return this; }
  in(c: string, v: unknown[]) { this.f.push(r => v.includes(r[c])); return this; }
  is(c: string, v: null) { this.f.push(r => (r[c] ?? null) === v); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.ord = [c, o?.ascending ?? true]; return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.single = true; return this as unknown as PromiseLike<Res<Row>>; }
  private run(): Res<Row[]> {
    const staffOnly = ['sx_reports', 'sx_staff_bans', 'audit_logs', 'sx_login_history', 'sx_staff_warnings'];
    if (staffOnly.includes(this.name)) { try { this.m.requireStaff(); } catch { return { data: [], error: null }; } }
    if (this.name === 'user_roles') this.f.push(r => r.user_id === this.m.actorId || this.m.rolesOf(this.m.actorId).length > 0);
    let rows = this.m.table(this.name).filter(r => this.f.every(f => f(r)));
    if (this.ord) { const [c, asc] = this.ord; rows = [...rows].sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (asc ? 1 : -1)); }
    return { data: structuredClone(rows.slice(0, this.lim)), error: null };
  }
  then<A, B>(ok?: ((v: Res<Row[]>) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    const r = this.run(); const v = this.single ? { data: r.data?.[0] ?? null, error: r.error } : r;
    return Promise.resolve(v as Res<Row[]>).then(ok, bad);
  }
}

// ---------------------------------------------------------------- seed
export const MOCK_IDS = {
  owner: '0a000000-0000-4000-8000-000000000001', admin: '0a000000-0000-4000-8000-000000000002', mod: '0a000000-0000-4000-8000-000000000003',
  aria: '0b000000-0000-4000-8000-000000000011', bram: '0b000000-0000-4000-8000-000000000012', cleo: '0b000000-0000-4000-8000-000000000013',
  daan: '0b000000-0000-4000-8000-000000000014', eva: '0b000000-0000-4000-8000-000000000015',
  deviceBram: '5d000000-0000-4000-8000-0000000000b1',
};
export function seedStaffMock(m: StaffMock) {
  const I = MOCK_IDS, H = 3600e3, D = 86400e3;
  m.t.roles = ['MODERATOR', 'SENIOR MODERATOR', 'ADMIN', 'OWNER'].map((name, i) => ({ id: `r${i}`, name }));
  m.t.user_roles = [{ user_id: I.owner, role_id: 'r3' }, { user_id: I.admin, role_id: 'r2' }, { user_id: I.mod, role_id: 'r0' }];
  const p = (id: string, username: string, display_name: string, ageD: number, v = false) => ({ id, username, display_name, created_at: m.iso(-ageD * D), is_verified: v });
  m.t.profiles = [p(I.owner, 'kevin', 'Kevin', 400, true), p(I.admin, 'sanne', 'Sanne (admin)', 300), p(I.mod, 'joost', 'Joost (mod)', 200),
    p(I.aria, 'aria', 'Aria de Vries', 30), p(I.bram, 'bram_b', 'Bram Bakker', 12), p(I.cleo, 'cleo', 'Cleo Jansen', 5), p(I.daan, 'daan', 'Daan Visser', 2), p(I.eva, 'eva', 'Eva Smit', 1, true)];
  m.t.sx_login_history = [
    { id: 'l1', user_id: I.bram, logged_at: m.iso(-2 * H), ip_address: '203.0.113.24', device_id: I.deviceBram, device_label: 'iPhone 15', user_agent: null },
    { id: 'l2', user_id: I.bram, logged_at: m.iso(-3 * D), ip_address: '198.51.100.7', device_id: I.deviceBram, device_label: 'iPhone 15', user_agent: null },
    { id: 'l3', user_id: I.cleo, logged_at: m.iso(-1 * H), ip_address: '192.0.2.55', device_id: '5d000000-0000-4000-8000-0000000000c1', device_label: 'Pixel 8', user_agent: null },
  ];
  m.t.sx_threads = [{ id: 'c0000000-0000-4000-8000-000000000001', title: 'Aria & Bram', created_at: m.iso(-5 * D), member_count: 2 }, { id: 'c0000000-0000-4000-8000-000000000002', title: 'Weekend crew', created_at: m.iso(-9 * D), member_count: 5 }];
  const msg = (id: string, t: number, s: string, kind: string, body: string | null, ago: number) => ({ id, thread_id: m.t.sx_threads[t].id, sender_id: s, kind, body, created_at: m.iso(-ago) });
  m.t.sx_messages = [msg('e0000000-0000-4000-8000-000000000001', 0, I.bram, 'text', 'Stuur je adres maar, anders kom ik het zelf zoeken 😡', 3 * H), msg('e0000000-0000-4000-8000-000000000002', 0, I.aria, 'text', 'Doe normaal', 2.9 * H),
    msg('e0000000-0000-4000-8000-000000000003', 1, I.daan, 'snap', null, 5 * H), msg('e0000000-0000-4000-8000-000000000004', 1, I.eva, 'text', 'Zaterdag strand?', 4 * H)];
  m.t.sx_stories = [{ id: 'f0000000-0000-4000-8000-000000000001', owner_id: I.cleo, media_type: 'photo', caption: 'Koop volgers via mijn link 💸', visibility: 'friends', created_at: m.iso(-6 * H) },
    { id: 'f0000000-0000-4000-8000-000000000002', owner_id: I.daan, media_type: 'video', caption: 'Gevaarlijke stunt op het spoor', visibility: 'everyone', created_at: m.iso(-8 * H) }];
  const rep = (id: string, reporter: string, reported: string, reason: string, ago: number, mid: string | null, sid: string | null, snap: Row) =>
    ({ id, reporter_id: reporter, reported_user_id: reported, message_id: mid, story_id: sid, reason, status: 'open', created_at: m.iso(-ago), review_note: null, content_snapshot: { captured_at: m.iso(-ago), ...snap }, action_taken: null, action_ref: null });
  m.t.sx_reports = [
    rep('d0000000-0000-4000-8000-000000000001', I.aria, I.bram, 'Bedreiging', 2 * H, 'e0000000-0000-4000-8000-000000000001', null, { type: 'message', kind: 'text', body: 'Stuur je adres maar, anders kom ik het zelf zoeken 😡', sender_id: I.bram }),
    rep('d0000000-0000-4000-8000-000000000002', I.eva, I.daan, 'Naaktheid of seksuele inhoud', 4 * H, 'e0000000-0000-4000-8000-000000000003', null, { type: 'message', kind: 'snap', has_media: true, view_once: true, sender_id: I.daan }),
    rep('d0000000-0000-4000-8000-000000000003', I.aria, I.cleo, 'Spam of oplichting', 5 * H, null, 'f0000000-0000-4000-8000-000000000001', { type: 'story', caption: 'Koop volgers via mijn link 💸', media_type: 'photo', visibility: 'friends', owner_id: I.cleo }),
    rep('d0000000-0000-4000-8000-000000000004', I.bram, I.daan, 'Gevaarlijke handelingen', 7 * H, null, 'f0000000-0000-4000-8000-000000000002', { type: 'story', caption: 'Gevaarlijke stunt op het spoor', media_type: 'video', visibility: 'everyone', owner_id: I.daan }),
    rep('d0000000-0000-4000-8000-000000000005', I.cleo, I.eva, 'Ik vind dit gewoon niet leuk', 9 * H, 'e0000000-0000-4000-8000-000000000004', null, { type: 'message', kind: 'text', body: 'Zaterdag strand?', sender_id: I.eva }),
  ];
  m.t.sx_entitlements = [{ id: 'en000001', user_id: I.eva, tier: 'plus', source: 'app_store', status: 'active', starts_at: m.iso(-20 * D), expires_at: m.iso(10 * D), will_renew: true }];
  m.t.sx_staff_bans = []; m.t.audit_logs = []; m.t.sx_staff_warnings = [];
}

let current: StaffMock | null = null;
export function activateStaffMock(as: 'owner' | 'admin' | 'mod' = 'owner') { current = new StaffMock(seedStaffMock, MOCK_IDS[as]); return current; }
export function staffMock() { return current; }
export function deactivateStaffMock() { current = null; }
