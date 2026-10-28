import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as S from './chat-saves.ts';
import * as F from './chat-features.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ME = 'me', EVA = 'eva', ARIA = 'aria';
const msg = (o = {}) => ({ id: 'm1', sender_id: EVA, kind: 'text', saved: false, saved_by: null, ...o });

test('only text, photo, video and voice can be saved (no snaps, no system lines)', () => {
  for (const k of ['text', 'photo', 'video', 'voice']) assert.equal(S.canSave({ kind: k }), true, k);
  for (const k of ['snap', 'system', '']) assert.equal(S.canSave({ kind: k }), false, k);
  assert.equal(S.saveAction(msg({ kind: 'snap' }), ME), null);
  assert.equal(S.saveAction(msg({ kind: 'system' }), ME), null);
});
test('menu: save when unsaved; unsave only for the saver, the sender, or legacy rows without saver', () => {
  assert.equal(S.saveAction(msg(), ME), 'save');
  assert.equal(S.saveAction(msg({ saved: true, saved_by: ME }), ME), 'unsave');
  assert.equal(S.saveAction(msg({ saved: true, saved_by: ARIA }), ME), null, 'someone else saved a friend’s message');
  assert.equal(S.saveAction(msg({ sender_id: ME, saved: true, saved_by: ARIA }), ME), 'unsave', 'sender may unsave own message');
  assert.equal(S.saveAction(msg({ saved: true, saved_by: null }), ME), 'unsave');
  assert.equal(S.SAVE_LABEL.save, 'Opslaan in chat');
  assert.equal(S.SAVE_LABEL.unsave, 'Niet meer opslaan');
});
test('label: "Opgeslagen" for me, "Opgeslagen door <voornaam>" for others', () => {
  const names = id => ({ eva: 'Eva Smit', aria: '  Aria de Vries ' })[id] ?? null;
  assert.equal(S.savedLabel(msg(), ME, names), null);
  assert.equal(S.savedLabel(msg({ saved: true, saved_by: ME }), ME, names), 'Opgeslagen');
  assert.equal(S.savedLabel(msg({ saved: true, saved_by: ARIA }), ME, names), 'Opgeslagen door Aria');
  assert.equal(S.savedLabel(msg({ saved: true, saved_by: 'x' }), ME, names), 'Opgeslagen door een vriend');
});
test('applySaved is immutable and sets/clears the saver', () => {
  const rows = [msg(), msg({ id: 'm2' })];
  const on = S.applySaved(rows, 'm2', true, ME);
  assert.notEqual(on, rows); assert.equal(rows[1].saved, false);
  assert.deepEqual([on[1].saved, on[1].saved_by, on[0].saved], [true, ME, false]);
  const off = S.applySaved(on, 'm2', false, ME);
  assert.deepEqual([off[1].saved, off[1].saved_by], [false, null]);
  assert.equal(S.savedCount(on), 1);
  assert.equal(S.savedCount([msg({ kind: 'snap', saved: true })]), 0);
});
test('saved messages survive "Na bekijken" and "24 uur"; unsaving brings retention back', () => {
  const viewed = 1_000, later = viewed + 2 * 86400000;
  assert.equal(F.isMessageVisible('after_view', viewed, later, { saved: true, leftAt: viewed + 1 }), true);
  assert.equal(F.isMessageVisible('24h', viewed, later, { saved: true }), true);
  assert.equal(F.isMessageVisible('after_view', viewed, later, { saved: false, leftAt: viewed + 1 }), false);
  assert.equal(S.unsaveExpiry('keep', 0), null);
  assert.equal(S.unsaveExpiry('24h', 0), new Date(86400000).toISOString());
  assert.equal(S.unsaveExpiry('after_view', 0), new Date(86400000).toISOString());
});

