import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as C from './friend-charms.ts';

const D = 86400000, NOW = Date.parse('2026-10-27T20:00:00Z'), ME = 'me', FR = 'fr';
const at = (ms) => new Date(ms).toISOString();
const ids = (list) => list.map(c => c.id);

test('anniversary: years by local calendar date, soon window, today, leap day', () => {
  assert.deepEqual(C.friendshipYears('2025-10-27T08:00:00Z', NOW, 60), { years: 1, daysToNext: 0 });
  assert.deepEqual(C.friendshipYears('2024-10-30T08:00:00Z', NOW, 60), { years: 1, daysToNext: 3 });
  assert.deepEqual(C.friendshipYears('2026-10-01T08:00:00Z', NOW, 60), { years: 0, daysToNext: 339 });
  assert.equal(C.friendshipYears(null, NOW), null);
  assert.equal(C.friendshipYears(at(NOW + D), NOW), null);
  // 23:30 UTC on 26 Oct is already 27 Oct in Amsterdam (UTC+1).
  assert.equal(C.friendshipYears('2025-10-26T23:30:00Z', NOW, 60).daysToNext, 0);
  assert.equal(C.friendshipYears('2025-10-26T23:30:00Z', NOW, 0).daysToNext, 364);
  // 29 February friends celebrate on 28 February in a non-leap year.
  assert.deepEqual(C.friendshipYears('2024-02-29T12:00:00Z', Date.parse('2027-02-28T12:00:00Z')), { years: 3, daysToNext: 0 });
  assert.equal(C.anniversaryCharm('2025-10-27T08:00:00Z', NOW, 60).subtitle, 'Vandaag 1 jaar vrienden 🎉');
  assert.equal(C.anniversaryCharm('2025-10-30T08:00:00Z', NOW, 60).subtitle, 'Over 3 dagen 1 jaar vrienden');
  assert.equal(C.anniversaryCharm('2023-10-28T08:00:00Z', NOW, 60).subtitle, 'Over 1 dag 3 jaar vrienden');
  assert.equal(C.anniversaryCharm('2024-03-01T08:00:00Z', NOW, 60).subtitle, '2 jaar vrienden');
  assert.equal(C.anniversaryCharm('2026-10-01T08:00:00Z', NOW, 60), null, 'under a year and not soon');
  assert.equal(C.anniversaryCharm(at(NOW - 60e3), NOW, 60), null, 'friends since today is no anniversary');
});

test('Kletskousen: ≥15 in 7 days, both ≥5, system lines and old rows ignored', () => {
  const rows = (n, sender, ago = D) => Array.from({ length: n }, () => ({ sender_id: sender, kind: 'text', created_at: at(NOW - ago) }));
  assert.equal(C.isChatty([...rows(10, ME), ...rows(5, FR)], ME, FR, NOW), true);
  assert.equal(C.isChatty([...rows(10, ME), ...rows(4, FR)], ME, FR, NOW), false, 'total 14');
  assert.equal(C.isChatty([...rows(12, ME), ...rows(4, FR)], ME, FR, NOW), false, 'one-sided');
  assert.equal(C.isChatty([...rows(10, ME), ...rows(5, FR, 8 * D)], ME, FR, NOW), false, 'too old');
  assert.equal(C.isChatty([...rows(10, ME), ...rows(5, 'x')], ME, FR, NOW), false, 'other sender');
  assert.equal(C.isChatty([...rows(10, ME), ...rows(4, FR), { sender_id: FR, kind: 'system', created_at: at(NOW - D) }], ME, FR, NOW), false, 'system');
});

test('Nachtbrakers: both sent between 00:00 and 04:59 local in the last 30 days', () => {
  const night = Date.parse('2026-10-25T00:30:00Z'); // 01:30 in Amsterdam (UTC+1)
  const m = (sender, t) => ({ sender_id: sender, kind: 'text', created_at: at(t) });
  assert.equal(C.isNightOwls([m(ME, night), m(FR, night + 60e3)], ME, FR, NOW, 60), true);
  assert.equal(C.isNightOwls([m(ME, night), m(ME, night + 60e3)], ME, FR, NOW, 60), false, 'only me');
  assert.equal(C.isNightOwls([m(ME, night), m(FR, Date.parse('2026-10-25T04:00:00Z'))], ME, FR, NOW, 60), false, '05:00 is morning');
  assert.equal(C.isNightOwls([m(ME, night - 31 * D), m(FR, night - 31 * D)], ME, FR, NOW, 60), false, 'too old');
  // 23:30 UTC = 00:30 Amsterdam but not night in UTC.
  const late = Date.parse('2026-10-24T23:30:00Z');
  assert.equal(C.isNightOwls([m(ME, late), m(FR, late)], ME, FR, NOW, 60), true);
  assert.equal(C.isNightOwls([m(ME, late), m(FR, late)], ME, FR, NOW, 0), false);
});

