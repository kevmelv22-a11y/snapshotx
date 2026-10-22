import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as F from './friend-profile.ts';

const NOW = Date.parse('2026-10-22T09:00:00Z');
test('friends-since label in Dutch (local date), today, unknown', () => {
  assert.equal(F.friendsSinceLabel('2026-09-22T09:00:00Z', NOW, 120), 'Vrienden sinds 22 september 2026');
  assert.equal(F.friendsSinceLabel('2026-10-22T06:00:00Z', NOW, 120), 'Sinds vandaag vrienden');
  // 23:30 UTC on Oct 21 is already Oct 22 in Amsterdam
  assert.equal(F.friendsSinceLabel('2026-10-21T23:30:00Z', NOW, 120), 'Sinds vandaag vrienden');
  assert.equal(F.friendsSinceLabel('2025-12-31T23:30:00Z', NOW, 120), 'Vrienden sinds 1 januari 2026');
  assert.equal(F.friendsSinceLabel(null, NOW), null);
  assert.equal(F.friendsSinceLabel('kapot', NOW), null);
});
test('snapscore formatting and streak chip', () => {
  assert.equal(F.formatScore(84732), '84.732');
  assert.equal(F.formatScore(1234567), '1.234.567');
  assert.equal(F.formatScore(999), '999');
  assert.equal(F.formatScore(null), '0');
  assert.equal(F.streakChip({ count: 12, atRisk: false }), '🔥 12 dagen reeks');
  assert.equal(F.streakChip({ count: 1, atRisk: true }), '🔥 1 dag reeks ⌛');
  assert.equal(F.streakChip({ count: 0, atRisk: false }), null);
  assert.equal(F.streakChip(null), null);
});
test('sharedChats: 1:1 thread vs shared groups (named, flagged, 3+), others ignored', () => {
  const m = (t, ...u) => u.map(user_id => ({ thread_id: t, user_id }));
  const members = [...m('d', 'me', 'aria'), ...m('g1', 'me', 'aria', 'eva'), ...m('g2', 'me', 'aria'), ...m('g3', 'me', 'eva'), ...m('x', 'me', 'aria', 'cleo', 'noor')];
  const threads = [{ id: 'd', title: null }, { id: 'g1', title: 'Weekend crew' }, { id: 'g2', title: null, is_group: true }, { id: 'g3', title: 'Zonder Aria' }, { id: 'x', title: '  ' }];
  const names = { aria: 'Aria de Vries', eva: 'Eva Smit', cleo: 'Cleo Jansen', noor: 'Noor El Amrani' };
  const r = F.sharedChats(members, threads, 'me', 'aria', id => names[id] ?? 'Vriend');
  assert.equal(r.directId, 'd');
  assert.deepEqual(r.groups.map(g => [g.id, g.title, g.memberCount]), [['g2', 'Aria', 2], ['x', 'Aria, Cleo, Noor', 4], ['g1', 'Weekend crew', 3]]);
  assert.equal(F.sharedChats(members, threads, 'me', 'nobody', () => '').directId, null);
  assert.equal(F.groupLine({ title: 'Weekend crew', memberCount: 5 }), 'Weekend crew · 5 leden');
  assert.equal(F.sharedGroupsTitle(1), '1 gedeelde groep');
  assert.equal(F.sharedGroupsTitle(3), '3 gedeelde groepen');
  assert.equal(F.sharedGroupsTitle(0), null);
});
test('demo seed: Aria is a friend since a known date and shares Weekend crew + a 1:1 chat with Kevin', async () => {
  const { DemoClient } = await import('./demo-client.ts');
  const { MOCK_IDS } = await import('./staff-mock.ts');
  const c = new DemoClient(), me = MOCK_IDS.owner, aria = MOCK_IDS.aria;
  const f = c.m.table('sx_friends').find(x => x.user_id === me && x.friend_id === aria);
  assert.ok(F.friendsSinceLabel(f.created_at, Date.now())?.startsWith('Vrienden sinds'));
  const mine = new Set(c.m.table('sx_members').filter(x => x.user_id === me).map(x => x.thread_id));
  const r = F.sharedChats(c.m.table('sx_members').filter(x => mine.has(x.thread_id)), c.m.table('sx_threads'), me, aria, () => 'X');
  assert.ok(r.directId);
  assert.ok(r.groups.some(g => g.title === 'Weekend crew'));
});
test('screens wire the profile: chat header (1:1) and friends list open /friend/[id]; story reply uses the 1:1 thread', () => {
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(chat, /pathname:'\/friend\/\[id\]'/);
  const friends = readFileSync(new URL('../app/(tabs)/friends.tsx', import.meta.url), 'utf8');
  assert.match(friends, /pathname:'\/friend\/\[id\]'/);
  const screen = readFileSync(new URL('../app/friend/[id].tsx', import.meta.url), 'utf8');
  for (const t of ['Chat', 'Bellen', 'Verhaal', 'Blokkeren']) assert.ok(screen.includes(t), t);
  const story = readFileSync(new URL('../app/stories/[owner].tsx', import.meta.url), 'utf8');
  assert.match(story, /sx_open_thread/);
});
