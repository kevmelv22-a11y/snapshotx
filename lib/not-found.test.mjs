import assert from 'node:assert/strict';
import test from 'node:test';
import { notFoundCopy } from './not-found.ts';

test('404 copy is Dutch and shows only a plain, short requested path', () => {
  const c = notFoundCopy('/bestaat-niet');
  assert.equal(c.title, 'Oeps, deze pagina bestaat niet');
  assert.equal(c.path, '/bestaat-niet');
  assert.equal(c.addHint, false);
  assert.equal(notFoundCopy('/').path, '');
  assert.equal(notFoundCopy('/<script>alert(1)</script>').path, '');
  assert.equal(notFoundCopy('/' + 'a'.repeat(200)).path, '');
  assert.equal(notFoundCopy('/x?token=geheim').path, '/x');
});

test('broken friend links get a friend-specific hint', () => {
  const c = notFoundCopy('/add/');
  assert.equal(c.addHint, true);
  assert.match(c.body, /vriendenlink/);
});
