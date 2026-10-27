import assert from 'node:assert/strict';
import test from 'node:test';
import { insertSnapMessage, isMissingViewSeconds } from './snap-send.ts';

const missing = { code: 'PGRST204', message: "Could not find the 'view_seconds' column of 'sx_messages' in the schema cache" };
test('detects only the missing view_seconds column', () => {
  assert.equal(isMissingViewSeconds(missing), true);
  assert.equal(isMissingViewSeconds({ code: 'PGRST204', message: "Could not find the 'other' column" }), false);
  assert.equal(isMissingViewSeconds({ code: '42501', message: 'permission denied' }), false);
});
test('retries without view_seconds when the column is missing', async () => {
  const rows = [];
  const res = await insertSnapMessage(async r => { rows.push(r); return { error: 'view_seconds' in r ? missing : null }; }, { kind: 'snap', view_once: true, view_seconds: 5 });
  assert.deepEqual(res, { error: null, droppedTimer: true });
  assert.deepEqual(rows[1], { kind: 'snap', view_once: true });
});
test('passes through success and other errors without retrying', async () => {
  let n = 0;
  assert.deepEqual(await insertSnapMessage(async () => { n++; return { error: null }; }, { view_seconds: 3 }), { error: null, droppedTimer: false });
  const other = { code: '42501', message: 'permission denied' };
  assert.deepEqual(await insertSnapMessage(async () => { n++; return { error: other }; }, { view_seconds: 3 }), { error: other, droppedTimer: false });
  assert.equal(n, 2);
});
