import assert from 'node:assert/strict';
import test from 'node:test';
import { startCall, mediaErrorText } from './call-engine.ts';
import { userCallTopic, callSessionTopic, RING_TIMEOUT_MS } from './call-signal.ts';

const CALL = '3f1c2b9a-1111-4222-8333-444455556666';
const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 20) => { for (let i = 0; i < n; i++) await tick(); };

/** In-memory Realtime: broadcast to everyone on a topic except the sender (self:false). */
function bus() {
  const subs = new Map(); const log = [];
  const join = async (topic, onMessage) => {
    const me = { onMessage }; if (!subs.has(topic)) subs.set(topic, new Set()); subs.get(topic).add(me);
    return { send: async (event, payload) => { log.push({ topic, event, payload }); for (const s of subs.get(topic) ?? []) if (s !== me) s.onMessage?.(event, payload); }, leave: () => subs.get(topic)?.delete(me) };
  };
  const sendOnce = async (topic, event, payload) => { const c = await join(topic); await c.send(event, payload); c.leave(); };
  return { join, sendOnce, log, subs };
}
function fakeStream(kinds = ['audio', 'video']) { const tracks = kinds.map(kind => ({ kind, stopped: false, stop() { this.stopped = true; } })); return { tracks, getTracks: () => tracks }; }
function fakePeer(registry) {
  const p = { connectionState: 'new', remoteDescription: null, localDescription: null, tracks: [], ice: [], closed: false,
    onicecandidate: null, ontrack: null, onconnectionstatechange: null,
    addTrack(t) { this.tracks.push(t); },
    async createOffer() { return { type: 'offer', sdp: 'v=0 offer' }; },
    async createAnswer() { return { type: 'answer', sdp: 'v=0 answer' }; },
    async setLocalDescription(d) { this.localDescription = d; this.onicecandidate?.({ candidate: { candidate: 'cand-' + d.type, sdpMid: '0', sdpMLineIndex: 0 } }); this.maybeConnect(); },
    async setRemoteDescription(d) { this.remoteDescription = d; this.ontrack?.({ streams: [{ id: 'remote-of-' + d.type }] }); this.maybeConnect(); },
    async addIceCandidate(c) { this.ice.push(c); },
    maybeConnect() { if (this.localDescription && this.remoteDescription && this.connectionState !== 'connected') { this.connectionState = 'connected'; this.onconnectionstatechange?.(); } },
    close() { this.closed = true; this.connectionState = 'closed'; } };
  registry.push(p); return p;
}
function party(b, peers, over) {
  const ev = { ended: null, note: null, connected: 0, answered: 0, remote: null, local: null };
  const h = startCall({ callId: CALL, threadId: 't1', fromName: over.me === 'A' ? 'Ann' : 'Bob', video: true,
    getUserMedia: async () => fakeStream(), createPeer: () => fakePeer(peers), join: b.join, sendOnce: b.sendOnce,
    onLocal: s => { ev.local = s; }, onRemote: s => { ev.remote = s; }, onAnswered: () => ev.answered++, onConnected: () => ev.connected++,
    onEnd: (r, n) => { ev.ended = r; ev.note = n; }, ...over });
  return { h, ev };
}

test('caller and callee negotiate offer/answer/ICE and connect', async () => {
  const b = bus(), peers = [];
  const caller = party(b, peers, { me: 'A', peer: 'B', role: 'caller' });
  await settle();
  const invite = b.log.find(m => m.topic === userCallTopic('B') && m.event === 'invite');
  assert.ok(invite, 'caller rings the callee user topic');
  assert.equal(invite.payload.callId, CALL); assert.equal(invite.payload.from, 'A'); assert.equal(invite.payload.fromName, 'Ann'); assert.equal(invite.payload.video, true);
  const callee = party(b, peers, { me: 'B', peer: 'A', role: 'callee' });
  await settle(40);
  assert.equal(caller.ev.answered, 1);
  assert.equal(caller.ev.connected, 1); assert.equal(callee.ev.connected, 1);
  assert.equal(peers[0].remoteDescription.sdp, 'v=0 answer'); assert.equal(peers[1].remoteDescription.sdp, 'v=0 offer');
  assert.ok(peers[0].ice.length + peers[1].ice.length >= 1, 'ICE candidates are exchanged');
  assert.ok(caller.ev.remote && callee.ev.remote);
  assert.equal(peers[0].tracks.length, 2);
  caller.h.hangup(); await settle();
  assert.equal(caller.ev.ended, 'local'); assert.equal(callee.ev.ended, 'hangup'); assert.equal(callee.ev.note, 'Gesprek beëindigd');
  assert.ok(caller.ev.local.tracks.every(t => t.stopped) && callee.ev.local.tracks.every(t => t.stopped), 'camera/mic released on both sides');
  assert.ok(peers.every(p => p.closed));
  caller.h.hangup(); assert.equal(caller.ev.ended, 'local', 'hangup is idempotent');
});

