import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as N from './notification-prefs.ts';
import { HIDDEN_HEADER_TITLES } from './back-titles.ts';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Meldingen: every kind has a Dutch label + description, unique keys, all on by default', () => {
  assert.equal(new Set(N.NOTIFY_KEYS).size, N.NOTIFY_KEYS.length);
  assert.deepEqual(N.NOTIFY_SECTIONS.map(s => s.title), ['Van vrienden', 'Herinneringen', 'Geluid en toestel']);
  for (const s of N.NOTIFY_SECTIONS) for (const o of s.options) {
    assert.ok(o.label.length > 3 && o.description.length > 10, o.key);
    assert.doesNotMatch(`${o.label} ${o.description}`, /\b(the|your|when|friends?)\b/i, 'Dutch only');
  }
  assert.equal(N.DEFAULT_NOTIFY_PREFS.enabled, true);
  for (const k of N.NOTIFY_KEYS) assert.equal(N.DEFAULT_NOTIFY_PREFS[k], true, k);
  assert.ok(Object.isFrozen(N.DEFAULT_NOTIFY_PREFS));
});

test('normalizeNotifyPrefs: tolerates server jsonb, local JSON strings and garbage', () => {
  assert.deepEqual(N.normalizeNotifyPrefs(null), N.DEFAULT_NOTIFY_PREFS);
  assert.deepEqual(N.normalizeNotifyPrefs('{kapot'), N.DEFAULT_NOTIFY_PREFS);
  assert.deepEqual(N.normalizeNotifyPrefs([false]), N.DEFAULT_NOTIFY_PREFS);
  const p = N.normalizeNotifyPrefs({ chats: false, sound: false, evil: true, stories: 'nee' });
  assert.equal(p.chats, false); assert.equal(p.sound, false); assert.equal(p.stories, true);
  assert.equal('evil' in p, false);
  assert.deepEqual(N.normalizeNotifyPrefs(JSON.stringify(p)), p);
});

test('setNotifyPref is immutable; master switch wins in shouldNotify', () => {
  const a = N.DEFAULT_NOTIFY_PREFS;
  const b = N.setNotifyPref(a, 'stories', false);
  assert.equal(a.stories, true); assert.equal(b.stories, false);
  assert.equal(N.shouldNotify(b, 'stories'), false);
  assert.equal(N.shouldNotify(b, 'chats'), true);
  const off = N.setNotifyPref(b, 'enabled', false);
  for (const k of N.NOTIFY_KEYS.filter(k => k !== 'sound')) assert.equal(N.shouldNotify(off, k), false, k);
  assert.equal(N.messageNotifyKind(true), 'mentions');
  assert.equal(N.messageNotifyKind(false), 'chats');
});

test('notifySummary in Dutch (sound is not counted as a kind)', () => {
  const a = N.DEFAULT_NOTIFY_PREFS;
  assert.equal(N.notifySummary(a), 'Alle meldingen aan');
  assert.equal(N.notifySummary(N.setNotifyPref(a, 'sound', false)), 'Alle meldingen aan');
  assert.equal(N.notifySummary(N.setNotifyPref(a, 'enabled', false)), 'Uit');
  assert.equal(N.notifySummary(N.setNotifyPref(N.setNotifyPref(a, 'stories', false), 'memories', false)), '6 van 8 soorten aan');
  const none = N.NOTIFY_KEYS.reduce((p, k) => N.setNotifyPref(p, k, false), a);
  assert.equal(N.notifySummary(none), 'Alle soorten uit');
});

test('screen is wired: route, back title, Instellingen row, master + per-kind switches', () => {
  const root = read('../app/_layout.tsx'), settings = read('../app/settings.tsx'), screen = read('../app/notifications.tsx');
  assert.match(root, /name="notifications" options=\{\{headerShown:false,title:T\.notifications\}\}/);
  assert.equal(HIDDEN_HEADER_TITLES.notifications, 'Meldingen');
  assert.ok(settings.includes("row('Meldingen','Kies welke meldingen je krijgt',()=>router.push('/notifications')"));
  assert.ok(screen.includes('Meldingen inschakelen'));
  assert.match(screen, /testID=\{`notify-\$\{o\.key\}`\}/);
  assert.match(screen, /Platform\.OS==='web'/, 'no push token request on web');
  assert.match(screen, /nooit de inhoud/);
});

test('migration (unapplied file) adds notify_prefs and filters push recipients; push function honours sound', () => {
  const sql = read('../supabase/migrations/20261029120000_notification_prefs.sql');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /add column if not exists notify_prefs jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /notify_prefs ->> 'enabled'\)::boolean, true\)/);
  assert.match(sql, /notify_prefs ->> 'chats'\)::boolean, true\)/);
  assert.match(sql, /sx_thread_mutes/, 'keeps chat mutes');
  assert.match(sql, /sx_blocks/, 'keeps blocking');
  const fn = read('../supabase/functions/push-message/index.ts');
  assert.match(fn, /notify_prefs\?\.sound === false/);
  assert.match(fn, /sound: silent\.has\(r\.user_id\) \? null : 'default'/);
});
