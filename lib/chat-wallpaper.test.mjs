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

test('everyone can change it (no X+); same choice is a silent no-op; unknown ids refused', () => {
  assert.deepEqual(W.wallpaperChange('none', 'aurora'), { ok: true, id: 'aurora' });
  assert.deepEqual(W.wallpaperChange('aurora', 'none'), { ok: true, id: 'none' });
  assert.equal(W.wallpaperChange.length, 2, 'no plus flag');
  assert.ok(!('needsPlus' in W.WALLPAPER_ERRORS));
  assert.ok(!('locked' in W.WALLPAPER_COPY));
  assert.deepEqual(W.wallpaperChange('aurora', 'aurora'), { ok: false, error: null });
  assert.deepEqual(W.wallpaperChange('none', 'galaxy'), { ok: false, error: W.WALLPAPER_ERRORS.invalid });
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

test('migration 20261028150000_chat_wallpaper.sql: same ids + errors, members only (no X+ check), not for anon', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028150000_chat_wallpaper.sql', import.meta.url), 'utf8');
  for (const t of [W.WALLPAPER_ERRORS.notMember, W.WALLPAPER_ERRORS.invalid]) assert.ok(sql.includes(t), t);
  for (const id of W.WALLPAPER_IDS) assert.ok(sql.includes(`'${id}'`), id);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /sx_is_member\(p_thread_id\)/);
  assert.doesNotMatch(sql, /sx_has_tier|Snapshot X\+-leden/);
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

// --- Photo wallpaper (Snapchat+: Camera Roll photo, optional blur) — migration 20261028180000 ---
const ME = MOCK_IDS.owner, P1 = `${MOCK_IDS.owner}/11111111-2222-4333-8444-555555555555.jpg`, P2 = `${MOCK_IDS.owner}/66666666-7777-4888-8999-aaaaaaaaaaaa.jpg`;

test('parseChatWallpaper: photo needs a valid path, blur only when true; presets unchanged', () => {
  assert.deepEqual(W.parseChatWallpaper({ wallpaper: 'photo', wallpaper_path: P1, wallpaper_blur: true }), { id: 'photo', photo: { path: P1, blur: true } });
  assert.deepEqual(W.parseChatWallpaper({ wallpaper: 'photo', wallpaper_path: P1, wallpaper_blur: 'yes' }), { id: 'photo', photo: { path: P1, blur: false } });
  for (const bad of [null, '', '../x.jpg', 'abc/def.jpg', `${ME}/x.png`]) assert.deepEqual(W.parseChatWallpaper({ wallpaper: 'photo', wallpaper_path: bad }), { id: 'none', photo: null });
  assert.deepEqual(W.parseChatWallpaper({ wallpaper: 'aurora', wallpaper_path: P1 }), { id: 'aurora', photo: null });
  assert.deepEqual(W.parseChatWallpaper({ wallpaper: 'sterren' }), { id: 'sterren', photo: null }, 'old backend without the photo columns');
  assert.deepEqual(W.parseChatWallpaper(null), { id: 'none', photo: null });
  assert.equal(W.wallpaperLabel('photo'), 'Eigen foto');
});

test('photoWallpaperChange: anyone (no X+), own upload only, new photo posts a line, blur-only change is silent, same = no-op', () => {
  const none = { id: 'none', photo: null }, cur = { id: 'photo', photo: { path: P1, blur: false } };
  assert.deepEqual(W.photoWallpaperChange(none, { path: P1, blur: false }, 'c0000000-0000-4000-8000-0000000000a1', 'Kevin'), { ok: false, error: W.WALLPAPER_ERRORS.badPhoto }, 'someone else\'s folder');
  assert.deepEqual(W.photoWallpaperChange(none, { path: 'x.jpg', blur: false }, ME, 'Kevin'), { ok: false, error: W.WALLPAPER_ERRORS.badPhoto });
  assert.deepEqual(W.photoWallpaperChange(none, { path: P1, blur: true }, ME, 'Kevin'), { ok: true, photo: { path: P1, blur: true }, line: 'Kevin heeft een foto als chat-achtergrond ingesteld' });
  assert.deepEqual(W.photoWallpaperChange(cur, { path: P1, blur: true }, ME, 'Kevin'), { ok: true, photo: { path: P1, blur: true }, line: null });
  assert.deepEqual(W.photoWallpaperChange(cur, { path: P1, blur: false }, ME, 'Kevin'), { ok: false, error: null });
  assert.equal(W.photoWallpaperChange(cur, { path: P2, blur: false }, ME, ' ').line, 'Iemand heeft een foto als chat-achtergrond ingesteld');
  assert.ok(W.isWallpaperChangeText(W.photoWallpaperText('Kevin')));
  assert.equal(W.wallpaperChange('photo', 'none').ok, true, 'a photo can be removed / replaced by a preset');
  assert.equal(W.wallpaperErrorText({ message: W.WALLPAPER_ERRORS.badPhoto }), W.WALLPAPER_ERRORS.badPhoto);
});

test('demo sx_set_wallpaper_photo mirrors the migration; members can read the photo; presets clear it', async () => {
  const c = new DemoClient(), msgs = c.m.table('sx_messages'), thread = () => c.m.table('sx_threads').find(t => t.id === EVA);
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: EVA, p_path: P1, p_blur: false, p_text: 'x' })).error.message, W.WALLPAPER_ERRORS.badPhoto, 'not uploaded');
  await c.storage.from('snapshotx-media').upload(P1, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' });
  const before = msgs.length, line = W.photoWallpaperText('Kevin');
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: EVA, p_path: P1, p_blur: false, p_text: line })).error, null);
  assert.deepEqual([thread().wallpaper, thread().wallpaper_path, thread().wallpaper_blur], ['photo', P1, false]);
  assert.equal(msgs.length, before + 1); assert.equal(msgs.at(-1).body, line);
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: EVA, p_path: P1, p_blur: true, p_text: null })).error, null);
  assert.equal(thread().wallpaper_blur, true); assert.equal(msgs.length, before + 1, 'blur toggle adds no line');
  const r = await c.from('sx_threads').select('wallpaper,wallpaper_path,wallpaper_blur').eq('id', EVA).maybeSingle();
  assert.deepEqual(W.parseChatWallpaper(r.data), { id: 'photo', photo: { path: P1, blur: true } });
  assert.ok((await c.storage.from('snapshotx-media').createSignedUrl(P1)).data?.signedUrl);
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: 'c0000000-0000-4000-8000-00000000ffff', p_path: P1, p_blur: false, p_text: 'x' })).error.message, W.WALLPAPER_ERRORS.notMember);
  assert.equal((await c.rpc('sx_set_wallpaper', { p_thread_id: EVA, p_wallpaper: 'oceaan', p_text: 'y' })).error, null);
  assert.deepEqual([thread().wallpaper, thread().wallpaper_path, thread().wallpaper_blur], ['oceaan', null, false]);
});

