import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GROUP_INVITE_TEXT, groupInviteErrorText, groupInviteUrl, isGroupInviteToken, parseGroupInviteSegment,
} from './group-invite.ts';

const TOK = 'a'.repeat(32);

test('group invite token + URL', () => {
  assert.equal(isGroupInviteToken(TOK), true);
  assert.equal(isGroupInviteToken('short'), false);
  assert.equal(groupInviteUrl(TOK), `https://snapshot-x.nl/g/${TOK}`);
  assert.equal(parseGroupInviteSegment(TOK.toUpperCase()), TOK);
  assert.equal(parseGroupInviteSegment('nope'), null);
  assert.throws(() => groupInviteUrl('bad'), /Ongeldige/);
});

test('group invite Dutch errors', () => {
  assert.match(GROUP_INVITE_TEXT.action, /Uitnodigingslink/);
  assert.equal(groupInviteErrorText({ message: 'Invite expired or revoked' }), GROUP_INVITE_TEXT.expired);
  assert.equal(groupInviteErrorText({ message: 'Group is full' }), GROUP_INVITE_TEXT.full);
  assert.equal(groupInviteErrorText({ message: 'Interaction blocked' }), GROUP_INVITE_TEXT.blocked);
  assert.equal(groupInviteErrorText({ message: 'weird' }), null);
});

test('invite share payload: link once on iOS (url field), inside the text on Android/web', async () => {
  const { inviteSharePayload, GROUP_INVITE_TEXT } = await import('./group-invite.ts');
  const url = 'https://snapshot-x.nl/g/0123456789abcdef0123456789abcdef';
  const ios = inviteSharePayload('Klas 3B', url, 'ios');
  assert.equal(ios.url, url); assert.ok(!ios.message.includes(url)); assert.match(ios.message, /"Klas 3B"/);
  for (const os of ['android', 'web']) { const p = inviteSharePayload('Klas 3B', url, os); assert.equal(p.url, undefined); assert.ok(p.message.endsWith(url)); }
  assert.match(inviteSharePayload('  ', url, 'android').message, /"Groep"/);
  assert.equal(GROUP_INVITE_TEXT.shared, 'Uitnodiging gedeeld');
});
