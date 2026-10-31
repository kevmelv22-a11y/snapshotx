import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInvite, parseSignal, userCallTopic, callSessionTopic, endReasonText, RING_TIMEOUT_MS } from './call-signal.ts';

const ID = '3f1c2b9a-1111-4222-8333-444455556666';
test('topics are per user and per call', () => {
  assert.equal(userCallTopic('u1'), 'sx-call-user:u1');
  assert.equal(callSessionTopic(ID), `sx-call:${ID}`);
});
test('parseInvite accepts fresh invites and drops stale or malformed ones', () => {
  const now = 1_000_000;
  assert.deepEqual(parseInvite({ callId: ID, from: 'a', fromName: 'Ann', threadId: 't', video: true, at: now }, now), { callId: ID, from: 'a', fromName: 'Ann', threadId: 't', video: true, at: now });
  assert.equal(parseInvite({ callId: ID, from: 'a', threadId: 't', at: now - RING_TIMEOUT_MS - 1 }, now), null);
  assert.equal(parseInvite({ callId: 'x y', from: 'a', threadId: 't', at: now }, now), null);
  assert.equal(parseInvite(null, now), null);
  assert.equal(parseInvite({ callId: ID, from: 'a', threadId: 't', at: now }, now).fromName, 'Iemand');
});
test('parseSignal ignores own and malformed signals', () => {
  assert.equal(parseSignal({ type: 'accept', from: 'me' }, 'me'), null);
  assert.deepEqual(parseSignal({ type: 'accept', from: 'b' }, 'me'), { type: 'accept', from: 'b' });
  assert.equal(parseSignal({ type: 'offer', from: 'b' }, 'me'), null);
  assert.deepEqual(parseSignal({ type: 'answer', from: 'b', sdp: 'v=0' }, 'me'), { type: 'answer', from: 'b', sdp: 'v=0' });
  assert.deepEqual(parseSignal({ type: 'ice', from: 'b', candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 } }, 'me'), { type: 'ice', from: 'b', candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 } });
  assert.equal(parseSignal({ type: 'evil', from: 'b' }, 'me'), null);
});
test('end reasons are Dutch', () => {
  assert.equal(endReasonText('declined'), 'Gesprek geweigerd');
  assert.equal(endReasonText('timeout'), 'Geen antwoord');
});

import { iceServersFrom, hasTurn, STUN_SERVERS, CALL_ICE_SERVERS } from './call-signal.ts';
test('TURN relay is added only with valid turn:/turns: URLs plus username and credential', () => {
  assert.deepEqual(iceServersFrom({}), STUN_SERVERS);
  assert.equal(hasTurn(iceServersFrom({})), false);
  const ok = iceServersFrom({ urls: 'turn:turn.snapshot-x.nl:3478?transport=udp, turns:turn.snapshot-x.nl:5349?transport=tcp', username: 'u', credential: 'c' });
  assert.equal(ok.length, 2);
  assert.deepEqual(ok[1], { urls: ['turn:turn.snapshot-x.nl:3478?transport=udp', 'turns:turn.snapshot-x.nl:5349?transport=tcp'], username: 'u', credential: 'c' });
  assert.equal(hasTurn(ok), true);
  assert.deepEqual(iceServersFrom({ urls: 'turn:x.nl', username: 'u' }), STUN_SERVERS, 'missing credential');
  assert.deepEqual(iceServersFrom({ urls: 'http://evil.example', username: 'u', credential: 'c' }), STUN_SERVERS, 'not a TURN url');
  assert.deepEqual(iceServersFrom({ urls: 'turn:a.nl,javascript:alert(1)', username: 'u', credential: 'c' }), STUN_SERVERS);
  assert.ok(CALL_ICE_SERVERS.length >= 1 && CALL_ICE_SERVERS[0].urls[0].startsWith('stun:'));
});
