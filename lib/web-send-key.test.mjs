import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebSendKey } from './web-send-key.ts';

test('Enter sends on web, like Snapchat Web', () => {
  assert.equal(isWebSendKey({ key: 'Enter', keyCode: 13 }), true);
  assert.equal(isWebSendKey({ key: 'Enter', shiftKey: false, isComposing: false }), true);
});

test('Shift+Enter, Alt+Enter, IME composition and other keys do not send', () => {
  assert.equal(isWebSendKey({ key: 'Enter', shiftKey: true }), false);
  assert.equal(isWebSendKey({ key: 'Enter', altKey: true }), false);
  assert.equal(isWebSendKey({ key: 'Enter', isComposing: true }), false);
  assert.equal(isWebSendKey({ key: 'Enter', keyCode: 229 }), false);
  assert.equal(isWebSendKey({ key: 'a' }), false);
  assert.equal(isWebSendKey(null), false);
  assert.equal(isWebSendKey(undefined), false);
});
