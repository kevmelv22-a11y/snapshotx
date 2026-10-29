import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ALL_CATEGORIES, EXPORT_CATEGORIES, buildDataExport, collectMyData, exportFilename, exportSummary } from './data-export.ts';
import { DemoClient, DEMO_EMAIL } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ME = 'u-me', A = 'u-aria', B = 'u-bram', now = new Date('2026-10-29T09:30:00Z');
const source = {
  profile: { id: ME, username: 'kv', display_name: 'Kevin', created_at: '2026-01-01T00:00:00Z', is_verified: false },
  preferences: { user_id: ME, language: 'nl', find_me: false },
  people: [{ id: A, username: 'aria', display_name: 'Aria' }, { id: B, username: null, display_name: 'Bram' }],
  friends: [{ user_id: ME, friend_id: A, created_at: '2026-02-01T00:00:00Z' }, { user_id: A, friend_id: ME, created_at: '2026-02-01T00:00:00Z' }],
  requests: [{ sender_id: B, recipient_id: ME, status: 'pending', created_at: '2026-10-28T00:00:00Z' }, { sender_id: A, recipient_id: B, status: 'pending' }],
  blocks: [{ blocker_id: ME, blocked_id: B, created_at: '2026-10-01T00:00:00Z' }],
  threads: [{ id: 't1', title: null }, { id: 't2', title: 'Crew', is_group: true }, { id: 't3', title: 'Niet van mij' }],
  members: [{ thread_id: 't1', user_id: ME }, { thread_id: 't1', user_id: A }, { thread_id: 't2', user_id: ME }, { thread_id: 't2', user_id: A }, { thread_id: 't2', user_id: B }, { thread_id: 't3', user_id: A }],
  messages: [
    { thread_id: 't1', sender_id: A, body: 'Hoi', kind: 'text', created_at: '2026-10-29T08:00:00Z', expires_at: null },
    { thread_id: 't1', sender_id: ME, body: 'photo', kind: 'snap', media_path: 'x/snap.jpg', created_at: '2026-10-29T08:05:00Z', expires_at: null },
    { thread_id: 't1', sender_id: A, body: 'weg', kind: 'text', created_at: '2026-10-27T08:00:00Z', expires_at: '2026-10-28T08:00:00Z' },
    { thread_id: 't2', sender_id: B, body: 'Ingetrokken', kind: 'system', created_at: '2026-10-29T07:00:00Z', unsent_at: '2026-10-29T07:01:00Z' },
    { thread_id: 't2', sender_id: B, body: 'Zaterdag?', kind: 'text', created_at: '2026-10-29T09:00:00Z', saved: true },
    { thread_id: 't3', sender_id: A, body: 'geheim', kind: 'text', created_at: '2026-10-29T09:00:00Z' },
  ],
  stories: [{ owner_id: ME, caption: 'Zon', visibility: 'friends', media_type: 'photo', media_path: 's/1.jpg', created_at: '2026-10-29T06:00:00Z', expires_at: '2026-10-30T06:00:00Z' },
    { owner_id: ME, caption: 'Oud', expires_at: '2026-10-28T06:00:00Z' }, { owner_id: A, caption: 'Van Aria', expires_at: '2026-10-30T06:00:00Z' }],
  memories: [{ owner_id: ME, storage_path: 'm/1.jpg', media_type: 'photo', private: false, created_at: '2025-10-01T00:00:00Z' },
    { owner_id: ME, storage_path: 'vault/2.jpg', media_type: 'photo', private: true }, { owner_id: ME, storage_path: 'm/3.jpg', deleted_at: '2026-10-01T00:00:00Z' }],
  location: { user_id: ME, latitude: 52.37, longitude: 4.9, sharing: true, share_audience: 'friends', ghost_until: '2026-10-29T12:00:00Z', ghost_forever: false, updated_at: '2026-10-29T09:00:00Z' },
};

test('categories: 6 Snapchat-style "Mijn gegevens" categories with Dutch labels', () => {
  assert.deepEqual(ALL_CATEGORIES, ['account', 'friends', 'chats', 'stories', 'memories', 'location']);
  for (const c of EXPORT_CATEGORIES) { assert.ok(c.label && c.description); }
});