test('migration 20261028180000_chat_wallpaper_photo.sql: own folder + object exists, no X+ check, members can read, NOT APPLIED', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028180000_chat_wallpaper_photo.sql', import.meta.url), 'utf8');
  for (const t of Object.values(W.WALLPAPER_ERRORS)) assert.ok(sql.includes(t), t);
  assert.match(sql, /NOT APPLIED/); assert.match(sql, /20261028150000_chat_wallpaper\.sql/);
  assert.match(sql, /add column if not exists wallpaper_path text/);
  assert.match(sql, /split_part\(p_path, '\/', 1\) <> auth\.uid\(\)::text/);
  assert.match(sql, /from storage\.objects o where o\.bucket_id = 'snapshotx-media' and o\.name = p_path/);
  assert.doesNotMatch(sql, /sx_has_tier|Snapshot X\+-leden/);
  assert.match(sql, /wallpaper_path = null, wallpaper_blur = false/, 'presets clear the photo');
  assert.match(sql, /t\.wallpaper='photo' and t\.wallpaper_path=name\s+and app_private\.sx_is_member\(t\.id\)/);
  assert.match(sql, /m\.expires_at is null or m\.expires_at>now\(\)/, 'keeps the 20261028000000 kept-chats rule');
  assert.match(sql, /revoke all on function public\.sx_set_wallpaper_photo\(uuid, text, boolean, text\) from public, anon/);
});

test('UI wiring: photo tile + blur switch, image picker, iOS photo-library usage string', () => {
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes("supabase.rpc('sx_set_wallpaper_photo'"));
  assert.ok(chat.includes("mediaTypes:['images']") && chat.includes("uploadMedia(r.assets[0].uri,'photo')"));
  const sheet = readFileSync(new URL('../components/chat/WallpaperSheet.tsx', import.meta.url), 'utf8');
  for (const id of ['wallpaper-photo', 'wallpaper-photo-pick', 'wallpaper-blur']) assert.ok(sheet.includes(`testID="${id}"`), id);
  assert.ok(!/plus=|plus&&|!plus|Locked|wallpaper-locked|lock-closed/.test(sheet), 'no X+ gate in the wallpaper sheet');
  assert.ok(!/useIsPlus|needsPlus/.test(chat), 'no X+ gate in the chat screen');
  const plist = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo.ios.infoPlist;
  assert.match(plist.NSPhotoLibraryUsageDescription, /fotobibliotheek/);
});

