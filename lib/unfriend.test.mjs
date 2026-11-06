import assert from 'node:assert/strict';
import test from 'node:test';
import { UNFRIEND_TEXT, unfriendErrorText } from './unfriend.ts';

test('unfriend copy is Dutch and names the person', () => {
  assert.equal(UNFRIEND_TEXT.action, 'Vriendschap beëindigen');
  assert.equal(UNFRIEND_TEXT.title('Aria'), 'Aria als vriend verwijderen?');
  assert.match(UNFRIEND_TEXT.message, /geen vrienden meer/);
  assert.equal(UNFRIEND_TEXT.confirm, 'Beëindigen');
});

test('unfriendErrorText maps known RPC errors', () => {
  assert.equal(unfriendErrorText({ message: 'Not friends' }), 'Jullie zijn geen vrienden (meer).');
  assert.equal(unfriendErrorText({ message: 'invalid friend' }), 'Deze gebruiker kon niet worden verwijderd.');
  assert.equal(unfriendErrorText({ message: 'Sign in required' }), 'Log opnieuw in om door te gaan.');
  assert.equal(unfriendErrorText({ message: 'something else' }), null);
});
