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
