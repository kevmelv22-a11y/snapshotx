import assert from 'node:assert/strict';
import test from 'node:test';
import { auditTargetLabel, banIdsWithoutTarget, formatStaffTime, isUuid, missingBanUserIds } from './staff-audit.ts';

const profiles = new Map([['11111111-1111-4111-8111-111111111111', { id: '11111111-1111-4111-8111-111111111111', username: 'jan', display_name: 'Jan' }]]);
const ban = (target, extra = {}) => ({ action: 'sx_staff_ban_create', entity_type: 'sx_staff_ban', entity_id: '99999999-9999-4999-8999-999999999999', metadata: { type: 'user', target }, ...extra });

test('ban audit shows the banned user handle instead of the ban id', () => {
  assert.equal(auditTargetLabel(ban({ user_id: '11111111-1111-4111-8111-111111111111' }), profiles), '@jan');
});
test('unknown user falls back to the full user id', () => {
  assert.equal(auditTargetLabel(ban({ user_id: '22222222-2222-4222-8222-222222222222' }), profiles), 'onbekende gebruiker');
  assert.deepEqual(missingBanUserIds([ban({ user_id: '22222222-2222-4222-8222-222222222222' })], profiles), ['22222222-2222-4222-8222-222222222222']);
});
test('IP and device bans show metadata.target', () => {
  assert.equal(auditTargetLabel(ban({ ip: '203.0.113.7' }, { action: 'sx_staff_ban_revoke' }), profiles), 'IP 203.0.113.7');
  assert.equal(auditTargetLabel(ban({ device_id: '33333333-3333-4333-8333-333333333333' }), profiles), 'apparaat 33333333-3333-4333-8333-333333333333');
});
test('missing metadata.target falls back to the ban row', () => {
  const e = ban(undefined);
  const bans = new Map([[e.entity_id, { id: e.entity_id, ban_type: 'ip', target_user_id: null, target_ip: '198.51.100.1', target_device_id: null }]]);
  assert.deepEqual(banIdsWithoutTarget([e], new Map()), [e.entity_id]);
  assert.equal(auditTargetLabel(e, profiles, bans), 'IP 198.51.100.1');
  assert.equal(auditTargetLabel(e, profiles), '#99999999');
});
test('non-ban audit rows keep the short entity id', () => {
  assert.equal(auditTargetLabel({ action: 'sx_review_report', entity_type: 'sx_report', entity_id: 'abcdef0123456789', metadata: null }, profiles), '#abcdef01');
});
test('uuid pre-check and readable timestamps', () => {
  assert.equal(isUuid('33333333-3333-4333-8333-333333333333'), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.notEqual(formatStaffTime('2026-10-07T11:24:45.185Z'), '2026-10-07T11:24:45.185Z');
  assert.equal(formatStaffTime('garbage'), 'Tijd onbekend');
  assert.match(formatStaffTime('2026-10-07T11:24:45.185Z'), /2026/);
});

test('staff labels show @username / display name, never the raw id', async () => {
  const { userLabel, auditUserIds, auditTargetLabel: lbl } = await import('./staff-audit.ts');
  const id = '0a000000-0000-4000-8000-000000000001';
  const profiles = new Map([[id, { id, username: 'kevraz0r', display_name: 'Kevin' }]]);
  assert.equal(userLabel(profiles.get(id)), '@kevraz0r');
  assert.equal(userLabel({ username: null, display_name: 'Lisa' }), 'Lisa');
  assert.equal(userLabel(undefined), 'onbekende gebruiker');
  assert.equal(lbl({ action: 'x', entity_type: 'profiles', entity_id: id }, profiles), '@kevraz0r');
  assert.deepEqual(auditUserIds([{ action: 'x', actor_id: '0a000000-0000-4000-8000-000000000002', entity_type: 'profiles', entity_id: id }], profiles), ['0a000000-0000-4000-8000-000000000002']);
});
