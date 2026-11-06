import test from 'node:test';
import assert from 'node:assert/strict';
import { needsSignIn } from './auth-guard.ts';

test('signed-out visitors are sent to login on private screens', () => {
  for (const p of ['/settings', '/plus', '/memories', '/avatar-editor', '/chat/abc', '/call/1', '/staff', '/settings/']) assert.equal(needsSignIn(p), true, p);
});
test('public pages stay open while signed out', () => {
  for (const p of ['/', '', '/login', '/register', '/privacy', '/voorwaarden', '/help', '/account-verwijderen', '/reset-password', '/auth/callback?code=x', '/add/ABC123', '/g/' + 'a'*32, '/dev-avatar']) assert.equal(needsSignIn(p), false, p);
});
