import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { cameraGate, captureErrorText, pickedKind } from './camera-gate.ts';

test('camera gate: ask first, browser help on web when blocked, phone settings on native', () => {
  assert.equal(cameraGate(null, 'web').action, 'ask');
  assert.equal(cameraGate({ granted: false, canAskAgain: true }, 'ios').action, 'ask');
  assert.equal(cameraGate({ granted: false, canAskAgain: false }, 'web').action, 'browser');
  assert.match(cameraGate({ granted: false, canAskAgain: false }, 'web').body, /slotje/);
  assert.equal(cameraGate({ granted: false, canAskAgain: false }, 'android').action, 'settings');
});
test('capture errors become friendly Dutch text', () => {
  assert.match(captureErrorText('photo', new Error('NotAllowedError: Permission denied')), /geen toegang tot de camera/);
  assert.match(captureErrorText('video', new Error('Camera is not ready yet')), /nog niet klaar/);
  assert.equal(captureErrorText('photo', 42), 'Foto maken is mislukt. Probeer het opnieuw.');
  assert.equal(pickedKind('video'), 'video'); assert.equal(pickedKind('image'), 'photo'); assert.equal(pickedKind(undefined), 'photo');
});
test('camera tab uses an on-screen notice, not Alert.alert (no-op on web), and offers the gallery', async () => {
  const src = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Alert\.alert/);
  assert.match(src, /captureErrorText\('photo'/); assert.match(src, /captureErrorText\('video'/);
  assert.match(src, /launchImageLibraryAsync/); assert.match(src, /testID="camera-gallery"/);
});
