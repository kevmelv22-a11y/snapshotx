import assert from 'node:assert/strict';
import test from 'node:test';
import * as I from './chat-ids.ts';
import { friendlyError } from './db-errors.ts';

const T = '3f2504e0-4f89-11d3-9a0c-0305e82c3301', U = 'a1b2c3d4-0000-4000-8000-000000000001';

test('threadIdFromParam: only real uuids reach the DB', () => {
  assert.equal(I.threadIdFromParam(T), T);
  assert.equal(I.threadIdFromParam([T, 'x']), T);
  for (const bad of [undefined, '', 'undefined', 'demo-1', 'local-ai', '@kevin', '[object Object]', [], null])
    assert.equal(I.threadIdFromParam(bad), null, String(bad));
});

test('uuidList drops demo ids, handles and duplicates', () => {
  assert.deepEqual(I.uuidList([T, 'demo-2', '', '@x', T.toUpperCase(), null, U]), [T, U]);
});

test('systemMessageRow: valid row, body capped at 200, null on bad ids/empty text', () => {
  const r = I.systemMessageRow(T, U, 'x'.repeat(300));
  assert.equal(r.kind, 'system'); assert.equal(r.body.length, 200); assert.equal(r.media_path, null);
  assert.equal(I.systemMessageRow('demo', U, 'hi'), null);
  assert.equal(I.systemMessageRow(T, '', 'hi'), null);
  assert.equal(I.systemMessageRow(T, U, '   '), null);
});

test('regression: screenshot line rejected by old kind check is silent, not "Ongeldige invoer"', () => {
  const err = { code: '23514', message: 'new row for relation "sx_messages" violates check constraint "sx_messages_kind_check"' };
  // This is exactly what the chat screen used to show:
  assert.match(friendlyError(err), /Ongeldige invoer/);
  assert.equal(I.isSilentSystemMessageError(err), true);
  assert.equal(I.isSilentSystemMessageError({ code: '22P02', message: 'invalid input syntax for type uuid: ""' }), true);
  assert.equal(I.isSilentSystemMessageError({ code: '42501', message: 'permission denied' }), false);
  assert.equal(I.isSilentSystemMessageError(null), false);
});
