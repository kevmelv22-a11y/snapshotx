import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as M from './chat-mentions.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ME = 'me', ARIA = 'aria', NOOR = 'noor', EVA = 'eva', EVA2 = 'eva2';
const members = [{ id: ME, name: 'Kevin' }, { id: ARIA, name: 'Aria de Vries' }, { id: NOOR, name: 'Noor El Amrani' }, { id: EVA, name: 'Eva Smit' }];

test('mentionQuery: "@" at start or after a space opens the picker; e-mail addresses and spaces do not', () => {
  assert.deepEqual(M.mentionQuery('@'), { start: 0, query: '' });
  assert.deepEqual(M.mentionQuery('hoi @Ar'), { start: 4, query: 'Ar' });
  assert.deepEqual(M.mentionQuery('(@no'), { start: 1, query: 'no' });
  assert.equal(M.mentionQuery('mail kevin@x.nl'), null, 'no picker inside an e-mail address');
  assert.equal(M.mentionQuery('@Aria '), null, 'a space closes the picker');
  assert.equal(M.mentionQuery('geen apenstaartje'), null);
  assert.equal(M.mentionQuery('@' + 'a'.repeat(M.MENTION_QUERY_MAX + 1)), null);
  assert.deepEqual(M.mentionQuery('@Ar en meer', 3), { start: 0, query: 'Ar' }, 'uses the caret, not the end');
});
test('mentionCandidates: never yourself; prefix of first name first; any name part; accent/case-insensitive', () => {
  assert.deepEqual(M.mentionCandidates(members, ME, '').map(m => m.id), [ARIA, EVA, NOOR]);
  assert.deepEqual(M.mentionCandidates(members, ME, 'a').map(m => m.id), [ARIA, NOOR], 'Aria (first name) before Noor (El Amrani)');
  assert.deepEqual(M.mentionCandidates(members, ME, 'SMI').map(m => m.id), [EVA]);
  assert.deepEqual(M.mentionCandidates([...members, { id: 'z', name: 'Zoë' }], ME, 'zoe').map(m => m.id), ['z']);
  assert.deepEqual(M.mentionCandidates(members, ME, 'kev'), [], 'you cannot mention yourself');
  assert.deepEqual(M.mentionCandidates(members, ME, 'xyz'), []);
  assert.equal(M.mentionCandidates([...members, { id: ARIA, name: 'Aria de Vries' }], ME, '').length, 3, 'duplicates removed');
});
test('mentionLabel: first name, full name only when the first name is shared', () => {
  assert.equal(M.mentionLabel(members[1], members), 'Aria');
  const two = [...members, { id: EVA2, name: 'Eva de Boer' }];
  assert.equal(M.mentionLabel(two[3], two), 'Eva Smit');
  assert.equal(M.mentionLabel(two[4], two), 'Eva de Boer');
  assert.equal(M.mentionLabel({ id: 'x', name: '  ' }, members), 'Vriend');
});
test('insertMention replaces the typed "@query" with "@Label " and puts the caret after it', () => {
  assert.deepEqual(M.insertMention('hoi @Ar', 4, 7, 'Aria'), { text: 'hoi @Aria ', caret: 10 });
  assert.deepEqual(M.insertMention('@ kom je?', 0, 1, 'Noor'), { text: '@Noor kom je?', caret: 6 });
  assert.deepEqual(M.insertMention('@Arxx kom', 0, 3, 'Aria'), { text: '@Aria kom', caret: 6 }, 'rest of the typed word is replaced');
});
test('parseMentions: highlights real members only, longest name first, word boundary', () => {
  assert.deepEqual(M.parseMentions('@Aria kom je?', members), [{ text: '@Aria', userId: ARIA }, { text: ' kom je?' }]);
  assert.deepEqual(M.parseMentions('hé @aria de vries!', members), [{ text: 'hé ' }, { text: '@aria de vries', userId: ARIA }, { text: '!' }]);
  assert.deepEqual(M.parseMentions('@Arianne hoi', members), [{ text: '@Arianne hoi' }], 'no partial-word match');
  assert.deepEqual(M.parseMentions('@Bram hoi', members), [{ text: '@Bram hoi' }], 'non-members stay plain');
  assert.deepEqual(M.parseMentions('mail aria@x.nl', members), [{ text: 'mail aria@x.nl' }]);
  assert.deepEqual(M.parseMentions('@Noor en @Kevin', members).filter(s => s.userId).map(s => s.userId), [NOOR, ME]);
  assert.deepEqual(M.parseMentions('', members), []);
  const two = [...members, { id: EVA2, name: 'Eva de Boer' }];
  assert.deepEqual(M.parseMentions('@Eva hoi', two), [{ text: '@Eva hoi' }], 'ambiguous first name is not guessed');
  assert.deepEqual(M.mentionedIds('@Eva de Boer en @Eva Smit', two), [EVA2, EVA]);
});
test('mentionsUser / hasUnreadMention: only unread text from others counts', () => {
  assert.equal(M.mentionsUser('@Kevin hoi', ME, members), true);
  assert.equal(M.mentionsUser('@Kevinho', ME, members), false);
  const rows = [{ id: '1', sender_id: ARIA, kind: 'text', body: '@Kevin kom je?' }, { id: '2', sender_id: ME, kind: 'text', body: '@Kevin zelf' }];
  assert.equal(M.hasUnreadMention(rows, ME, new Set(), members), true);
  assert.equal(M.hasUnreadMention(rows, ME, new Set(['1']), members), false, 'read → no badge');
  assert.equal(M.hasUnreadMention([rows[1]], ME, new Set(), members), false, 'own message never counts');
  assert.equal(M.MENTION_BADGE, '@ Je bent vermeld');
});
test('latestUnreadMentionId: newest unread @mention of me, ignoring own/read/non-mentions', () => {
  const rows = [
    { id: 'old', sender_id: ARIA, kind: 'text', body: '@Kevin eerst', created_at: '2026-10-22T10:00:00.000Z' },
    { id: 'new', sender_id: NOOR, kind: 'text', body: '@Kevin later', created_at: '2026-10-22T12:00:00.000Z' },
    { id: 'own', sender_id: ME, kind: 'text', body: '@Kevin negeer', created_at: '2026-10-22T13:00:00.000Z' },
    { id: 'plain', sender_id: ARIA, kind: 'text', body: 'geen vermelding', created_at: '2026-10-22T14:00:00.000Z' },
  ];
  assert.equal(M.latestUnreadMentionId(rows, ME, new Set(), members), 'new');
  assert.equal(M.latestUnreadMentionId(rows, ME, new Set(['new']), members), 'old');
  assert.equal(M.latestUnreadMentionId(rows, ME, new Set(['old', 'new']), members), null);
});
test('demo: Weekend crew has an unread @Kevin, chat list marks it; a mentioned friend answers and mentions back', async () => {
  const c = new DemoClient();
  const crew = 'c0000000-0000-4000-8000-000000000002';
  const msgs = c.m.table('sx_messages').filter(x => x.thread_id === crew);
  assert.ok(msgs.some(x => x.sender_id === MOCK_IDS.cleo && String(x.body).startsWith('@Kevin ')));
  assert.ok(msgs.some(x => x.sender_id === MOCK_IDS.owner && String(x.body).startsWith('@Noor ')));
  const profile = id => c.m.profile(id)?.display_name;
  const mem = c.m.table('sx_members').filter(x => x.thread_id === crew).map(x => ({ id: x.user_id, name: profile(x.user_id) }));
  assert.equal(M.hasUnreadMention(msgs, MOCK_IDS.owner, new Set(), mem), true);
  // Kevin mentions Eva → Eva (not a random member) answers with "@Kevin …".
  const eva = MOCK_IDS.eva;
  await c.from('sx_messages').insert({ thread_id: crew, sender_id: MOCK_IDS.owner, kind: 'text', body: '@Eva neem jij de taart mee' });
  await new Promise(r => setTimeout(r, 2100));
  const reply = c.m.table('sx_messages').filter(x => x.thread_id === crew).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  assert.equal(reply.sender_id, eva);
  assert.ok(String(reply.body).startsWith('@Kevin '), String(reply.body));
});
test('wiring: composer picker, bubble highlight and chat-list badge are connected', () => {
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(chat, /<MentionPicker /); assert.match(chat, /onSelectionChange=/); assert.match(chat, /<MentionText /);
  assert.match(chat, /latestUnreadMentionId\(/); assert.match(chat, /jump-mention/); assert.match(chat, /jumpRequestId=/);
  const view = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  assert.match(view, /jumpRequestId/); assert.match(view, /scrollToIndex/);
  const list = readFileSync(new URL('./chat-list.ts', import.meta.url), 'utf8');
  assert.match(list, /hasUnreadMention\(/);
  const tab = readFileSync(new URL('../app/(tabs)/chats.tsx', import.meta.url), 'utf8');
  assert.match(tab, /chat-row-mention/); assert.match(tab, /Je bent vermeld in/);
});