// --- Clean-up of old wallpaper photos (policy 20261028210000, NOT applied) ---
test('staleWallpaperPhoto: my replaced/removed photo is deleted; blur toggle, other people\'s photos and presets are not', () => {
  const mine = { path: P1, blur: false }, theirs = { path: `c0000000-0000-4000-8000-0000000000a1/11111111-2222-4333-8444-555555555555.jpg`, blur: true };
  assert.equal(W.staleWallpaperPhoto(mine, P2, ME), P1, 'new photo replaces mine');
  assert.equal(W.staleWallpaperPhoto(mine, null, ME), P1, 'preset / removed');
  assert.equal(W.staleWallpaperPhoto(mine, P1, ME), null, 'same photo (blur toggle)');
  assert.equal(W.staleWallpaperPhoto(theirs, null, ME), null, 'only the uploader can delete');
  assert.equal(W.staleWallpaperPhoto(null, P1, ME), null);
  assert.equal(W.staleWallpaperPhoto({ path: '../x.jpg', blur: false }, null, ME), null);
  assert.equal(W.staleWallpaperPhoto(mine, null, ''), null, 'signed out');
});

test('canDeleteOwnMedia: own folder and unused only', () => {
  const refs = { wallpapers: [P2, null], media: [null] };
  assert.equal(W.canDeleteOwnMedia(P1, ME, refs), true);
  assert.equal(W.canDeleteOwnMedia(P2, ME, refs), false, 'still a chat wallpaper');
  assert.equal(W.canDeleteOwnMedia(P1, ME, { wallpapers: [], media: [P1] }), false, 'used by a message/story/memory');
  assert.equal(W.canDeleteOwnMedia(P1, 'c0000000-0000-4000-8000-0000000000a1', refs), false, 'someone else\'s folder');
});

test('demo storage.remove mirrors the policy: replaced wallpaper photo is removed, the current one stays', async () => {
  const c = new DemoClient(), st = c.storage.from('snapshotx-media');
  await st.upload(P1, new Uint8Array([1]), { contentType: 'image/jpeg' }); await st.upload(P2, new Uint8Array([2]), { contentType: 'image/jpeg' });
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: EVA, p_path: P1, p_blur: false, p_text: 'a' })).error, null);
  assert.deepEqual((await st.remove([P1])).data, [], 'current wallpaper cannot be deleted');
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: EVA, p_path: P2, p_blur: false, p_text: 'b' })).error, null);
  assert.deepEqual((await st.remove([P1, P2])).data, [{ name: P1 }], 'old photo removed, new one kept');
  assert.ok(!(P1 in c.uploads) && P2 in c.uploads);
  assert.equal((await c.rpc('sx_set_wallpaper_photo', { p_thread_id: EVA, p_path: P1, p_blur: false, p_text: 'c' })).error.message, W.WALLPAPER_ERRORS.badPhoto, 'deleted photo is gone');
});

test('migration 20261028210000_wallpaper_photo_cleanup.sql + UI wiring: uploader-only delete of unused media, NOT APPLIED', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261028210000_wallpaper_photo_cleanup.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/); assert.match(sql, /20261028180000_chat_wallpaper_photo\.sql/);
  assert.match(sql, /for delete to authenticated/); assert.match(sql, /bucket_id = 'snapshotx-media'/);
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  assert.match(sql, /not app_private\.sx_media_in_use\(name\)/); assert.match(sql, /security definer set search_path = ''/);
  for (const t of ['sx_threads t where t.wallpaper_path', 'sx_messages m where m.media_path', 'sx_stories s where s.media_path', 'memories mem where mem.storage_path']) assert.ok(sql.includes(t), t);
  const chat = readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes('staleWallpaperPhoto(wpPhotoRef.current,p?.path,uid)') && chat.includes('removeMedia([old])'), 'old photo deleted on replace/remove');
  assert.ok(chat.includes('if(unused)void removeMedia([unused])'), 'unused upload deleted again');
  assert.ok(!/setWpPhoto\((?!p\))/.test(chat), 'every photo change goes through setPhoto');
});
