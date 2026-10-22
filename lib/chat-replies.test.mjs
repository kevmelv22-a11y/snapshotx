import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as R from './chat-replies.ts';
import * as S from './chat-senders.ts';

const ARIA = 'b0000000-0000-4000-8000-0000000000a1', ME = 'b0000000-0000-4000-8000-000000000001';
const orig = { id: 'e0000000-0000-4000-8000-000000000042', sender_id: ARIA, kind: 'text', body: 'Kom je vanavond ook naar het concert? 🎸' };

test('replyBody → parseReply round-trip keeps id, sender, kind, excerpt and text', () => {
  const body = R.replyBody(orig, '  Ja zeker!  ');
  assert.ok(body.startsWith('[reply:e0000000-0000-4000-8000-000000000042|'));
  const p = R.parseReply(body);
  assert.deepEqual(p, { ref: { id: orig.id, senderId: ARIA, kind: 'text', excerpt: orig.body }, text: 'Ja zeker!' });
  assert.equal(R.replyText(body), 'Ja zeker!');
});
test('excerpt survives ], |, newlines and percent signs; multi-line reply text is kept', () => {
  const tricky = { ...orig, body: 'a]b|c\nd 100% [x]' };
  const p = R.parseReply(R.replyBody(tricky, 'regel 1\nregel 2'));
  assert.equal(p.ref.excerpt, 'a]b|c d 100% [x]');
  assert.equal(p.text, 'regel 1\nregel 2');
});
test('empty reply text sends nothing; system lines are not quotable', () => {
  assert.equal(R.replyBody(orig, '   '), null);
  assert.equal(R.canReply({ kind: 'system' }), false);
  assert.equal(R.canReply({ kind: 'snap' }), true);
  assert.equal(R.replyBody({ ...orig, kind: 'system' }, 'hoi'), 'hoi');
});
test('quotes of media, snaps, stickers and nested replies', () => {
  assert.deepEqual(R.quoteOf({ ...orig, kind: 'snap', body: 'photo' }), { kind: 'snap', excerpt: '■ Snap' });
  assert.deepEqual(R.quoteOf({ ...orig, kind: 'photo', body: null }), { kind: 'photo', excerpt: '📷 Foto' });
  assert.deepEqual(R.quoteOf({ ...orig, kind: 'voice', body: null }), { kind: 'voice', excerpt: '🎙 Spraakbericht' });
  assert.deepEqual(R.quoteOf({ ...orig, body: '[avatar-sticker:hoi]' }), { kind: 'sticker', excerpt: '☺ Avatarsticker: Hoi!' });
  // Replying to a reply quotes only its own text, never the nested quote.
  const nested = { ...orig, sender_id: ME, body: R.replyBody(orig, 'Ja!') };
  assert.deepEqual(R.quoteOf(nested), { kind: 'text', excerpt: 'Ja!' });
});
test('long excerpts are clipped to EXCERPT_MAX with an ellipsis (emoji-safe)', () => {
  const q = R.quoteOf({ ...orig, body: '🔥'.repeat(200) });
  assert.equal([...q.excerpt].length, R.EXCERPT_MAX);
  assert.ok(q.excerpt.endsWith('…'));
});
test('normal and malformed bodies are not replies (shown raw)', () => {
  for (const b of [null, undefined, 'hoi', '[reply:abc]\nx', '[reply:a|b|gif|x]\ny', '[reply:a|b|text|%E0%A4%A]\ny']) assert.equal(R.parseReply(b), null, String(b));
  assert.equal(R.replyText('gewoon tekst'), 'gewoon tekst');
});
test('reply bar title and swipe detection', () => {
  assert.equal(R.replyBarTitle(ARIA, ME, 'Aria de Vries'), 'Antwoord op Aria');
  assert.equal(R.replyBarTitle(ME, ME, 'Kevin'), 'Antwoord op jezelf');
  assert.equal(R.replyBarTitle(ARIA, ME, null), 'Antwoord op vriend');
  assert.equal(R.isReplySwipe(60, 10), true);
  assert.equal(R.isReplySwipe(60, 40), false);
  assert.equal(R.isReplySwipe(-80, 0), false);
  assert.equal(R.startsReplySwipe(14, 3), true);
  assert.equal(R.startsReplySwipe(3, 14), false);
  assert.equal(R.startsReplySwipe(-20, 0), false);
});
test('quotedIndex finds the original or -1 when it disappeared', () => {
  const ref = R.parseReply(R.replyBody(orig, 'x')).ref;
  assert.equal(R.quotedIndex([{ id: 'n' }, { id: orig.id }], ref), 1);
  assert.equal(R.quotedIndex([{ id: 'n' }], ref), -1);
});
test('long-press menu: everyone can reply; report + block only for others', () => {
  assert.deepEqual(S.messageMenuActions(true), ['reply']);
  assert.deepEqual(S.messageMenuActions(false), ['reply', 'report', 'block']);
  assert.equal(S.MENU_LABEL.reply, 'Antwoorden');
});
test('demo seed: quoted replies point at real messages; chat list preview hides the quote prefix', async () => {
  const { DemoClient } = await import('./demo-client.ts');
  const c = new DemoClient(), CREW = 'c0000000-0000-4000-8000-000000000002';
  const msgs = c.m.table('sx_messages');
  const replies = msgs.map(x => [x, R.parseReply(x.body)]).filter(([, p]) => p);
  assert.ok(replies.length >= 2);
  for (const [x, p] of replies) {
    const target = msgs.find(t => t.id === p.ref.id);
    assert.ok(target, 'quoted message exists');
    assert.equal(target.thread_id, x.thread_id);
    assert.equal(p.ref.senderId, target.sender_id);
    assert.equal(p.ref.excerpt, R.quoteOf(target).excerpt);
  }
  const eva = replies.find(([x]) => x.thread_id === CREW);
  assert.equal(eva[1].text, 'Ik ben erbij 🙌');
  assert.match(eva[1].ref.excerpt, /^Zaterdag 14:00/);
});
test('chat screen + list wire replies: swipe, menu, reply bar, send, quote in bubble, preview', () => {
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(chat, /replyTo\?replyBody\(replyTo,text\):text/);
  assert.match(chat, /onReply=\{startReply\}/);
  assert.match(chat, /<ReplyBar /);
  const view = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  assert.match(view, /<SwipeToReply /);
  assert.match(view, /<QuoteBlock /);
  assert.match(view, /p\.renderContent\(shown,mine\)/);
  assert.match(view, /keyboardShouldPersistTaps="handled"/);
  // swipe distance from the events' pageX (gestureState.dx is stale on react-native-web after the first gesture)
  const sw = readFileSync(new URL('../components/chat/ChatReply.tsx', import.meta.url), 'utf8');
  assert.match(sw, /d\.dx=e\.nativeEvent\.pageX-d\.gx\+d\.slop/);
  assert.match(sw, /useMemo\(\(\)=>createReplyPan\(x,/);
  const list = readFileSync(new URL('./chat-list.ts', import.meta.url), 'utf8');
  assert.match(list, /chatPreviewText\(replyText\(last\.body\)\)/);
});
test('readableBody: staff console shows replies readable, other bodies unchanged', () => {
  assert.equal(R.readableBody(R.replyBody({ id: 'a1', sender_id: 'u1', kind: 'text', body: 'Hoi?' }, 'Ja')), '↩ Antwoord op „Hoi?": Ja');
  assert.equal(R.readableBody('gewoon'), 'gewoon');
  assert.equal(R.readableBody(null), null);
});
