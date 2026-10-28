import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as W from './chat-wallpaper.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ME = MOCK_IDS.owner, EVA = 'c0000000-0000-4000-8000-0000000000a2';
const EVA_PHOTO = `${EVA}/0b9a6c1e-2d3f-4a5b-8c7d-9e0f1a2b3c4d.jpg`;

test('wallpaperUploader / photoHiddenByBlock: photo of someone I blocked is hidden, others and presets are not', () => {
  assert.equal(W.wallpaperUploader(EVA_PHOTO), EVA);
  assert.equal(W.wallpaperUploader('demo/x.svg'), null);
  assert.equal(W.wallpaperUploader(null), null);
  assert.equal(W.photoHiddenByBlock({ path: EVA_PHOTO, blur: false }, [EVA]), true);
  assert.equal(W.photoHiddenByBlock({ path: EVA_PHOTO, blur: true }, [EVA.toUpperCase()]), true, 'case-insensitive');
  assert.equal(W.photoHiddenByBlock({ path: EVA_PHOTO, blur: false }, ['c0000000-0000-4000-8000-0000000000a1']), false);
  assert.equal(W.photoHiddenByBlock(null, [EVA]), false);
  assert.equal(W.photoHiddenByBlock({ path: EVA_PHOTO, blur: false }, new Set()), false);
});

test('wallpaperBlockedError: no changes in a chat with a blocked member (like sending a message); blocking myself never counts', () => {
  assert.equal(W.wallpaperBlockedError([ME, EVA], ME, [EVA]), W.WALLPAPER_ERRORS.blocked);
  assert.equal(W.wallpaperBlockedError([ME, EVA], ME, []), null);
  assert.equal(W.wallpaperBlockedError([ME], ME, [ME]), null);
  assert.equal(W.WALLPAPER_ERRORS.blocked, 'Je kunt de achtergrond van deze chat niet wijzigen.');
  assert.equal(W.wallpaperErrorText({ message: 'Interaction blocked' }), W.WALLPAPER_ERRORS.blocked);
  assert.equal(W.wallpaperErrorText({ message: W.WALLPAPER_ERRORS.blocked }), W.WALLPAPER_ERRORS.blocked);
});

test('demo mirror: after blocking, wallpaper RPCs refuse and the blocked uploader\'s photo is unreadable', async () => {
  const c = new DemoClient(), THREAD = EVA; // Eva's 1:1 chat (thread id) with Kevin
  const PEER = c.memberIds(THREAD).find(u => u !== ME), PEER_PHOTO = `${PEER}/0b9a6c1e-2d3f-4a5b-8c7d-9e0f1a2b3c4d.jpg`;
  const t = c.m.table('sx_threads').find(x => x.id === THREAD);
  assert.ok(t && PEER, 'Eva chat seeded');
  Object.assign(t, { wallpaper: 'photo', wallpaper_path: PEER_PHOTO, wallpaper_blur: false });
  const st = c.storage.from('snapshotx-media');
  assert.ok((await st.createSignedUrl(PEER_PHOTO)).data?.signedUrl, 'readable before blocking');
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: THREAD, p_wallpaper: 'aurora', p_text: 'x' })).error, null);
  Object.assign(t, { wallpaper: 'photo', wallpaper_path: PEER_PHOTO, wallpaper_blur: false });
  c.m.table('sx_blocks').push({ blocker_id: ME, blocked_id: PEER });
  assert.equal((await st.createSignedUrl(PEER_PHOTO)).data, null, 'hidden after blocking');
  const r = await c.rpc('sx_set_wallpaper', { p_thread_id: THREAD, p_wallpaper: 'oceaan', p_text: 'x' });
  assert.equal(W.wallpaperErrorText(r.error), W.WALLPAPER_ERRORS.blocked);
  assert.equal(t.wallpaper, 'photo', 'unchanged');
  const p = await c.rpc('sx_set_wallpaper_photo', { p_thread_id: THREAD, p_path: `${ME}/0b9a6c1e-2d3f-4a5b-8c7d-9e0f1a2b3c4e.jpg`, p_blur: false, p_text: 'x' });
  assert.equal(W.wallpaperErrorText(p.error), W.WALLPAPER_ERRORS.blocked);
  // Blocked the other way round (Eva blocked me) counts too.
  c.m.table('sx_blocks').splice(0, Infinity, { blocker_id: PEER, blocked_id: ME });
  assert.equal(W.wallpaperErrorText((await c.rpc('sx_set_wallpaper', { p_thread_id: THREAD, p_wallpaper: 'roze', p_text: 'x' })).error), W.WALLPAPER_ERRORS.blocked);
  // Unblocked: changes work again.
  c.m.table('sx_blocks').splice(0, Infinity);
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: THREAD, p_wallpaper: 'roze', p_text: 'x' })).error, null);
});

test('UI wiring: chat screen loads my blocks, hides a blocked uploader\'s photo and refuses changes', () => {
  const src = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /from\('sx_blocks'\)\.select\('blocked_id'\)\.eq\('blocker_id',uid\)/);
  assert.match(src, /photoHiddenByBlock\(wpPhoto,myBlocks\)/);
  assert.match(src, /<ChatView wallpaper=\{photoHidden\?'none':wallpaper\}/);
  for (const fn of ['changeWallpaper', 'pickWallpaperPhoto', 'setWallpaperBlur']) assert.match(src, new RegExp(`async function ${fn}\\([^)]*\\)\\{if\\(wallpaperBusy[^)]*wallpaperBlocked\\(\\)\\)return;`), fn);
  assert.match(src, /await load\(\);await loadBlocks\(\);/, 'refresh after blocking from the chat');
});
