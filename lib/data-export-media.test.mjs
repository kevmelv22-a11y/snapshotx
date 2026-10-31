import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CATEGORIES, buildDataExport, renderExportHtml, withExportMedia } from './data-export.ts';
import { collectExportMedia, exportMediaPaths, isBase64, mediaJson, mediaMime, mediaSummary } from './data-export-media.ts';

const ME = 'u-me', A = 'u-aria', now = new Date('2026-10-31T09:30:00Z');
const source = {
  profile: { id: ME, username: 'kv', display_name: 'Kevin' }, people: [{ id: A, username: 'aria' }],
  threads: [{ id: 't1' }], members: [{ thread_id: 't1', user_id: ME }, { thread_id: 't1', user_id: A }],
  messages: [
    { thread_id: 't1', sender_id: A, kind: 'photo', body: '', media_path: 'c/foto.jpg', created_at: '2026-10-31T08:00:00Z' },
    { thread_id: 't1', sender_id: A, kind: 'snap', body: 'photo', media_path: 'c/snap.jpg', created_at: '2026-10-31T08:01:00Z' },
    { thread_id: 't1', sender_id: ME, kind: 'snap', body: 'photo', media_path: 'c/kept.jpg', saved: true, created_at: '2026-10-31T08:02:00Z' },
    { thread_id: 't1', sender_id: ME, kind: 'video', body: '', media_path: 'c/foto.jpg', created_at: '2026-10-31T08:03:00Z' }],
  stories: [{ owner_id: ME, media_path: 's/1.mp4', media_type: 'video', created_at: '2026-10-31T07:00:00Z', expires_at: '2026-11-01T07:00:00Z' }],
  memories: [{ owner_id: ME, storage_path: 'm/1.png', media_type: 'photo', private: false, caption: 'Strand <3' },
    { owner_id: ME, storage_path: 'vault/geheim.jpg', media_type: 'photo', private: true }, { owner_id: ME, storage_path: 'm/doc.exe', private: false }],
};
const file = buildDataExport({ uid: ME, now, categories: ALL_CATEGORIES, source }).file;
const b64 = bytes => Buffer.from(bytes).toString('base64');
const fakeFetcher = (sizes, types = {}) => ({
  signedUrl: async p => { if (!(p in sizes)) throw new Error('403'); return `https://x/${p}` },
  fetchBytes: async url => { const p = url.slice(10); return { bytes: new Uint8Array(sizes[p]).fill(65).buffer, contentType: types[p] ?? null } },
  encodeBase64: buf => b64(new Uint8Array(buf)),
});

test('media paths: unique, chats → stories → memories; no unsaved snaps, never Alleen voor mij', () => {
  assert.deepEqual(exportMediaPaths(file), ['c/foto.jpg', 'c/kept.jpg', 's/1.mp4', 'm/1.png', 'm/doc.exe']);
  assert.ok(!JSON.stringify(file).includes('vault/geheim.jpg'));
});

test('mime: allow-list only, content-type wins when allowed, m4a normalised', () => {
  assert.equal(mediaMime('a/b.JPG'), 'image/jpeg');
  assert.equal(mediaMime('a/b.bin', 'image/png; charset=x'), 'image/png');
  assert.equal(mediaMime('a/b.jpg', 'text/html'), 'image/jpeg', 'disallowed server type falls back to the extension');
  assert.equal(mediaMime('a/v.m4a', 'audio/m4a'), 'audio/mp4');
  assert.equal(mediaMime('a/x.exe'), null); assert.equal(mediaMime('a/x.html'), null);
});

test('collect: fetches readable files, skips unavailable / unsupported / too big / over the total, never throws', async () => {
  const seen = [];
  const got = await collectExportMedia(['c/foto.jpg', 'c/kept.jpg', 's/1.mp4', 'm/1.png', 'm/doc.exe', 'm/groot.jpg'],
    fakeFetcher({ 'c/foto.jpg': 3, 's/1.mp4': 4, 'm/1.png': 5, 'm/groot.jpg': 50 }, { 's/1.mp4': 'video/mp4' }),
    { maxFiles: 10, maxFileBytes: 20, maxTotalBytes: 10 }, (d, t) => seen.push(`${d}/${t}`));
  assert.deepEqual(got.files.map(f => [f.path, f.mime, f.kind, f.size]), [['c/foto.jpg', 'image/jpeg', 'image', 3], ['s/1.mp4', 'video/mp4', 'video', 4]]);
  assert.equal(got.files[0].base64, 'QUFB'); assert.equal(got.bytes, 7);
  assert.deepEqual(got.skipped, [{ path: 'c/kept.jpg', reason: 'unavailable' }, { path: 'm/1.png', reason: 'limit' }, { path: 'm/doc.exe', reason: 'type' }, { path: 'm/groot.jpg', reason: 'too_big' }]);
  assert.equal(seen.at(-1), '6/6');
  const capped = await collectExportMedia(['c/foto.jpg', 'm/1.png'], fakeFetcher({ 'c/foto.jpg': 1, 'm/1.png': 1 }), { maxFiles: 1, maxFileBytes: 9, maxTotalBytes: 9 });
  assert.deepEqual(capped.skipped, [{ path: 'm/1.png', reason: 'limit' }]);
});

