import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAKE, birthdayBannerText, birthdayFriendIds, isMonthDayToday, monthDayOf, parseMonthDay } from './friend-birthdays.ts';

// Local noon, so the device calendar date is unambiguous in any TZ.
const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

test('parseMonthDay accepts real dates only', () => {
  assert.deepEqual(parseMonthDay('11-14'), { month: 11, day: 14 });
  assert.deepEqual(parseMonthDay('02-29'), { month: 2, day: 29 });
  for (const bad of ['02-30', '13-01', '00-10', '04-31', '1-4', '2004-11-14', '', null, 1114]) assert.equal(parseMonthDay(bad), null, String(bad));
});

test('isMonthDayToday uses the local calendar day', () => {
  assert.equal(isMonthDayToday('10-31', at(2026, 10, 31)), true);
  assert.equal(isMonthDayToday('10-30', at(2026, 10, 31)), false);
  assert.equal(isMonthDayToday('11-01', at(2026, 10, 31)), false);
  assert.equal(isMonthDayToday('10-31', new Date(2026, 9, 31, 0, 5)), true); // just after local midnight
  assert.equal(isMonthDayToday('10-31', new Date(2026, 9, 31, 23, 55)), true);
});

test('29 February is celebrated on 28 February in non-leap years', () => {
  assert.equal(isMonthDayToday('02-29', at(2027, 2, 28)), true);
  assert.equal(isMonthDayToday('02-29', at(2028, 2, 28)), false);
  assert.equal(isMonthDayToday('02-29', at(2028, 2, 29)), true);
  assert.equal(isMonthDayToday('02-29', at(2100, 2, 28)), true); // 2100 is no leap year
});

test('birthdayFriendIds: only birthday today with Verjaardagsfeest on (missing = on)', () => {
  const now = at(2026, 10, 31);
  const ids = birthdayFriendIds([
    { user_id: 'aria', birthday_md: '10-31', birthday_party: true },
    { user_id: 'cleo', birthday_md: '10-31', birthday_party: false },
    { user_id: 'eva', birthday_md: '03-21', birthday_party: true },
    { user_id: 'noor', birthday_md: '10-31' },
    { user_id: '', birthday_md: '10-31' }, { birthday_md: '10-31' }, { user_id: 'x', birthday_md: 'garbage' }, null,
  ], now);
  assert.deepEqual([...ids].sort(), ['aria', 'noor']);
  assert.equal(birthdayFriendIds(null, now).size, 0);
  assert.equal(birthdayFriendIds(undefined, now).size, 0);
});

test('banner text uses the first name; monthDayOf strips the year', () => {
  assert.equal(birthdayBannerText('Aria de Vries'), `Aria is vandaag jarig! ${CAKE}`);
  assert.equal(birthdayBannerText('  '), `Je vriend is vandaag jarig! ${CAKE}`);
  assert.equal(monthDayOf('2004-11-14'), '11-14');
  assert.equal(monthDayOf('2004-02-30'), null);
  assert.equal(monthDayOf(undefined), null);
});

test('migration: friends only, month-day only, blocks + party switch respected, not for anon', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261031060000_friend_birthdays.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /join public\.sx_friends f on f\.user_id = auth\.uid\(\) and f\.friend_id = u\.id/);
  assert.match(sql, /substring\(u\.raw_user_meta_data->>'birthdate' from 6 for 5\)/);
  assert.match(sql, /sx_blocks/);
  assert.match(sql, /birthday_party', 'true'\) <> 'false'/);
  assert.match(sql, /revoke all on function public\.sx_friend_birthdays\(uuid\[\]\) from public, anon/);
  assert.match(sql, /security definer set search_path = ''/);
});

test('screens show 🎂 for friends: friends tab, chat list and Vriendschapsprofiel use the hook', () => {
  for (const f of ['app/(tabs)/friends.tsx', 'app/(tabs)/chats.tsx', 'app/friend/[id].tsx']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /useFriendBirthdays\(/, f);
  }
  const demo = readFileSync(new URL('./demo-client.ts', import.meta.url), 'utf8');
  assert.match(demo, /sx_friend_birthdays:/);
});
