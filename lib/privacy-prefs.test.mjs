import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as P from './privacy-prefs.ts';
import { HIDDEN_HEADER_TITLES } from './back-titles.ts';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Wie kan: Dutch choices, story defaults to Mijn vrienden (Snapchat default), frozen default', () => {
  assert.deepEqual(P.STORY_AUDIENCE_CHOICES.map(c => c.value), ['everyone', 'friends']);
  assert.deepEqual(P.STORY_AUDIENCE_CHOICES.map(c => c.label), ['Iedereen', 'Mijn vrienden']);
  assert.deepEqual(P.CONTACT_CHOICES.map(c => c.value), ['friends']);
  for (const c of [...P.STORY_AUDIENCE_CHOICES, ...P.CONTACT_CHOICES]) {
    assert.ok(c.description.length > 15, c.value);
    assert.doesNotMatch(`${c.label} ${c.description}`, /\b(the|your|everyone|friends)\b/i, 'Dutch only');
  }
  assert.equal(P.DEFAULT_PRIVACY_PREFS.story, 'friends');
  assert.ok(Object.isFrozen(P.DEFAULT_PRIVACY_PREFS));
});

test('normalizePrivacyPrefs: server jsonb, local JSON, garbage and unknown audiences fall back to friends', () => {
  assert.deepEqual(P.normalizePrivacyPrefs(null), { story: 'friends' });
  assert.deepEqual(P.normalizePrivacyPrefs('{kapot'), { story: 'friends' });
  assert.deepEqual(P.normalizePrivacyPrefs(['everyone']), { story: 'friends' });
  assert.deepEqual(P.normalizePrivacyPrefs({ story: 'public' }), { story: 'friends' });
  assert.deepEqual(P.normalizePrivacyPrefs({ story: 'everyone', evil: 1 }), { story: 'everyone' });
  assert.deepEqual(P.normalizePrivacyPrefs(JSON.stringify({ story: 'everyone' })), { story: 'everyone' });
});

test('storyVisibility only ever yields a value allowed by the sx_stories check constraint', () => {
  for (const raw of [{ story: 'everyone' }, { story: 'friends' }, { story: 'x' }, {}])
    assert.ok(['everyone', 'friends'].includes(P.storyVisibility(raw)));
  assert.equal(P.storyVisibility({ story: 'everyone' }), 'everyone');
  assert.equal(P.storyAudienceHint({ story: 'everyone' }), 'Verhaal · Iedereen');
  assert.equal(P.storyAudienceHint(P.DEFAULT_PRIVACY_PREFS), 'Verhaal · Mijn vrienden');
});

test('whoCanRows: Snapchat order and values', () => {
  const rows = P.whoCanRows({ story: 'everyone' }, false, 'Spookmodus aan tot je hem uitzet');
  assert.deepEqual(rows.map(r => r.label), ['Contact met mij opnemen', 'Mijn verhaal bekijken', 'Mijn locatie zien', 'Mij zien in Snel toevoegen']);
  assert.deepEqual(rows.map(r => r.value), ['Mijn vrienden', 'Iedereen', 'Spookmodus aan tot je hem uitzet', 'Uit']);
  assert.equal(P.whoCanRows(P.DEFAULT_PRIVACY_PREFS, true, null)[2].value, 'Instellen op de Map');
});

test('wiring: route, back title, Instellingen row, compose writes visibility, migration adds privacy_prefs', () => {
  const root = read('../app/_layout.tsx'), settings = read('../app/settings.tsx'), compose = read('../app/compose.tsx'), screen = read('../app/who-can.tsx');
  assert.match(root, /name="who-can" options=\{\{headerShown:false,title:T\['who-can'\]\}\}/);
  assert.equal(HIDDEN_HEADER_TITLES['who-can'], 'Wie kan…');
  assert.ok(settings.includes("row('Wie kan…'") && settings.includes("router.push('/who-can')"));
  assert.match(compose, /from\('sx_stories'\)\.insert\(\{[^}]*visibility:storyVisibility\(privacy\)\}/);
  for (const id of ['whocan-story-everyone', 'whocan-story-friends', 'whocan-quickadd', 'whocan-location'])
    assert.ok(screen.includes(id) || screen.includes('whocan-${key}-${c.value}'), id);
  assert.match(screen, /role="radio" aria-checked=\{on\}/);
  const sql = read('../supabase/migrations/20261029180000_privacy_prefs.sql');
  assert.match(sql, /add column if not exists privacy_prefs jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /privacy_prefs->>'story' in \('everyone', 'friends'\)/);
});
