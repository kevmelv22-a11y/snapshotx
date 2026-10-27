import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as P from './chat-polls.ts';
import { quoteOf } from './chat-replies.ts';
import { canEdit } from './chat-edits.ts';
import { chatPreviewText } from './avatar/poses.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const body = (q, o) => { const r = P.pollBody(q, o); assert.ok(r.ok, r.error); return r.body; };

test('pollBody: trims, drops blank answers, validates and round-trips through parsePoll', () => {
  const r = P.pollBody('  Wat   doen we?  ', [' Pizza ', '', 'Bios ']);
  assert.ok(r.ok);
  assert.ok(r.body.startsWith('[poll]'));
  assert.deepEqual(P.parsePoll(r.body), { question: 'Wat doen we?', options: ['Pizza', 'Bios'] });
  assert.equal(P.pollBody(' ', ['a', 'b']).error, P.POLL_ERRORS.noQuestion);
  assert.equal(P.pollBody('Q', ['a', '  ']).error, P.POLL_ERRORS.fewOptions);
  assert.equal(P.pollBody('Q', ['a', 'b', 'c', 'd', 'e', 'f']).error, P.POLL_ERRORS.manyOptions);
  assert.equal(P.pollBody('Q', ['a', 'A']).error, P.POLL_ERRORS.duplicate);
  assert.equal(P.pollBody('x'.repeat(121), ['a', 'b']).error, P.POLL_ERRORS.questionTooLong);
  assert.equal(P.pollBody('Q', ['a', 'b'.repeat(41)]).error, P.POLL_ERRORS.optionTooLong);
  assert.ok(P.pollBody('😀'.repeat(120), ['a', 'b']).ok, 'emoji count as one character');
});

test('parsePoll rejects anything that is not a well-formed poll', () => {
  for (const b of [null, '', 'hoi', '[poll]', '[poll]{', '[poll]{"q":"x","o":["a"]}', '[poll]{"q":"","o":["a","b"]}', '[poll]{"q":"x","o":["a",""]}', '[poll]{"q":"x","o":"ab"}', '[poll]{"q":"x","o":["a","b","c","d","e","f"]}'])
    assert.equal(P.parsePoll(b), null, String(b));
  assert.equal(P.isPollText('[poll]{'), true);
  assert.equal(P.isPollText('hoi [poll]'), false);
});

test('votes: one per person, switch, tap again to take back', () => {
  let v = [];
  assert.equal(P.nextVote(v, 'p', 'me', 1), 1);
  v = P.applyVote(v, 'p', 'me', 1);
  assert.equal(P.nextVote(v, 'p', 'me', 2), 2, 'switch');
  v = P.applyVote(v, 'p', 'me', 2);
  assert.deepEqual(v, [{ messageId: 'p', userId: 'me', option: 2 }]);
  assert.equal(P.nextVote(v, 'p', 'me', 2), null, 'same answer = take back');
  assert.deepEqual(P.applyVote(v, 'p', 'me', null), []);
  assert.deepEqual(P.applyVote([{ messageId: 'q', userId: 'me', option: 0 }], 'p', 'me', 1).length, 2, 'other polls untouched');
});

