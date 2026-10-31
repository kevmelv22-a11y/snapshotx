import test from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUT_HINTS, shortcutOf, stepThread } from './web-shortcuts.ts';

test('shortcutOf maps keys, ignores IME and other combos', () => {
  assert.equal(shortcutOf({ key: 'k', ctrlKey: true }), 'search');
  assert.equal(shortcutOf({ key: 'K', metaKey: true }), 'search');
  assert.equal(shortcutOf({ key: 'k', ctrlKey: true, shiftKey: true }), null);
  assert.equal(shortcutOf({ key: 'k' }), null);
  assert.equal(shortcutOf({ key: 'ArrowUp', altKey: true }), 'prev');
  assert.equal(shortcutOf({ key: 'ArrowDown', altKey: true }), 'next');
  assert.equal(shortcutOf({ key: 'ArrowDown' }), null);
  assert.equal(shortcutOf({ key: 'ArrowDown', altKey: true, ctrlKey: true }), null);
  assert.equal(shortcutOf({ key: 'Escape' }), 'escape');
  assert.equal(shortcutOf({ key: 'k', ctrlKey: true, isComposing: true }), null);
  assert.equal(shortcutOf({ key: 'Process', keyCode: 229 }), null);
  assert.equal(shortcutOf(null), null);
});

test('stepThread wraps, skips demo/non-uuid rows', () => {
  const real = id => id.startsWith('t');
  const rows = [{ id: 'local-ai', demo: true }, { id: 't1' }, { id: 'x' }, { id: 't2' }, { id: 't3' }];
  assert.equal(stepThread(rows, 't1', 1, real), 't2');
  assert.equal(stepThread(rows, 't3', 1, real), 't1');
  assert.equal(stepThread(rows, 't1', -1, real), 't3');
  assert.equal(stepThread(rows, null, 1, real), 't1');
  assert.equal(stepThread(rows, 'gone', -1, real), 't3');
  assert.equal(stepThread([{ id: 't1' }], 't1', 1, real), null);
  assert.equal(stepThread([], null, 1, real), null);
  assert.ok(SHORTCUT_HINTS.length >= 4);
});
