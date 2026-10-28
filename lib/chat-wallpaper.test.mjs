import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as W from './chat-wallpaper.ts';
import { WALLPAPERS } from './plus.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ARIA = 'c0000000-0000-4000-8000-0000000000a1', EVA = 'c0000000-0000-4000-8000-0000000000a2';

test('parseWallpaper: known ids pass, everything else is the normal background', () => {
  for (const w of WALLPAPERS) assert.equal(W.parseWallpaper(w.id), w.id);
  for (const v of [null, undefined, '', 'galaxy', 42, {}]) assert.equal(W.parseWallpaper(v), 'none');
  assert.equal(W.wallpaperLabel('aurora'), 'Aurora');
  assert.equal(W.wallpaperLabel('xx'), 'Geen');
  assert.deepEqual(W.wallpaperColors('xx'), WALLPAPERS[0].colors);
});

test('Snapchat-style system line: who changed it, to what, or removed it', () => {
  assert.equal(W.wallpaperChangeText('Kevin', 'oceaan'), 'Kevin heeft de chat-achtergrond gewijzigd in Oceaan');
  assert.equal(W.wallpaperChangeText('Kevin', 'none'), 'Kevin heeft de chat-achtergrond verwijderd');
  assert.equal(W.wallpaperChangeText('  ', 'roze'), 'Iemand heeft de chat-achtergrond gewijzigd in Roze');
  assert.ok(W.isWallpaperChangeText(W.wallpaperChangeText('Aria', 'sterren')));
  assert.ok(W.isWallpaperChangeText(W.wallpaperChangeText('Aria', 'none')));
  assert.ok(!W.isWallpaperChangeText('Kevin heeft chats op 24 uur gezet'));
  assert.ok(!W.isWallpaperChangeText(null));
});

test('only X+ can change it; same choice is a silent no-op; unknown ids refused', () => {
  assert.deepEqual(W.wallpaperChange('none', 'aurora', true), { ok: true, id: 'aurora' });
  assert.deepEqual(W.wallpaperChange('aurora', 'none', true), { ok: true, id: 'none' });
  assert.deepEqual(W.wallpaperChange('none', 'aurora', false), { ok: false, error: W.WALLPAPER_ERRORS.needsPlus });
  assert.deepEqual(W.wallpaperChange('aurora', 'aurora', true), { ok: false, error: null });
  assert.deepEqual(W.wallpaperChange('none', 'galaxy', true), { ok: false, error: W.WALLPAPER_ERRORS.invalid });
});

test('server errors map to Dutch copy', () => {
  for (const t of Object.values(W.WALLPAPER_ERRORS)) assert.equal(W.wallpaperErrorText({ message: t }), t);
  assert.equal(W.wallpaperErrorText(new Error('boom')), null);
  assert.equal(W.wallpaperErrorText(null), null);
});

test('demo: Aria\'s chat is seeded with Sterren + her system line (visible to Kevin without X+)', () => {
  const c = new DemoClient();
  assert.equal(c.m.table('sx_threads').find(t => t.id === ARIA).wallpaper, 'sterren');
  assert.equal(c.m.table('sx_threads').find(t => t.id === EVA).wallpaper, 'none');
  assert.ok(c.m.table('sx_messages').some(m => m.thread_id === ARIA && m.kind === 'system' && m.body === W.wallpaperChangeText('Aria', 'sterren')));
});

test('demo sx_set_wallpaper mirrors the migration: member + valid id, system line, no-op on same id', async () => {
  const c = new DemoClient(), msgs = c.m.table('sx_messages'), before = msgs.length;
  const text = W.wallpaperChangeText('Kevin', 'aurora');
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: EVA, p_wallpaper: 'aurora', p_text: text })).error, null);
  assert.equal(c.m.table('sx_threads').find(t => t.id === EVA).wallpaper, 'aurora');
  const added = msgs.slice(before);
  assert.equal(added.length, 1);
  assert.deepEqual([added[0].kind, added[0].sender_id, added[0].body, added[0].expires_at], ['system', MOCK_IDS.owner, text, null]);
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: EVA, p_wallpaper: 'aurora', p_text: text })).error, null);
  assert.equal(msgs.length, before + 1, 'same wallpaper again adds no line');
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: EVA, p_wallpaper: 'galaxy', p_text: 'x' })).error.message, W.WALLPAPER_ERRORS.invalid);
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: 'c0000000-0000-4000-8000-00000000ffff', p_wallpaper: 'roze', p_text: 'x' })).error.message, W.WALLPAPER_ERRORS.notMember);
  const r = await c.from('sx_threads').select('wallpaper').eq('id', EVA).maybeSingle();
  assert.equal(W.parseWallpaper(r.data?.wallpaper), 'aurora');
});

test('migration 20261028150000_chat_wallpaper.sql: same ids + errors, X+ checked server-side, not for anon', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028150000_chat_wallpaper.sql', import.meta.url), 'utf8');
  for (const t of Object.values(W.WALLPAPER_ERRORS)) assert.ok(sql.includes(t), t);
  for (const id of W.WALLPAPER_IDS) assert.ok(sql.includes(`'${id}'`), id);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /sx_has_tier\(auth\.uid\(\), 'plus'\)/);
  assert.match(sql, /revoke all on function public\.sx_set_wallpaper\(uuid, text, text\) from public, anon/);
  assert.match(sql, /NOT APPLIED/);
});

test('UI wiring: chat screen, Groepsinfo and Chatinstellingen expose the wallpaper', () => {
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes("supabase.rpc('sx_set_wallpaper'"));
  assert.ok(chat.includes('<ChatView wallpaper={wallpaper}'));
  assert.ok(chat.includes("select('wallpaper')"), 'separate select so old backends keep loading retention/title');
  assert.ok(readFileSync(new URL('../app/(tabs)/chats.tsx', import.meta.url), 'utf8').includes("sheet:'wallpaper'"));
  assert.ok(readFileSync(new URL('../components/chat/GroupInfoSheet.tsx', import.meta.url), 'utf8').includes('Chat-achtergrond'));
});
