import test from 'node:test';
import assert from 'node:assert/strict';
import { SPLIT_LIST_WIDTH, SPLIT_MIN_WIDTH, isSplitLayout, pickOpenThread } from './web-layout.ts';

test('split view only on wide web', () => {
  assert.equal(SPLIT_MIN_WIDTH, 1024); assert.equal(SPLIT_LIST_WIDTH, 360);
  assert.equal(isSplitLayout(1440, 'web'), true);
  assert.equal(isSplitLayout(1024, 'web'), true);
  assert.equal(isSplitLayout(1023, 'web'), false);
  assert.equal(isSplitLayout(1440, 'ios'), false);
  assert.equal(isSplitLayout(1440, 'android'), false);
  assert.equal(isSplitLayout(NaN, 'web'), false);
});

test('pickOpenThread keeps current or picks first real row', () => {
  const real = id => id.startsWith('t');
  const rows = [{ id: 'local-ai', demo: true }, { id: 't1' }, { id: 't2' }];
  assert.equal(pickOpenThread(null, rows, real), 't1');
  assert.equal(pickOpenThread('t2', rows, real), 't2');
  assert.equal(pickOpenThread('gone', rows, real), 't1');
  assert.equal(pickOpenThread(null, [{ id: 'local-ai', demo: true }], real), null);
  assert.equal(pickOpenThread(null, [], real), null);
});

test('side rail is narrow and lists only existing routes in order', async () => {
  const { SIDE_RAIL_WIDTH, railItems } = await import('./web-layout.ts');
  assert.ok(SIDE_RAIL_WIDTH >= 80 && SIDE_RAIL_WIDTH <= 96);
  const items = [{ name: 'map' }, { name: 'chats' }, { name: 'index' }];
  assert.deepEqual(railItems(items, ['chats', 'index', 'profile']).map(i => i.name), ['chats', 'index']);
  assert.deepEqual(railItems(items, []), []);
});

test('web footer text is exact', async () => {
  const { WEB_FOOTER } = await import('./web-layout.ts');
  assert.equal(WEB_FOOTER, '• © Vonk Byte • Snapshot-X 2026-2027 •');
});

test('no "Start demo als Kevin" button on the live public web version', async () => {
  const { showDemoLoginButton, PUBLIC_WEB_HOSTS } = await import('./web-layout.ts');
  // Plain demo deploy (EXPO_PUBLIC_DEMO_MODE=1 only) → no button.
  assert.equal(showDemoLoginButton(true, undefined, 'localhost'), false);
  // Real (non-demo) build → never.
  assert.equal(showDemoLoginButton(false, '1', 'localhost'), false);
  // Local opt-in for testing.
  assert.equal(showDemoLoginButton(true, '1', 'localhost'), true);
  // Public hosts → never, even with the opt-in flag.
  for (const h of PUBLIC_WEB_HOSTS) assert.equal(showDemoLoginButton(true, '1', h), false, h);
  assert.equal(showDemoLoginButton(true, '1', 'SNAPSHOT-X.NL'), false);
  assert.ok(PUBLIC_WEB_HOSTS.includes('snapshot-x.nl'));
});

import { splitChatParam } from './web-layout.ts';
test('?chat= keeps the open desktop chat only for a real thread uuid', () => {
  const id = '3F1C2B9A-1111-4222-8333-444455556666';
  assert.equal(splitChatParam(id), id.toLowerCase());
  assert.equal(splitChatParam([id, 'x']), id.toLowerCase());
  assert.equal(splitChatParam('local-ai'), null);
  assert.equal(splitChatParam('<script>'), null);
  assert.equal(splitChatParam(undefined), null);
});