test('full export: own data only, names instead of ids, expired/unsent/other-people content left out', () => {
  const { file, counts, filename } = buildDataExport({ uid: ME, email: 'k@x.nl', now, categories: ALL_CATEGORIES, source });
  assert.equal(filename, 'snapshotx-mijn-gegevens-2026-10-29.json');
  assert.equal(file.app, 'Snapshot X'); assert.equal(file.user_id, ME);
  assert.deepEqual(file.account, { username: 'kv', display_name: 'Kevin', created_at: '2026-01-01T00:00:00Z', is_verified: false, email: 'k@x.nl', preferences: { language: 'nl', find_me: false } });
  assert.deepEqual(file.friends.friends, [{ friend: '@aria', since: '2026-02-01T00:00:00Z' }]);
  assert.deepEqual(file.friends.requests, [{ direction: 'ontvangen', other: 'Bram', status: 'pending', at: '2026-10-28T00:00:00Z' }]);
  assert.deepEqual(file.friends.blocked, [{ account: 'Bram', at: '2026-10-01T00:00:00Z' }]);
  assert.equal(file.chats.length, 2, 'only chats I am a member of');
  assert.equal(file.chats[0].chat, 'Crew'); assert.equal(file.chats[0].group, true);
  assert.deepEqual(file.chats[0].messages, [{ from: 'Bram', at: '2026-10-29T09:00:00Z', kind: 'text', text: 'Zaterdag?', media: null, saved: true }]);
  assert.equal(file.chats[1].chat, '@aria');
  assert.deepEqual(file.chats[1].messages.map(m => [m.from, m.text, m.media]), [['@aria', 'Hoi', null], ['jij', null, 'x/snap.jpg']], 'snap body is not exported as text; expired chat is gone');
  assert.ok(!JSON.stringify(file).includes('geheim'));
  assert.deepEqual(file.stories.map(s => s.caption), ['Zon']);
  assert.deepEqual(file.memories.map(m => m.media), ['m/1.jpg', null], 'deleted memory left out, My Eyes Only path not exposed');
  assert.equal(file.location.ghost_mode, true); assert.equal(file.location.latitude, 52.37);
  assert.deepEqual(counts, { account: 1, friends: 1, chats: 3, stories: 1, memories: 2, location: 1 });
  assert.equal(exportSummary(counts), '1 vriend · 3 chats · 1 verhaal · 2 herinneringen');
});

test('only the chosen categories end up in the file', () => {
  const { file, counts } = buildDataExport({ uid: ME, now, categories: ['friends', 'nope'], source });
  assert.ok(file.friends); for (const k of ['account', 'chats', 'stories', 'memories', 'location']) assert.equal(file[k], undefined);
  assert.deepEqual(counts, { friends: 1 });
  assert.equal(exportSummary({ account: 1 }), 'Accountgegevens');
});

test('filename uses the local date, zero padded', () => {
  assert.equal(exportFilename(new Date(2027, 0, 5, 10)), 'snapshotx-mijn-gegevens-2027-01-05.json');
});

test('collectMyData against the demo client: real seeded rows, scoped to the signed-in user', async () => {
  const c = new DemoClient(); const uid = MOCK_IDS.owner;
  const src = await collectMyData(c, uid, ALL_CATEGORIES);
  const { file, counts } = buildDataExport({ uid, email: DEMO_EMAIL, now: new Date(), categories: ALL_CATEGORIES, source: src });
  assert.equal(file.account.username, 'kv.savage');
  assert.equal(counts.friends, 4);
  assert.ok(counts.chats > 10, `chats ${counts.chats}`);
  assert.ok(file.chats.some(ch => ch.chat === 'Weekend crew'));
  assert.ok(file.friends.requests.some(r => r.direction === 'ontvangen' && r.other === '@tim_vd'));
  assert.equal(counts.memories, 2); assert.equal(counts.location, 1);
});

test('collectMyData surfaces a permission error instead of exporting half a file', async () => {
  const c = new DemoClient(); c.faults.denied.add('sx_friends');
  await assert.rejects(collectMyData(c, MOCK_IDS.owner, ['friends']), /permission denied/);
});

test('wired up: settings row, route with title, privacy policy mentions it', () => {
  const settings = readFileSync(new URL('../app/settings.tsx', import.meta.url), 'utf8');
  assert.ok(settings.includes("row('Mijn gegevens','Download een kopie van je gegevens',()=>router.push('/my-data')"), 'settings row');
  const root = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(root, /name="my-data" options=\{\{headerShown:false,title:T\['my-data'\]\}\}/);
  const legal = readFileSync(new URL('./legal.ts', import.meta.url), 'utf8');
  assert.match(legal, /Instellingen › Mijn gegevens/);
});

test('app.json: iOS privacy manifest declares the required-reason APIs and no tracking', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const pm = app.ios.privacyManifests;
  assert.equal(pm.NSPrivacyTracking, false);
  const byType = Object.fromEntries(pm.NSPrivacyAccessedAPITypes.map(t => [t.NSPrivacyAccessedAPIType.replace('NSPrivacyAccessedAPICategory', ''), t.NSPrivacyAccessedAPITypeReasons]));
  assert.ok(byType.UserDefaults.includes('CA92.1'));
  assert.ok(byType.FileTimestamp.includes('C617.1'));
  assert.ok(byType.SystemBootTime.includes('35F9.1'));
  assert.ok(byType.DiskSpace.includes('E174.1'));
});
