import assert from 'node:assert/strict';
import test from 'node:test';
import { dbErrorKind, friendlyError, isUnavailable } from './db-errors.ts';

const live = {
  locations: { code: '42501', message: 'permission denied for table sx_locations' },
  stories: { code: '42501', message: 'permission denied for table sx_stories' },
  friends: { code: '42501', message: 'permission denied for table sx_friends' },
  coerce: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'The result contains 0 rows' },
};

test('the four live errors are classified and never shown raw', () => {
  for (const e of [live.locations, live.stories, live.friends]) {
    assert.equal(dbErrorKind(e), 'permission');
    assert.equal(isUnavailable(e), true);
    const text = friendlyError(e, 'Kaart');
    assert.doesNotMatch(text, /permission|sx_|denied|42501/i);
    assert.match(text, /^Kaart: nu niet beschikbaar/);
  }
  assert.equal(dbErrorKind(live.coerce), 'no_row');
  assert.equal(friendlyError(live.coerce, 'Je profiel'), 'Je profiel: niet gevonden.');
  assert.doesNotMatch(friendlyError(live.coerce), /coerce|JSON/i);
});

test('row-level security violations are "not allowed", not "unavailable"', () => {
  const e = { code: '42501', message: 'new row violates row-level security policy for table "sx_receipts"' };
  assert.equal(dbErrorKind(e), 'rls');
  assert.equal(isUnavailable(e), false);
  assert.equal(friendlyError(e), 'Dit is niet toegestaan.');
});

test('missing migrations read as "nog niet beschikbaar"', () => {
  for (const e of [{ code: 'PGRST205', message: "Could not find the table 'public.sx_x' in the schema cache" },
    { code: '42703', message: 'column sx_locations.ghost_until does not exist' },
    { code: 'PGRST202', message: 'Could not find the function public.sx_ensure_profile without parameters' }]) {
    assert.equal(isUnavailable(e), true);
    assert.match(friendlyError(e, 'Stories'), /^Stories: nog niet beschikbaar/);
  }
});

test('network, session, duplicates, known SQL exceptions and auth errors in Dutch', () => {
  assert.match(friendlyError(new TypeError('Network request failed')), /Geen verbinding/);
  assert.match(friendlyError({ code: 'PGRST301', message: 'JWT expired' }), /sessie is verlopen/);
  assert.equal(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint' }), 'Dit bestaat al.');
  assert.equal(friendlyError({ code: 'P0001', message: 'Only friends can be added' }), 'Je kunt alleen vrienden toevoegen aan een chat.');
  assert.equal(friendlyError({ message: 'Invalid login credentials', status: 400 }), 'E-mailadres of wachtwoord klopt niet.');
});

test('app-thrown Dutch messages are kept; unknown technical text becomes generic', () => {
  assert.equal(friendlyError(new Error('Meldingen zijn niet toegestaan op dit toestel.')), 'Meldingen zijn niet toegestaan op dit toestel.');
  assert.equal(friendlyError({ code: 'XX000', message: 'internal error' }), 'Er ging iets mis. Probeer het opnieuw.');
  assert.equal(friendlyError(new Error('Cannot read properties of undefined')), 'Er ging iets mis. Probeer het opnieuw.');
  assert.equal(friendlyError(null), '');
});