test('friendCharms: order, relation, streak tiers, groups and saved; nothing for an empty friendship', () => {
  assert.deepEqual(C.friendCharms({ me: ME, friend: FR, now: NOW }), []);
  const many = [...Array(8)].flatMap((_, i) => [{ sender_id: ME, kind: 'snap', created_at: at(NOW - i * 3600e3) }, { sender_id: FR, kind: 'text', created_at: at(NOW - i * 3600e3 - 60e3) }]);
  const night = Date.parse('2026-10-25T00:30:00Z');
  const all = C.friendCharms({ me: ME, friend: FR, now: NOW, offsetMin: 60, friendsSince: '2025-10-30T08:00:00Z', relation: 'bffs', streak: 12,
    messages: [...many, { sender_id: ME, created_at: at(night) }, { sender_id: FR, created_at: at(night) }], sharedGroups: 2, savedCount: 1 });
  assert.deepEqual(ids(all), ['relation', 'streak', 'anniversary', 'chatty', 'night_owls', 'groups', 'savers']);
  assert.equal(all[0].emoji, '❤️'); assert.equal(all[0].title, "BFF's");
  assert.equal(all[1].subtitle, '12 dagen op rij'); assert.equal(all[1].emoji, '🔥');
  assert.equal(all[5].subtitle, 'Samen in 2 groepen'); assert.equal(all[6].subtitle, '1 chat opgeslagen');
  for (const c of all) { assert.ok(c.title && c.subtitle && c.description && c.colors.length === 2, c.id); }
  const legend = C.friendCharms({ me: ME, friend: FR, now: NOW, streak: 150, relation: 'new_friend', sharedGroups: 1, savedCount: 3 });
  assert.equal(legend[0].emoji, '👶'); assert.equal(legend[0].subtitle, 'Net bevriend');
  assert.equal(legend[1].emoji, '💯'); assert.equal(legend[1].title, 'Streak-legendes');
  assert.equal(legend[2].subtitle, 'Samen in 1 groep'); assert.equal(legend[3].subtitle, '3 chats opgeslagen');
  assert.equal(C.friendCharms({ me: ME, friend: FR, now: NOW, streak: 1 })[0].subtitle, '1 dag op rij');
  assert.equal(C.charmsTitle(0), null); assert.equal(C.charmsTitle(4), 'Charms · 4');
});

test('demo seed: Aria has the anniversary, Kletskousen and Nachtbrakers charms', async () => {
  const { DemoClient } = await import('./demo-client.ts');
  const { MOCK_IDS } = await import('./staff-mock.ts');
  const c = new DemoClient(), me = MOCK_IDS.owner, aria = MOCK_IDS.aria, now = Date.now(), off = -new Date().getTimezoneOffset();
  const f = c.m.table('sx_friends').find(x => x.user_id === me && x.friend_id === aria);
  const direct = 'c0000000-0000-4000-8000-0000000000a1';
  const msgs = c.m.table('sx_messages').filter(x => x.thread_id === direct);
  const got = ids(C.friendCharms({ me, friend: aria, now, offsetMin: off, friendsSince: f.created_at, messages: msgs }));
  assert.deepEqual(got, ['anniversary', 'chatty', 'night_owls']);
  assert.match(C.anniversaryCharm(f.created_at, now, off).subtitle, /^Over [234] dagen 1 jaar vrienden$/);
});

test('friend profile screen renders the charms row and detail sheet', () => {
  const screen = readFileSync(new URL('../app/friend/[id].tsx', import.meta.url), 'utf8');
  for (const t of ['friendCharms(', 'testID="charms"', 'testID="charm-sheet"', "gte('created_at'"]) assert.ok(screen.includes(t), t);
});
