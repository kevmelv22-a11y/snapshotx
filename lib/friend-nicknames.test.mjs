import test from 'node:test';
import assert from 'node:assert/strict';
import { NICKNAME_TEXT, nicknameError, shownName, validateNickname, withNicknames } from './friend-nicknames.ts';

test('validateNickname: trims, empty/real name = remove, length, word filter', () => {
  assert.deepEqual(validateNickname('  Bea   🌸 '), { ok: true, value: 'Bea 🌸' });
  assert.deepEqual(validateNickname('   '), { ok: true, value: null });
  assert.deepEqual(validateNickname('Noor El Amrani', 'Noor El Amrani'), { ok: true, value: null });
  assert.deepEqual(validateNickname('x'.repeat(33)), { ok: false, error: NICKNAME_TEXT.tooLong });
  assert.equal(validateNickname('x'.repeat(32)).ok, true);
  assert.equal(validateNickname('kankerlijer').ok, false);
  assert.deepEqual(validateNickname('a\nb'), { ok: true, value: 'ab' });
});

test('shownName + withNicknames only touch 1:1 real chats', () => {
  const map = new Map([['b', 'Bea 🌸']]);
  assert.equal(shownName(map, 'b', 'Beatrix'), 'Bea 🌸');
  assert.equal(shownName(map, 'c', 'Cas'), 'Cas');
  assert.equal(shownName(undefined, 'b', 'Beatrix'), 'Beatrix');
  const rows = [{ title: 'Beatrix', isGroup: false, peerIds: ['b'] }, { title: 'Crew', isGroup: true, peerIds: ['b', 'c'] }, { title: 'Demo', isGroup: false, peerIds: ['b'], demo: true }];
  assert.deepEqual(withNicknames(rows, map).map(r => r.title), ['Bea 🌸', 'Crew', 'Demo']);
  assert.equal(withNicknames(rows, new Map()), rows);
});

test('nicknameError maps server errors', () => {
  assert.equal(nicknameError(null), null);
  assert.equal(nicknameError({ code: '42501', message: 'new row violates row-level security policy' }), NICKNAME_TEXT.notFriend);
  assert.match(nicknameError({ code: '22023', message: 'name_not_allowed:offensive' }), /niet toegestaan/);
  assert.equal(nicknameError({ code: '23514', message: 'violates check constraint "sx_friend_nicknames_len"' }), NICKNAME_TEXT.tooLong);
  assert.equal(nicknameError({ code: 'PGRST205' }), NICKNAME_TEXT.unavailable);
  assert.equal(nicknameError({ code: 'XX000', message: 'boom' }), null);
});
