import assert from 'node:assert/strict';
import test from 'node:test';
import { pendingAfterLogin, peekPendingAdd, peekPendingGroupInvite, setPendingAdd, setPendingGroupInvite } from './pending-add.ts';

test('pending add vs group invite after login', () => {
  setPendingAdd('kevraz0r');
  assert.equal(peekPendingAdd(), 'kevraz0r');
  assert.equal(peekPendingGroupInvite(), null);
  assert.deepEqual(pendingAfterLogin(), { pathname: '/add/[code]', params: { code: 'kevraz0r' } });
  setPendingGroupInvite('a'.repeat(32));
  assert.equal(peekPendingAdd(), null);
  assert.equal(peekPendingGroupInvite(), 'a'.repeat(32));
  assert.deepEqual(pendingAfterLogin(), { pathname: '/g/[token]', params: { token: 'a'.repeat(32) } });
  setPendingAdd(null);
  assert.equal(pendingAfterLogin(), null);
});
