import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_ONLINE_MS, CONN_TEXT, connStep, connText } from './connection-banner.ts';

test('offline → back → online after BACK_ONLINE_MS', () => {
  let s = { phase: 'online', since: 0 };
  assert.equal(connText(s), null);
  s = connStep(s, false, 10); assert.equal(s.phase, 'offline'); assert.equal(connText(s), CONN_TEXT.offline);
  assert.equal(connStep(s, false, 50), s, 'stays the same object while offline');
  s = connStep(s, true, 100); assert.equal(s.phase, 'back'); assert.equal(connText(s), 'Weer online');
  assert.equal(connStep(s, true, 100 + BACK_ONLINE_MS - 1).phase, 'back');
  assert.equal(connStep(s, true, 100 + BACK_ONLINE_MS).phase, 'online');
  assert.equal(connStep({ phase: 'online', since: 0 }, true, 5).phase, 'online');
});
