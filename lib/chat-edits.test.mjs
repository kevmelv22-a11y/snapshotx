import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as E from './chat-edits.ts';
import { parseReply, quoteOf, replyBody } from './chat-replies.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ME = 'me', EVA = 'eva', NOW = Date.parse('2026-10-27T09:00:00Z');
const at = ms => new Date(NOW - ms).toISOString();
const msg = (o = {}) => ({ id: 'm1', sender_id: ME, kind: 'text', body: 'Hoi', created_at: at(60e3), ...o });

test('Bewerken: only own text messages, within 5 minutes, not stickers or unsent rows', () => {
  assert.equal(E.canEdit(msg(), ME, NOW), true);
  assert.equal(E.canEdit(msg({ created_at: at(4 * 60e3 + 59e3) }), ME, NOW), true);
  assert.equal(E.canEdit(msg({ created_at: at(5 * 60e3) }), ME, NOW), false, 'exactly 5 min is too late');
  assert.equal(E.canEdit(msg({ sender_id: EVA }), ME, NOW), false);
  for (const k of ['photo', 'video', 'voice', 'snap', 'system']) assert.equal(E.canEdit(msg({ kind: k }), ME, NOW), false, k);
  assert.equal(E.canEdit(msg({ body: '[avatar-sticker:wave]' }), ME, NOW), false);
  assert.equal(E.canEdit(msg({ unsent_at: at(0) }), ME, NOW), false);
  assert.equal(E.canEdit(msg({ created_at: 'nope' }), ME, NOW), false);
  assert.equal(E.EDIT_WINDOW_MS, 300000);
});
test('Verwijderen: own messages of every kind except system lines', () => {
  for (const k of ['text', 'photo', 'video', 'voice', 'snap']) assert.equal(E.canUnsend(msg({ kind: k }), ME), true, k);
  assert.equal(E.canUnsend(msg({ kind: 'system' }), ME), false);
  assert.equal(E.canUnsend(msg({ sender_id: EVA }), ME), false);
  assert.equal(E.canUnsend(msg({ unsent_at: at(0) }), ME), false);
});
test('validateEdit trims and enforces 1..2000 chars (by code points)', () => {
  assert.deepEqual(E.validateEdit('  nieuw  '), { ok: true, text: 'nieuw' });
  assert.deepEqual(E.validateEdit('   '), { ok: false, error: E.EDIT_ERRORS.empty });
  assert.equal(E.validateEdit('😀'.repeat(2000)).ok, true);
  assert.deepEqual(E.validateEdit('a'.repeat(2001)), { ok: false, error: E.EDIT_ERRORS.tooLong });
});
test('editedBody keeps a quoted-reply prefix and only swaps the visible text', () => {
  const orig = { id: 'q1', sender_id: EVA, kind: 'text', body: 'Hoe laat?' };
  const body = replyBody(orig, 'Om 8 uur');
  const next = E.editedBody(body, '  Om half 9 ');
  const r = parseReply(next);
  assert.equal(r.text, 'Om half 9'); assert.equal(r.ref.id, 'q1'); assert.equal(r.ref.excerpt, 'Hoe laat?');
  assert.equal(E.editedBody('oud', 'nieuw'), 'nieuw');
  assert.equal(E.editableText({ body }), 'Om 8 uur');
  assert.equal(E.isNoopEdit({ body }, ' Om 8 uur '), true);
  assert.equal(E.isNoopEdit({ body }, 'Om 9 uur'), false);
});
test('labels: "Bewerkt" for edited, Snapchat line for unsent, "Verwijderd bericht" in quotes', () => {
  assert.equal(E.editedLabel({ edited_at: at(0) }), 'Bewerkt');
  assert.equal(E.editedLabel({ edited_at: null }), null);
  assert.equal(E.editedLabel({ edited_at: at(0), unsent_at: at(0) }), null);
  assert.equal(E.unsentText('Eva Smit'), 'Eva heeft een chat verwijderd');
  assert.equal(E.unsentText('  '), 'Iemand heeft een chat verwijderd');
  assert.equal(E.isUnsentLine({ kind: 'system', unsent_at: at(0) }), true);
  assert.equal(E.isUnsentLine({ kind: 'system', unsent_at: null }), false);
  const q = m => quoteOf(m).excerpt;
  assert.equal(E.liveQuoteExcerpt('oud', undefined, q), 'oud', 'original no longer loaded → snapshot');
  assert.equal(E.liveQuoteExcerpt('oud', msg({ body: 'oud' }), q), 'oud');
  assert.equal(E.liveQuoteExcerpt('oud', msg({ body: 'nieuw', edited_at: at(0) }), q), 'nieuw');
  assert.equal(E.liveQuoteExcerpt('geheim', msg({ kind: 'system', body: 'Kevin heeft een chat verwijderd', unsent_at: at(0) }), q), 'Verwijderd bericht');
});
test('applyEdit / applyUnsend are immutable optimistic updates', () => {
  const rows = [msg(), msg({ id: 'm2', kind: 'photo', body: null, media_path: 'x.jpg', saved: true, saved_by: EVA })];
  const ed = E.applyEdit(rows, 'm1', 'Nieuw', at(0));
  assert.notEqual(ed, rows); assert.equal(rows[0].body, 'Hoi');
  assert.deepEqual([ed[0].body, ed[0].edited_at], ['Nieuw', at(0)]);
  const un = E.applyUnsend(rows, 'm2', 'Kevin', at(0));
  assert.deepEqual([un[1].kind, un[1].body, un[1].media_path, un[1].saved, un[1].unsent_at], ['system', 'Kevin heeft een chat verwijderd', null, false, at(0)]);
  assert.equal(rows[1].media_path, 'x.jpg');
});
test('demo client: seeded Bewerkt + unsent line, edit/unsend RPCs with the same rules + Dutch errors', async () => {
  const c = new DemoClient(), I = MOCK_IDS, rows = c.m.table('sx_messages');
  const CREW = 'c0000000-0000-4000-8000-000000000002', ARIA = 'c0000000-0000-4000-8000-0000000000a1';
  const ariaEdited = rows.find(m => m.thread_id === CREW && m.edited_at);
  assert.equal(ariaEdited.body, 'Ik kom iets later, rond 15:30');
  assert.ok(rows.some(m => m.thread_id === CREW && m.kind === 'system' && m.unsent_at && m.body === 'Eva heeft een chat verwijderd'));
  const events = []; c.emit = ((orig) => function (t, e, r) { events.push(`${t}:${e}`); return orig.call(this, t, e, r); })(c.emit);
  const fresh = { id: 'f1', thread_id: ARIA, sender_id: I.owner, kind: 'text', body: 'Om 8 uur?', media_path: null, view_once: false, created_at: new Date(Date.now() - 60e3).toISOString(), expires_at: null };
  rows.push(fresh);
  let r = await c.rpc('sx_edit_message', { p_message_id: 'f1', p_text: '  Om half 9? ' });
  assert.deepEqual([r.error, r.data, fresh.body], [null, true, 'Om half 9?']); assert.ok(fresh.edited_at); assert.ok(events.includes('sx_messages:UPDATE'));
  r = await c.rpc('sx_edit_message', { p_message_id: 'f1', p_text: 'Om half 9?' }); assert.equal(r.data, false, 'no-op edit');
  assert.equal((await c.rpc('sx_edit_message', { p_message_id: 'f1', p_text: '  ' })).error.message, E.EDIT_ERRORS.empty);
  const old = rows.find(m => m.thread_id === ARIA && m.sender_id === I.owner && m.kind === 'text');
  assert.equal((await c.rpc('sx_edit_message', { p_message_id: old.id, p_text: 'x' })).error.message, E.EDIT_ERRORS.tooLate);
  const theirs = rows.find(m => m.thread_id === ARIA && m.sender_id === I.aria && m.kind === 'text');
  assert.equal((await c.rpc('sx_edit_message', { p_message_id: theirs.id, p_text: 'x' })).error.message, E.EDIT_ERRORS.notYours);
  assert.equal((await c.rpc('sx_unsend_message', { p_message_id: theirs.id })).error.message, E.EDIT_ERRORS.notYours);
  const snap = rows.find(m => m.thread_id === ARIA && m.sender_id === I.owner && m.kind === 'snap');
  r = await c.rpc('sx_unsend_message', { p_message_id: snap.id });
  assert.deepEqual([r.error, snap.kind, snap.body, snap.media_path, !!snap.unsent_at], [null, 'system', 'Kevin heeft een chat verwijderd', null, true]);
  assert.equal((await c.rpc('sx_unsend_message', { p_message_id: snap.id })).error.message, E.EDIT_ERRORS.notFound);
  assert.equal((await c.rpc('sx_edit_message', { p_message_id: snap.id, p_text: 'x' })).error.message, E.EDIT_ERRORS.notFound);
  const saved = rows.find(m => m.thread_id === ARIA && m.saved && m.sender_id === I.owner);
  r = await c.rpc('sx_unsend_message', { p_message_id: saved.id });
  assert.deepEqual([r.error, saved.saved, saved.saved_by], [null, false, null], 'saved messages can be unsent too and lose their save');
});
test('migration (not applied) mirrors the rules and Dutch errors', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261027090000_chat_edit_unsend.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  for (const e of Object.values(E.EDIT_ERRORS)) assert.ok(sql.includes(e), e);
  assert.match(sql, /interval '5 minutes'/);
  assert.match(sql, /heeft een chat verwijderd/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.sx_edit_message\(uuid, text\) from public, anon/);
  assert.match(sql, /grant execute on function public\.sx_unsend_message\(uuid\) to authenticated/);
  assert.match(sql, /delete from public\.sx_reactions where message_id = m\.id/);
});