const T_EVA = 'c0000000-0000-4000-8000-0000000000a2', T_ARIA = 'c0000000-0000-4000-8000-0000000000a1';
test('demo client: seeded saves, save/unsave round-trip with UPDATE event, server-side rules', async () => {
  const c = new DemoClient(), I = MOCK_IDS;
  const rows = c.m.table('sx_messages');
  const evaQ = rows.find(m => m.thread_id === T_EVA && String(m.body).startsWith('Heb je de foto'));
  const ariaSaved = rows.find(m => m.thread_id === T_ARIA && m.saved);
  assert.deepEqual([evaQ.saved, evaQ.saved_by], [true, I.owner]);
  assert.equal(ariaSaved.saved_by, I.aria); assert.equal(ariaSaved.sender_id, I.owner);
  const events = []; c.emit = ((orig) => function (t, e, r) { events.push(`${t}:${e}`); return orig.call(this, t, e, r); })(c.emit);
  const other = rows.find(m => m.thread_id === T_EVA && m.body === 'Haha oké 😄');
  let r = await c.rpc('sx_set_message_saved', { p_message_id: other.id, p_saved: true });
  assert.deepEqual([r.error, r.data, other.saved, other.saved_by, other.expires_at], [null, true, true, I.owner, null]);
  assert.ok(events.includes('sx_messages:UPDATE'));
  r = await c.rpc('sx_set_message_saved', { p_message_id: other.id, p_saved: false });
  assert.deepEqual([r.error, r.data, other.saved, other.saved_by], [null, false, false, null]);
  // Eva's thread keeps chats ("Bewaren") → unsaving does not start an expiry.
  assert.equal(other.expires_at, null);
  // Kevin is the sender of the message Aria saved → he may unsave it.
  assert.equal((await c.rpc('sx_set_message_saved', { p_message_id: ariaSaved.id, p_saved: false })).error, null);
  // Somebody else's save on somebody else's message: refused with the Dutch error.
  const crewMsg = rows.find(m => m.body === 'Wie neemt de bal mee?');
  Object.assign(crewMsg, { saved: true, saved_by: I.aria });
  assert.equal((await c.rpc('sx_set_message_saved', { p_message_id: crewMsg.id, p_saved: false })).error.message, S.SAVE_ERRORS.notYours);
  const snap = rows.find(m => m.thread_id === T_ARIA && m.kind === 'snap');
  assert.equal((await c.rpc('sx_set_message_saved', { p_message_id: snap.id, p_saved: true })).error.message, S.SAVE_ERRORS.notSaveable);
  assert.equal((await c.rpc('sx_set_message_saved', { p_message_id: 'nope', p_saved: true })).error.message, S.SAVE_ERRORS.notFound);
  // Snapchat: unsave re-applies the setting the message was SENT with (lib/chat-retention.ts, migration 20261028030000).
  // evaQ was sent while the chat was on Bewaren → still kept after the chat switched to "Na bekijken".
  c.m.table('sx_threads').find(t => t.id === T_EVA).retention_mode = 'after_view';
  await c.rpc('sx_set_message_saved', { p_message_id: evaQ.id, p_saved: false });
  assert.equal(evaQ.expires_at, null);
  // A message sent under a timer → expiry 24 h from now (mirrors the migration).
  await c.rpc('sx_set_message_saved', { p_message_id: evaQ.id, p_saved: true }); evaQ.retention_mode = 'after_view';
  await c.rpc('sx_set_message_saved', { p_message_id: evaQ.id, p_saved: false });
  assert.ok(Date.parse(evaQ.expires_at) > Date.now() + 23 * 3600e3);
});
test('migration mirrors the client rules and is marked as not applied', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261022150000_chat_saves.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /kind not in \('text', 'photo', 'video', 'voice'\)/);
  for (const e of Object.values(S.SAVE_ERRORS)) assert.ok(sql.includes(e), e);
  assert.match(sql, /grant execute on function public\.sx_set_message_saved\(uuid, boolean\) to authenticated/);
  assert.match(sql, /revoke all on function public\.sx_set_message_saved\(uuid, boolean\) from public, anon/);
});
test('chat screen wires the menu entry, the RPC and UPDATE realtime; bubbles show the saved label', () => {
  const screen = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(screen, /sx_set_message_saved/);
  assert.match(screen, /event:'UPDATE',schema:'public',table:'sx_messages'/);
  assert.match(screen, /SAVE_LABEL\[save\]/);
  const view = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  assert.match(view, /testID="msg-saved"/);
});

test('friendship profile previews: newest saved first, max 3, who + excerpt, snaps skipped', async () => {
  const { quoteOf } = await import('./chat-replies.ts');
  const rows = [
    { id: 'a', sender_id: ME, kind: 'text', body: 'Nieuwste', saved: true },
    { id: 'b', sender_id: EVA, kind: 'snap', body: 'photo', saved: true },
    { id: 'c', sender_id: EVA, kind: 'photo', body: null, saved: true },
    { id: 'd', sender_id: EVA, kind: 'text', body: 'niet opgeslagen', saved: false },
    { id: 'e', sender_id: EVA, kind: 'text', body: '[avatar-sticker:hoi]', saved: true },
    { id: 'f', sender_id: EVA, kind: 'text', body: 'Oudste', saved: true },
  ];
  const out = S.savedPreviews(rows, ME, 'Eva', 3, m => quoteOf(m).excerpt);
  assert.deepEqual(out, [
    { id: 'a', who: 'Ik', excerpt: 'Nieuwste' }, { id: 'c', who: 'Eva', excerpt: '📷 Foto' }, { id: 'e', who: 'Eva', excerpt: '☺ Avatarsticker: Hoi!' },
  ]);
  assert.equal(S.savedCount(rows), 4);
  assert.equal(S.savedSectionTitle(1), '1 opgeslagen bericht');
  assert.equal(S.savedSectionTitle(4), '4 opgeslagen berichten');
  const profile = readFileSync(new URL('../app/friend/[id].tsx', import.meta.url), 'utf8');
  assert.match(profile, /Opgeslagen in chat/);
  assert.match(profile, /\.eq\('saved',true\)/);
});
