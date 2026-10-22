import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('./ts-resolve-hook.mjs', import.meta.url);
const S = await import('./chat-senders.ts');
const t0 = Date.parse('2026-10-22T20:00:00Z'), M = 60_000;
const m = (id, s, min, kind = 'text') => ({ id, sender_id: s, kind, created_at: new Date(t0 + min * M).toISOString() });

test('colours: me red, friends distinct and stable regardless of member order', () => {
  const a = S.senderColors(['me', 'eva', 'aria', 'cleo', 'noor'], 'me'), b = S.senderColors(['noor', 'cleo', 'me', 'aria', 'eva'], 'me');
  assert.equal(a.get('me'), S.ME_COLOR);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  const friends = ['aria', 'cleo', 'eva', 'noor'].map(x => a.get(x));
  assert.equal(new Set(friends).size, 4); assert.ok(!friends.includes(S.ME_COLOR));
  assert.equal(S.senderColors(['me', 'aria'], 'me').get('aria'), S.SENDER_COLORS[0]);
  assert.notEqual(S.colorFor('left-user', a), S.ME_COLOR); assert.equal(S.colorFor('aria', a), a.get('aria'));
});

test('labels: IK for me, uppercase first name for others', () => {
  assert.equal(S.senderLabel('me', 'me', 'Kevin'), 'IK');
  assert.equal(S.senderLabel('a', 'me', 'Aria de Vries'), 'ARIA');
  assert.equal(S.senderLabel('a', 'me', '  '), 'VRIEND'); assert.equal(S.senderLabel('a', 'me', null), 'VRIEND');
});

test('runs: newest-first list, label on the oldest message of each run; system lines and gaps break runs', () => {
  const chrono = [m('1', 'cleo', 0), m('2', 'cleo', 1), m('3', 'noor', 2), m('4', 'me', 3), m('5', 'me', 4), m('s', 'me', 5, 'system'), m('6', 'me', 6), m('7', 'me', 40), m('8', 'aria', 41)];
  const starts = S.runStarts([...chrono].reverse());
  assert.deepEqual([...starts].sort(), ['1', '3', '4', '6', '7', '8']);
  assert.equal(S.runStarts([]).size, 0);
});

test('empty rows never render as an empty bubble', () => {
  assert.match(S.emptyMessageText({ kind: 'snap', body: null, media_path: null }), /Snap/);
  assert.equal(S.emptyMessageText({ kind: 'snap', body: null, media_path: 'x.jpg' }), null);
  assert.equal(S.emptyMessageText({ kind: 'text', body: '  ', media_path: null }), 'Bericht niet beschikbaar');
  assert.equal(S.emptyMessageText({ kind: 'text', body: 'Hoi', media_path: null }), null);
});

test('report + block live in the long-press menu (not inline), and still do the same thing', () => {
  assert.deepEqual(S.messageMenuActions(false), ['report', 'block']); assert.deepEqual(S.messageMenuActions(true), []);
  const src = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /extraActions=\{/);
  assert.match(src, /MENU_LABEL\.report[\s\S]{0,200}pathname:'\/report',params:\{message_id:/);
  assert.match(src, /MENU_LABEL\.block[\s\S]{0,120}blockSender\(/);
  assert.match(src, /sx_blocks'\)\.insert\(\{blocker_id:uid,blocked_id:senderId\}\)/);
  assert.doesNotMatch(src, /<Text[^>]*>Meld bericht<\/Text>/); assert.doesNotMatch(src, /<Text[^>]*>Blokkeer gebruiker<\/Text>/);
});

test('one chat header: native stack header hidden, in-screen header has back + group subtitle', () => {
  const src = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /<Stack\.Screen options=\{\{headerShown:false/);
  const v = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  assert.match(v, /leden · tik voor info/); assert.match(v, /accessibilityLabel="Terug"/);
});

test('demo seed: Weekend crew has no empty messages and every sender is a member', async () => {
  const { DemoClient } = await import('./demo-client.ts');
  const c = new DemoClient(), CREW = 'c0000000-0000-4000-8000-000000000002';
  const mem = new Set(c.m.table('sx_members').filter(x => x.thread_id === CREW).map(x => x.user_id));
  const msgs = c.m.table('sx_messages').filter(x => x.thread_id === CREW && x.kind !== 'system');
  assert.ok(msgs.length >= 6);
  for (const x of msgs) { assert.equal(S.emptyMessageText(x), null, `empty message ${x.id}`); assert.ok(mem.has(x.sender_id), `non-member sender ${x.sender_id}`); }
  assert.ok(new Set(msgs.map(x => x.sender_id)).size >= 4);
});

test('long-press menu survives the finger lifting (backdrop guard)', () => {
  const src = readFileSync(new URL('../components/chat/ChatParts.tsx', import.meta.url), 'utf8');
  assert.match(src, /BACKDROP_GUARD_MS=\d+/);
  assert.match(src, /onPress=\{backdrop\}/);
  assert.match(src, /armed=\(\)=>ready\.current&&pressedInside\.current/);
  // every action and emoji is guarded, so lifting the finger can never trigger Blokkeer/Meld
  assert.equal((src.match(/if\(!armed\(\)\)return;/g) || []).length, 2);
});
