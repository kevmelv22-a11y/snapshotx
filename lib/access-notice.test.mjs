import assert from 'node:assert/strict';
import test from 'node:test';
import { accessNotice, accessNoticeFor } from './access-notice.ts';

test('only an interactive sign-in shows a notice', () => {
  for (const event of ['INITIAL_SESSION', 'TOKEN_REFRESHED']) {
    assert.equal(accessNoticeFor(event, false, false), null);
    assert.equal(accessNoticeFor(event, true, null), null);
  }
});

test('refused vs failed check (same branching as before: error wins)', () => {
  assert.equal(accessNoticeFor('SIGNED_IN', false, false), 'blocked');
  assert.equal(accessNoticeFor('SIGNED_IN', false, null), 'blocked');
  assert.equal(accessNoticeFor('SIGNED_IN', true, true), 'check_failed');
  assert.equal(accessNoticeFor('SIGNED_IN', false, true), null);
});

test('notice texts use the product name and keep the original wording', () => {
  assert.deepEqual(accessNotice('blocked'), { title: 'Account geblokkeerd', message: 'Je account, IP of apparaat heeft geen toegang tot SnapShot X.' });
  assert.deepEqual(accessNotice('check_failed'), { title: 'Toegang controleren mislukt', message: 'Probeer het later opnieuw.' });
});
