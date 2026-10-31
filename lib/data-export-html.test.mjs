import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ALL_CATEGORIES, EXPORT_FORMATS, buildDataExport, escapeHtml, formatExportDate, formatFilenames, renderExportHtml } from './data-export.ts';

const ME = 'u-me', A = 'u-aria', now = new Date('2026-10-31T09:30:00Z');
const source = {
  preferences: { user_id: ME, language: 'nl', find_me: false },
  profile: { id: ME, username: 'kv', display_name: 'Kevin <script>alert(1)</script>', created_at: '2026-01-01T00:00:00Z' },
  people: [{ id: A, username: 'aria', display_name: 'Aria' }],
  friends: [{ user_id: ME, friend_id: A, created_at: '2026-02-01T00:00:00Z' }],
  threads: [{ id: 't1', title: null }], members: [{ thread_id: 't1', user_id: ME }, { thread_id: 't1', user_id: A }],
  messages: [{ thread_id: 't1', sender_id: A, body: 'Hoi & "welkom" <b>', kind: 'text', created_at: '2026-10-31T08:00:00Z' },
    { thread_id: 't1', sender_id: ME, body: 'photo', kind: 'snap', media_path: 'x/snap.jpg', created_at: '2026-10-31T08:05:00Z' }],
  memories: [{ owner_id: ME, storage_path: 'vault/2.jpg', media_type: 'photo', private: true, created_at: '2026-10-01T00:00:00Z' }],
  location: null,
};

test('formats: HTML (default first), JSON and both, with matching filenames', () => {
  assert.deepEqual(EXPORT_FORMATS.map(f => f.key), ['html', 'json', 'both']);
  const json = 'snapshotx-mijn-gegevens-2026-10-31.json';
  assert.deepEqual(formatFilenames(json, 'json'), [json]);
  assert.deepEqual(formatFilenames(json, 'html'), ['snapshotx-mijn-gegevens-2026-10-31.html']);
  assert.deepEqual(formatFilenames(json, 'both'), ['snapshotx-mijn-gegevens-2026-10-31.html', json]);
});

test('escapeHtml + formatExportDate', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(formatExportDate('nope'), '—'); assert.equal(formatExportDate(null), '—');
  const d = new Date(2026, 9, 31, 14, 5);
  assert.equal(formatExportDate(d.toISOString()), '31-10-2026 14:05');
});

test('HTML export: readable Dutch sections, everything escaped, no scripts or external resources', () => {
  const { file } = buildDataExport({ uid: ME, email: 'k@x.nl', now, categories: ALL_CATEGORIES, source });
  const html = renderExportHtml(file);
  assert.match(html, /^<!doctype html><html lang="nl">/);
  for (const h of ['Mijn gegevens', '<h2>Account</h2>', '<h2>Vrienden</h2>', '<h2>Chats</h2>', '<h2>Verhalen</h2>', '<h2>Herinneringen</h2>', '<h2>Locatie</h2>']) assert.ok(html.includes(h), h);
  assert.ok(!/<script/i.test(html), 'user content cannot inject a script');
  assert.ok(html.includes('Kevin &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Hoi &amp; &quot;welkom&quot; &lt;b&gt;'));
  assert.ok(!/(src|href)="(https?:)?\/\//.test(html), 'no external resources');
  assert.ok(html.includes('@aria'));
  assert.ok(html.includes('<em>Snap · x/snap.jpg</em>'), 'snap shown as type + file, not its body');
  assert.ok(html.includes('Verborgen (privé)') && !html.includes('vault/2.jpg'), 'Alleen voor mij paths stay hidden');
  assert.ok(html.includes('Geen locatie opgeslagen.'));
  assert.ok(html.includes('k@x.nl'));
  assert.ok(html.includes('<td>Vindbaar voor anderen</td><td>Nee</td>') && html.includes('<td>Nederlands</td>'), 'booleans/language in words');
  assert.ok(html.includes('• © Vonk Byte • Snapshot-X 2026-2027 •'));
});

test('HTML export only contains the chosen categories', () => {
  const { file } = buildDataExport({ uid: ME, now, categories: ['friends'], source });
  const html = renderExportHtml(file);
  assert.ok(html.includes('<h2>Vrienden</h2>'));
  for (const h of ['<h2>Account</h2>', '<h2>Chats</h2>', '<h2>Locatie</h2>']) assert.ok(!html.includes(h), h);
});

test('Mijn gegevens screen offers the HTML/JSON/Beide choice and renders HTML', () => {
  const src = readFileSync(new URL('../app/my-data.tsx', import.meta.url), 'utf8');
  assert.match(src, /renderExportHtml\(/);
  assert.match(src, /my-data-format-\$\{f\.key\}/);
  assert.match(src, /useState<ExportFormat>\('html'\)/);
});