test('decline and busy end the caller with a Dutch reason', async () => {
  for (const [type, text] of [['decline', 'Gesprek geweigerd'], ['busy', 'In gesprek']]) {
    const b = bus(), peers = [];
    const caller = party(b, peers, { me: 'A', peer: 'B', role: 'caller' });
    await settle();
    await b.sendOnce(callSessionTopic(CALL), 'signal', { type, from: 'B' });
    await settle();
    assert.equal(caller.ev.ended, type === 'decline' ? 'declined' : 'busy'); assert.equal(caller.ev.note, text);
  }
});

test('signals from a stranger or from yourself are ignored', async () => {
  const b = bus(), peers = [];
  const caller = party(b, peers, { me: 'A', peer: 'B', role: 'caller' });
  await settle();
  await b.sendOnce(callSessionTopic(CALL), 'signal', { type: 'hangup', from: 'MALLORY' });
  await b.sendOnce(callSessionTopic(CALL), 'signal', { type: 'accept', from: 'A' });
  await settle();
  assert.equal(caller.ev.ended, null); assert.equal(caller.ev.answered, 0);
  caller.h.hangup();
});

test('unanswered call times out after the ring timeout and re-rings meanwhile', async () => {
  const b = bus(), peers = [], timers = [];
  const caller = party(b, peers, { me: 'A', peer: 'B', role: 'caller', setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; }, clearTimer: t => { t.cleared = true; } });
  await settle();
  const rings = timers.filter(t => t.ms < RING_TIMEOUT_MS);
  assert.ok(rings.length >= 5);
  rings.forEach(t => t.fn()); await settle();
  assert.equal(b.log.filter(m => m.event === 'invite').length, rings.length + 1);
  timers.find(t => t.ms === RING_TIMEOUT_MS).fn(); await settle();
  assert.equal(caller.ev.ended, 'timeout'); assert.equal(caller.ev.note, 'Geen antwoord');
  assert.ok(b.log.some(m => m.event === 'signal' && m.payload.type === 'hangup'), 'callee is told to stop ringing');
});

test('ICE that arrives before the offer is queued and applied after it', async () => {
  const b = bus(), peers = [];
  const callee = party(b, peers, { me: 'B', peer: 'A', role: 'callee' });
  await settle();
  await b.sendOnce(callSessionTopic(CALL), 'signal', { type: 'ice', from: 'A', candidate: { candidate: 'early', sdpMid: '0', sdpMLineIndex: 0 } });
  await settle();
  assert.equal(peers[0].ice.length, 0);
  await b.sendOnce(callSessionTopic(CALL), 'signal', { type: 'offer', from: 'A', sdp: 'v=0 offer' });
  await settle();
  assert.deepEqual(peers[0].ice.map(c => c.candidate), ['early']);
  assert.ok(b.log.some(m => m.payload.type === 'answer'));
  callee.h.hangup();
});

test('audio-only call asks the browser for the microphone only', async () => {
  const b = bus(), peers = []; let asked = null;
  const c = party(b, peers, { me: 'A', peer: 'B', role: 'caller', video: false, getUserMedia: async q => { asked = q; return fakeStream(['audio']); } });
  await settle();
  assert.deepEqual(asked, { audio: true, video: false });
  assert.equal(b.log.find(m => m.event === 'invite').payload.video, false);
  c.h.hangup();
});

test('denied camera/microphone ends with a clear browser hint and no signaling', async () => {
  const b = bus(), peers = [];
  const err = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
  const c = party(b, peers, { me: 'A', peer: 'B', role: 'caller', getUserMedia: async () => { throw err; } });
  await settle();
  assert.equal(c.ev.ended, 'failed'); assert.match(c.ev.note, /browser toegang tot camera en microfoon/);
  assert.equal(b.log.length, 0); assert.equal(peers.length, 0);
  assert.equal(mediaErrorText({ name: 'NotFoundError' }), 'Geen camera of microfoon gevonden.');
  assert.equal(mediaErrorText({ name: 'NotReadableError' }), 'Je camera of microfoon wordt al door een andere app gebruikt.');
  assert.match(mediaErrorText({ name: 'NoMediaDevices' }), /https/);
});
