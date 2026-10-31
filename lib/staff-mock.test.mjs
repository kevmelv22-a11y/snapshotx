import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaffMock, seedStaffMock, MOCK_IDS as I } from './staff-mock.ts';
import { reportCategory } from './staff-reports.ts';

const mk = (as = 'owner') => new StaffMock(seedStaffMock, I[as], () => Date.parse('2026-10-13T12:00:00Z'));
const R = 'Reden voor de test';

test('non-staff is denied; search works', async () => {
  const m = mk(); m.actorId = I.aria;
  assert.equal((await m.rpc('sx_staff_search_users', { p_query: '' })).error.code, '42501');
  m.actorId = I.mod;
  const r = await m.rpc('sx_staff_search_users', { p_query: 'bram' });
  assert.equal(r.data.length, 1); assert.equal(r.data[0].id, I.bram);
});
test('warn + temp/permanent ban + unban, each audited', async () => {
  const m = mk('mod');
  assert.ok((await m.rpc('sx_staff_warn_user', { p_user_id: I.bram, p_reason: R })).data);
  assert.match((await m.rpc('sx_staff_warn_user', { p_user_id: I.bram, p_reason: 'kort' })).error.message, /8 characters/);
  const t = await m.rpc('sx_staff_create_ban', { p_type: 'user', p_user_id: I.bram, p_ip: null, p_device_id: null, p_duration_minutes: 1440, p_reason: R });
  assert.equal(t.error, null);
  assert.match((await m.rpc('sx_staff_create_ban', { p_type: 'user', p_user_id: I.bram, p_ip: null, p_device_id: null, p_duration_minutes: null, p_reason: R })).error.message, /already/);
  assert.equal((await m.rpc('sx_staff_revoke_ban', { p_ban_id: t.data, p_reason: R })).error, null);
  assert.equal((await m.rpc('sx_staff_create_ban', { p_type: 'user', p_user_id: I.cleo, p_ip: null, p_device_id: null, p_duration_minutes: null, p_reason: R })).data != null, true);
  assert.deepEqual(m.t.audit_logs.map(a => a.action).reverse(), ['sx_staff_warning_create', 'sx_staff_ban_create', 'sx_staff_ban_revoke', 'sx_staff_ban_create']);
});
test('IP/device bans keep UUID + 180-day login-history checks; staff only bannable by owner', async () => {
  const m = mk('admin');
  const b = (o) => m.rpc('sx_staff_create_ban', { p_type: 'device', p_user_id: null, p_ip: null, p_device_id: null, p_duration_minutes: 60, p_reason: R, ...o });
  assert.equal((await b({ p_device_id: 'not-a-uuid' })).error.code, '22P02');
  assert.match((await b({ p_device_id: '5d000000-0000-4000-8000-0000000000ff' })).error.message, /login history/);
  assert.equal((await b({ p_device_id: I.deviceBram })).error, null);
  assert.match((await m.rpc('sx_staff_create_ban', { p_type: 'ip', p_user_id: null, p_ip: '10.9.9.9', p_device_id: null, p_duration_minutes: 60, p_reason: R })).error.message, /login history/);
  assert.equal((await m.rpc('sx_staff_create_ban', { p_type: 'ip', p_user_id: null, p_ip: '203.0.113.24', p_device_id: null, p_duration_minutes: 60, p_reason: R })).error, null);
  assert.match((await m.rpc('sx_staff_create_ban', { p_type: 'user', p_user_id: I.mod, p_ip: null, p_device_id: null, p_duration_minutes: 60, p_reason: R })).error.message, /owner/);
});
test('reports: categories, resolve/dismiss, action from report links audit', async () => {
  const m = mk('mod');
  assert.deepEqual(m.t.sx_reports.map(reportCategory), ['chat', 'snap', 'story', 'highlight', 'chat', 'account']);
  const [chat, snap, story, hl, junk, account] = m.t.sx_reports.map(r => r.id);
  assert.equal((await m.rpc('sx_review_report', { p_report_id: junk, p_status: 'dismissed' })).error, null);
  assert.match((await m.rpc('sx_review_report', { p_report_id: junk, p_status: 'resolved' })).error.message, /closed/);
  assert.equal((await m.rpc('sx_staff_report_action', { p_report_id: hl, p_action: 'delete_content', p_reason: R, p_duration_minutes: null })).error, null);
  assert.ok(m.t.sx_stories.find(s => s.visibility === 'everyone').removed_at);
  assert.equal((await m.rpc('sx_staff_report_action', { p_report_id: snap, p_action: 'delete_content', p_reason: R, p_duration_minutes: null })).error, null);
  assert.equal((await m.rpc('sx_staff_report_action', { p_report_id: chat, p_action: 'ban_user', p_reason: R, p_duration_minutes: 10080 })).error, null);
  assert.equal(m.t.audit_logs.find(a => a.action === 'sx_staff_ban_create').metadata.report_id, chat);
  assert.equal(m.t.sx_reports.find(r => r.id === chat).status, 'resolved');
  // Account report (Account melden): warn works on the reported user, there is no content to delete.
  assert.equal((await m.rpc('sx_staff_report_action', { p_report_id: account, p_action: 'warn', p_reason: R, p_duration_minutes: null })).error, null);
  assert.equal(m.t.sx_reports.find(r => r.id === account).status, 'resolved');
  void story;
});
test('X+ grant/revoke: admin/owner only, never touches store purchases', async () => {
  const mod = mk('mod');
  assert.equal((await mod.rpc('sx_staff_set_plus', { p_user_id: I.aria, p_grant: true, p_days: 30, p_reason: R })).error.code, '42501');
  const m = mk('admin');
  assert.equal((await m.rpc('sx_staff_set_plus', { p_user_id: I.aria, p_grant: true, p_days: 30, p_reason: R })).error, null);
  assert.equal((await m.rpc('sx_staff_user_moderation', { p_user_id: I.aria })).data.plus, true);
  assert.equal((await m.rpc('sx_staff_set_plus', { p_user_id: I.aria, p_grant: false, p_days: null, p_reason: R })).error, null);
  assert.equal((await m.rpc('sx_staff_user_moderation', { p_user_id: I.aria })).data.plus, false);
  assert.match((await m.rpc('sx_staff_set_plus', { p_user_id: I.eva, p_grant: false, p_days: null, p_reason: R })).error.message, /no staff/);
});
test('roles: admin grants MODERATOR only; owner can grant ADMIN; last owner protected', async () => {
  const a = mk('admin');
  assert.equal((await a.rpc('sx_manage_staff_role', { p_user_id: I.aria, p_role: 'MODERATOR', p_grant: true })).error, null);
  assert.equal((await a.rpc('sx_manage_staff_role', { p_user_id: I.aria, p_role: 'ADMIN', p_grant: true })).error.code, '42501');
  const o = mk('owner');
  assert.equal((await o.rpc('sx_manage_staff_role', { p_user_id: I.aria, p_role: 'ADMIN', p_grant: true })).error, null);
  assert.ok(o.rolesOf(I.aria).includes('ADMIN'));
  assert.match((await o.rpc('sx_manage_staff_role', { p_user_id: I.owner, p_role: 'OWNER', p_grant: false })).error.message, /last owner/);
  assert.equal((await mk('mod').rpc('sx_staff_list_members')).error.code, '42501');
});
test('sx_staff_set_tier: grant any tier, idempotent re-grant, replace, revoke, all audited; admin/owner only', async () => {
  const m = mk('mod');
  assert.equal((await m.rpc('sx_staff_set_tier', { p_user_id: I.bram, p_tier: 'platinum', p_grant: true, p_days: null, p_reason: R })).error.code, '42501');
  m.actorId = I.owner;
  assert.match((await m.rpc('sx_staff_set_tier', { p_user_id: I.bram, p_tier: 'gold', p_grant: true, p_days: null, p_reason: R })).error.message, /invalid tier/);
  const g = await m.rpc('sx_staff_set_tier', { p_user_id: I.bram, p_tier: 'platinum', p_grant: true, p_days: null, p_reason: R });
  assert.equal(g.error, null);
  const again = await m.rpc('sx_staff_set_tier', { p_user_id: I.bram, p_tier: 'platinum', p_grant: true, p_days: null, p_reason: R });
  assert.equal(again.data, g.data);
  assert.equal((await m.rpc('sx_staff_user_moderation', { p_user_id: I.bram })).data.tier, 'platinum');
  await m.rpc('sx_staff_set_tier', { p_user_id: I.bram, p_tier: 'lens', p_grant: true, p_days: 30, p_reason: R });
  assert.equal(m.t.sx_entitlements.filter(e => e.user_id === I.bram && e.source === 'staff' && e.status === 'active').length, 1);
  assert.equal((await m.rpc('sx_staff_set_tier', { p_user_id: I.bram, p_tier: null, p_grant: false, p_days: null, p_reason: R })).error, null);
  assert.deepEqual(m.t.audit_logs.map(a => a.action).filter(a => a.startsWith('sx_staff_tier')).reverse(), ['sx_staff_tier_grant', 'sx_staff_tier_reaffirm', 'sx_staff_tier_grant', 'sx_staff_tier_revoke']);
});
