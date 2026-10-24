import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIRM_IDLE, confirmReducer, isConfirmBusy, isConfirmVisible, noticeRequest } from './confirm-flow.ts';

const req = { title: 'Rol intrekken', message: 'Moderator intrekken bij @bea?', destructive: true };
const run = (events, start = CONFIRM_IDLE) => events.reduce(confirmReducer, start);

test('request opens the dialog, cancel closes it without running', () => {
  const open = run([{ type: 'request', request: req }]);
  assert.equal(open.phase, 'open');
  assert.ok(isConfirmVisible(open));
  assert.equal(run([{ type: 'cancel' }], open), CONFIRM_IDLE);
});

test('confirm -> running -> succeeded closes the dialog', () => {
  const running = run([{ type: 'request', request: req }, { type: 'confirm' }]);
  assert.equal(running.phase, 'running');
  assert.ok(isConfirmBusy(running));
  assert.equal(run([{ type: 'succeeded' }], running), CONFIRM_IDLE);
});

test('a failed action re-opens the same question with the server error', () => {
  const failed = run([{ type: 'request', request: req }, { type: 'confirm' }, { type: 'failed', error: 'cannot remove the last owner' }]);
  assert.equal(failed.phase, 'open');
  assert.equal(failed.error, 'cannot remove the last owner');
  assert.equal(failed.request, req);
  // retry clears the error
  assert.equal(run([{ type: 'confirm' }], failed).error, null);
});

test('while running: cancel, a second confirm and new requests are ignored (no double submit)', () => {
  const running = run([{ type: 'request', request: req }, { type: 'confirm' }]);
  assert.equal(run([{ type: 'cancel' }], running), running);
  assert.equal(run([{ type: 'confirm' }], running), running);
  assert.equal(run([{ type: 'request', request: { title: 'x', message: 'y' } }], running), running);
});

test('stray events in idle are no-ops', () => {
  for (const e of [{ type: 'cancel' }, { type: 'confirm' }, { type: 'succeeded' }, { type: 'failed', error: 'x' }]) assert.equal(confirmReducer(CONFIRM_IDLE, e), CONFIRM_IDLE);
  assert.equal(run([{ type: 'request', request: req }, { type: 'confirm' }, { type: 'failed', error: '' }]).error, 'Actie mislukt.');
});

test('noticeRequest builds a one-button notice that opens and closes like a confirm', () => {
  const n = noticeRequest('Account geblokkeerd', 'Geen toegang.');
  assert.deepEqual(n, { title: 'Account geblokkeerd', message: 'Geen toegang.', confirmLabel: 'OK', notice: true });
  assert.equal(noticeRequest('a', 'b', 'Begrepen').confirmLabel, 'Begrepen');
  const opened = run([{ type: 'request', request: n }]);
  assert.equal(isConfirmVisible(opened), true);
  assert.equal(run([{ type: 'confirm' }, { type: 'succeeded' }], opened).phase, 'idle');
  assert.equal(run([{ type: 'cancel' }], opened).phase, 'idle'); // Android back / web Escape dismisses
});
