import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { WEB_HOME, webBackAction, webBackLabel } from './web-back.ts';

test('web header back: history → back; direct link/refresh → Chat tab', () => {
  assert.equal(webBackAction(true), 'back');
  assert.equal(webBackAction(false), WEB_HOME);
  assert.equal(webBackAction(undefined), '/(tabs)/chats');
  assert.equal(webBackLabel(true), 'Terug');
  assert.equal(webBackLabel(false), 'Naar Chat');
});

test('root stack uses the web back button only on web (native keeps the platform back button)', () => {
  const src = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(src, /Platform\.OS==='web'\?\{headerLeft:/);
});