test('JSON: base64 files with path + Dutch reasons; summary line', async () => {
  const got = await collectExportMedia(['c/foto.jpg', 'c/kept.jpg'], fakeFetcher({ 'c/foto.jpg': 3 }));
  const j = withExportMedia(file, got);
  assert.deepEqual(j.media, { included: 1, total_bytes: 3, files: [{ path: 'c/foto.jpg', mime: 'image/jpeg', size: 3, data_base64: 'QUFB' }], not_included: [{ path: 'c/kept.jpg', reason: 'Niet meer beschikbaar' }] });
  assert.match(String(j.note), /inclusief je foto’s en video’s/);
  assert.equal(withExportMedia(file, null), file, 'without the option the file is unchanged');
  assert.equal(mediaSummary(got), '1 foto/video (<0,1 MB) · 1 niet meegestuurd');
  assert.equal(mediaSummary(null), '');
  assert.deepEqual(mediaJson({ files: [], skipped: [], bytes: 0 }).files, []);
});

test('HTML: embedded photos/videos inline next to their chat, story and memory; strict CSP; hostile data never embedded', async () => {
  const got = await collectExportMedia(exportMediaPaths(file), fakeFetcher({ 'c/foto.jpg': 3, 's/1.mp4': 3, 'm/1.png': 3 }, { 's/1.mp4': 'video/mp4' }));
  const html = renderExportHtml(withExportMedia(file, got));
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:/);
  assert.equal(html.match(/<img class="media"[^>]+src="data:image\/jpeg;base64,QUFB"/g)?.length, 2, 'chat photo inline at both messages that use it');
  assert.match(html, /<video class="media" controls preload="metadata" src="data:video\/mp4;base64,QUFB"/);
  assert.match(html, /src="data:image\/png;base64,QUFB" alt="Strand &lt;3"/);
  assert.ok(html.includes('<h2>Foto’s en video’s</h2>') && html.includes('Niet meegestuurd (2)'));
  assert.ok(!html.includes('vault/geheim.jpg') && !/<script/i.test(html));
  const evil = renderExportHtml({ ...file, media: { files: [{ path: 'c/foto.jpg', mime: 'text/html', data_base64: 'PHNjcmlwdD4=' }, { path: 'm/1.png', mime: 'image/png', data_base64: '"><script>' }] } });
  assert.ok(!evil.includes('data:text/html') && !evil.includes('"><script>'), 'bad mime / non-base64 data stays a path');
  assert.ok(!renderExportHtml(file).includes('<h2>Foto’s en video’s</h2>'), 'no media section without the option');
  assert.ok(isBase64('QUFB') && !isBase64('QUF') && !isBase64('a"b='));
});

test('chat text is readable: reply prefix → quote, poll/sticker tokens → their preview (JSON + HTML)', async () => {
  const { readableMessage } = await import('./data-export.ts');
  const id = 'e0000000-0000-4000-8000-000000000001', who = '0a000000-0000-4000-8000-000000000001';
  assert.deepEqual(readableMessage(`[reply:${id}|${who}|text|Ja%20zeker%2C%20om%208%20uur]\nTop, tot dan!`), { text: 'Top, tot dan!', reply_to: 'Ja zeker, om 8 uur' });
  assert.deepEqual(readableMessage('[poll]{"q":"Pizza of sushi?","o":["Pizza","Sushi"]}'), { text: '📊 Peiling: Pizza of sushi?' });
  assert.deepEqual(readableMessage('Gewoon tekst'), { text: 'Gewoon tekst' });
  assert.deepEqual(readableMessage(null), { text: null });
  const f = buildDataExport({ uid: ME, now, categories: ['chats'], source: { ...source, messages: [{ thread_id: 't1', sender_id: A, kind: 'text', body: `[reply:${id}|${who}|text|<b>hoi</b>]\nTop`, created_at: '2026-10-31T08:00:00Z' }] } }).file;
  assert.deepEqual(f.chats[0].messages[0].reply_to, '<b>hoi</b>');
  const html = renderExportHtml(f);
  assert.ok(html.includes('↩ Antwoord op „&lt;b&gt;hoi&lt;/b&gt;”') && !html.includes('[reply:'));
});