test('percentages always add up to 100 (largest remainder)', () => {
  assert.deepEqual(P.percentages([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(P.percentages([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(P.percentages([2, 0, 1]), [67, 0, 33]);
  assert.deepEqual(P.percentages([1, 0]), [100, 0]);
  for (const c of [[3, 3, 1], [1, 2, 3, 4, 5], [7, 1, 1]]) assert.equal(P.percentages(c).reduce((a, b) => a + b, 0), 100);
});

test('tallyPoll: counts, my vote, voters, leader; results only after voting or for the asker', () => {
  const poll = { question: 'Q', options: ['a', 'b', 'c'] };
  const votes = [{ messageId: 'p', userId: 'x', option: 0 }, { messageId: 'p', userId: 'y', option: 0 }, { messageId: 'p', userId: 'me', option: 2 }, { messageId: 'p', userId: 'z', option: 9 }, { messageId: 'other', userId: 'w', option: 1 }];
  const r = P.tallyPoll(poll, votes, 'p', 'me');
  assert.equal(r.total, 3, 'invalid answer + other poll ignored');
  assert.equal(r.myVote, 2);
  assert.deepEqual(r.options.map(o => [o.count, o.pct, o.mine, o.leading]), [[2, 67, false, true], [0, 0, false, false], [1, 33, true, false]]);
  assert.deepEqual(r.options[0].voters, ['x', 'y']);
  assert.equal(P.showResults(r, 'x', 'me'), true);
  const fresh = P.tallyPoll(poll, votes, 'p', 'new');
  assert.equal(P.showResults(fresh, 'x', 'new'), false, 'not voted yet → no spoilers');
  assert.equal(P.showResults(fresh, 'new', 'new'), true, 'the asker always sees results');
  assert.equal(P.votesLabel(0), 'Nog geen stemmen'); assert.equal(P.votesLabel(1), '1 stem'); assert.equal(P.votesLabel(4), '4 stemmen');
});

test('polls in previews, quotes and Bewerken', () => {
  const b = body('Hoe laat?', ['14:00', '15:00']);
  assert.equal(chatPreviewText(b), '📊 Peiling: Hoe laat?');
  assert.deepEqual(quoteOf({ id: 'p', sender_id: 'me', kind: 'text', body: b }), { kind: 'text', excerpt: '📊 Peiling: Hoe laat?' });
  assert.equal(canEdit({ id: 'p', sender_id: 'me', kind: 'text', body: b, created_at: new Date().toISOString() }, 'me', Date.now()), false, 'polls are not editable');
  assert.equal(P.validateVote(null, 0), P.POLL_ERRORS.notPoll);
  assert.equal(P.validateVote({ question: 'Q', options: ['a', 'b'] }, 2), P.POLL_ERRORS.badOption);
  assert.equal(P.validateVote({ question: 'Q', options: ['a', 'b'] }, null), null);
});

test('demo client mirrors sx_vote_poll: seeded crew poll, vote/switch/take back, errors, unsend clears votes', async () => {
  const c = new DemoClient(), ME = MOCK_IDS.owner, msgs = c.m.table('sx_messages');
  const seeded = msgs.find(m => P.parsePoll(m.body));
  assert.ok(seeded, 'Weekend crew has a poll');
  assert.equal(P.parsePoll(seeded.body).question, 'Wat doen we zaterdag na het strand? 🌅');
  const votesOf = () => c.m.table('sx_poll_votes').filter(v => v.message_id === seeded.id);
  assert.equal(votesOf().length, 3); assert.ok(!votesOf().some(v => v.user_id === ME), 'Kevin has not voted yet');
  assert.equal((await c.rpc('sx_vote_poll', { p_message_id: seeded.id, p_option: 1 })).data, 1);
  assert.equal((await c.rpc('sx_vote_poll', { p_message_id: seeded.id, p_option: 0 })).data, 0);
  assert.deepEqual(votesOf().filter(v => v.user_id === ME).map(v => v.option_index), [0], 'switched, still one vote');
  assert.equal((await c.rpc('sx_vote_poll', { p_message_id: seeded.id, p_option: 3 })).error.message, P.POLL_ERRORS.badOption);
  assert.equal((await c.rpc('sx_vote_poll', { p_message_id: seeded.id, p_option: null })).error, null);
  assert.equal(votesOf().length, 3, 'taken back');
  const plain = msgs.find(m => m.thread_id === seeded.thread_id && m.kind === 'text' && !P.parsePoll(m.body));
  assert.equal((await c.rpc('sx_vote_poll', { p_message_id: plain.id, p_option: 0 })).error.message, P.POLL_ERRORS.notPoll);
  const q = await c.from('sx_poll_votes').select('message_id,user_id,option_index').in('message_id', [seeded.id]);
  assert.equal(q.data.length, 3);
  // Polls cannot be edited; Kevin's own poll can be unsent and then loses its votes.
  const own = { id: 'pp000000-0000-4000-8000-000000000001', thread_id: seeded.thread_id, sender_id: ME, kind: 'text', body: body('Q?', ['a', 'b']), created_at: new Date().toISOString(), expires_at: null };
  msgs.push(own);
  assert.equal((await c.rpc('sx_edit_message', { p_message_id: own.id, p_text: 'x' })).error?.message, 'Alleen tekstberichten kun je bewerken');
  await c.rpc('sx_vote_poll', { p_message_id: own.id, p_option: 1 });
  assert.equal(c.m.table('sx_poll_votes').filter(v => v.message_id === own.id).length, 1);
  assert.equal((await c.rpc('sx_unsend_message', { p_message_id: own.id })).data, true);
  assert.equal(c.m.table('sx_poll_votes').filter(v => v.message_id === own.id).length, 0);
  assert.equal((await c.rpc('sx_vote_poll', { p_message_id: own.id, p_option: 0 })).error.message, P.POLL_ERRORS.notPoll);
});

test('migration file: votes only via sx_vote_poll, members read, same Dutch errors, not applied', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261027150000_chat_polls.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /revoke all on public\.sx_poll_votes from public, anon, authenticated;\s*grant select on public\.sx_poll_votes to authenticated;/);
  assert.match(sql, /create or replace function public\.sx_vote_poll\(p_message_id uuid, p_option integer\)/);
  for (const e of [P.POLL_ERRORS.notPoll, P.POLL_ERRORS.notMember, P.POLL_ERRORS.badOption]) assert.ok(sql.includes(e.replace(/'/g, "''")), e);
  assert.match(sql, /check \(option_index between 0 and 4\)/);
  assert.equal(P.POLL_MAX_OPTIONS, 5);
});
