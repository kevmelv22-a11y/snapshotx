import assert from 'node:assert/strict';
import test from 'node:test';
import { friendLink, parseCodeSegment, parseFriendCode, requestResultText } from './friend-code.ts';

const ID = 'e3c45f62-43d6-4cd2-803c-3af521d9066a';

test('QR value is a https link any phone camera can open', () => {
  assert.equal(friendLink('kevraz0r', ID), 'https://snapshot-x.nl/add/kevraz0r');
  assert.equal(friendLink('Kev', ID), 'https://snapshot-x.nl/add/kev');
  assert.equal(friendLink('kv.savage', ID), 'https://snapshot-x.nl/add/kv.savage');
  assert.equal(friendLink('kv-savage', ID), 'https://snapshot-x.nl/add/kv-savage');
  assert.equal(parseFriendCode('https://snapshot-x.nl/add/kv.savage')?.value, 'kv.savage');
  assert.equal(friendLink('.ab', ID), `https://snapshot-x.nl/add/${ID}`);
  assert.equal(friendLink(null, ID.toUpperCase()), `https://snapshot-x.nl/add/${ID}`);
});

test('scanner accepts web, app-scheme, legacy and path forms', () => {
  const u = { kind: 'username', value: 'kevraz0r' };
  for (const s of ['https://snapshot-x.nl/add/kevraz0r', 'http://www.snapshot-x.nl/add/KevRaz0r/', 'snapshot-x.nl/add/kevraz0r?ref=qr',
    'snapshotx://add/kevraz0r', 'snapshotx:///add/kevraz0r', 'snapshotx://friends?u=kevraz0r', '/add/@kevraz0r', ' https://snapshot-x.nl/add/%40kevraz0r '])
    assert.deepEqual(parseFriendCode(s), u, s);
  assert.deepEqual(parseFriendCode(`https://snapshot-x.nl/add/${ID.toUpperCase()}`), { kind: 'id', value: ID });
  assert.deepEqual(parseFriendCode(`snapshotx://friends?id=${ID}`), { kind: 'id', value: ID });
});

test('scanner rejects foreign or malformed codes', () => {
  for (const s of ['', null, 'kevraz0r', 'https://evil.example/add/kevraz0r', 'https://snapshot-x.nl.evil.com/add/kevraz0r', 'https://snapshot-x.nl/add/',
    'https://snapshot-x.nl/add/ab', 'https://snapshot-x.nl/add/kev/raz', 'snapshotx://friends?u=' + ID, 'snapshotx://friends?id=kevin',
    'https://snapshot-x.nl/add/<script>', 'x'.repeat(400)])
    assert.equal(parseFriendCode(s), null, String(s));
  assert.equal(parseCodeSegment('%E0%A4%A'), null);
});

test('server results map to Dutch feedback', () => {
  assert.match(requestResultText('accepted', 'Bea'), /nu vrienden/);
  assert.match(requestResultText('pending', 'Bea'), /verstuurd/);
  assert.match(requestResultText('friends', 'Bea'), /al bevriend/);
  assert.match(requestResultText(undefined, 'Bea'), /mis/);
});

import { pendingAddText } from './friend-code.ts';
test('signed-out add link: login screen says whom you are about to add', () => {
  assert.match(pendingAddText('kevraz0r'), /@kevraz0r toe te voegen/);
  assert.match(pendingAddText('%40Kv.Savage'), /@kv\.savage/);
  assert.match(pendingAddText('3f1c2b9a-1111-4222-8333-444455556666'), /je vriend toe te voegen/);
  assert.equal(pendingAddText(null), null);
  assert.equal(pendingAddText('<b>'), null);
});
