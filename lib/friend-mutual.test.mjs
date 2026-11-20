import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as F from './friend-emojis.ts';
import { streakLabel } from './chat-features.ts';
import { streakChip } from './friend-profile.ts';

test('withMutual: 😁 upgrade, 😬 / 😏 fill, strong kinds untouched', () => {
  const base = new Map([['a', 'best_friend'], ['b', 'bff'], ['c', 'new_friend'], ['d', 'best_friend']]);
  const out = F.withMutual(base, [
    { friend_id: 'a', their_rank: 3, same_number_one: false },
    { friend_id: 'b', their_rank: 1, same_number_one: false },
    { friend_id: 'c', their_rank: null, same_number_one: true },
    { friend_id: 'd', their_rank: 9, same_number_one: false },
    { friend_id: 'e', their_rank: 5, same_number_one: false },
    { friend_id: 'f', their_rank: null, same_number_one: false },
    null,
  ]);
  assert.deepEqual(Object.fromEntries(out), { a: 'mutual_best', b: 'bff', c: 'same_bff', d: 'best_friend', e: 'their_best' });
  assert.deepEqual(Object.fromEntries(F.withMutual(base, null)), Object.fromEntries(base));
});
test('emoji table + info for new kinds', () => {
  assert.equal(F.emojiFor('mutual_best'), '😁'); assert.equal(F.emojiFor('same_bff'), '😬'); assert.equal(F.emojiFor('their_best'), '😏'); assert.equal(F.emojiFor('streak_100'), '💯');
  for (const k of Object.keys(F.DEFAULT_FRIEND_EMOJIS)) assert.ok(F.infoFor(k), k);
  assert.equal(F.relationLabel('their_best'), '😏 Jij bent hun beste vriend');
});
test('💯 only on exactly day 100', () => {
  const s = n => ({ count: n, atRisk: false, hoursLeft: null, todayMe: true, todayThem: true });
  assert.equal(streakLabel(s(100)), '100🔥💯'); assert.equal(streakLabel(s(101)), '101🔥'); assert.equal(streakLabel({ ...s(100), atRisk: true }), '100🔥💯⌛');
  assert.equal(streakChip(s(100)), '🔥 100 dagen reeks 💯'); assert.equal(F.isStreak100(100), true); assert.equal(F.isStreak100(99), false);
});
test('migration: only my rank + a boolean, friends only, no anon', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261120070000_friend_ranks.sql', import.meta.url), 'utf8');
  assert.match(sql, /returns table\(friend_id uuid, their_rank integer, same_number_one boolean\)/);
  assert.match(sql, /r\.b = uid and r\.rn <= 8/);
  assert.match(sql, /e\.a_sent and e\.b_sent and e\.score >= 4/);
  assert.match(sql, /interval '7 days'/);
  assert.ok(sql.includes('revoke all on function public.sx_friend_ranks() from public, anon;'));
  assert.ok(sql.includes('grant execute on function public.sx_friend_ranks() to authenticated;'));
  assert.match(sql, /sx_blocks/);
});
