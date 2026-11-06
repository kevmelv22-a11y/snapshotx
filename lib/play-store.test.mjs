import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Google Play listing drafts (docs/google-play) stay within Play Console limits and match Kevin's facts.
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const listing = read('../docs/google-play/LISTING_NL.md');
const section = h => { const m = listing.split(`## ${h}`)[1]; assert.ok(m, h); return m.split('\n## ')[0].trim(); };

test('Play listing: name ≤30, short ≤80, full ≤4000, release notes ≤500, Dutch', () => {
  assert.match(listing, /\| App-naam \(30\) \| Snapshot X \|/);
  const short = section('Korte beschrijving (80)');
  assert.ok(short.length <= 80 && short.length > 30, `short ${short.length}`);
  const full = section('Volledige beschrijving (4000)');
  assert.ok(full.length <= 4000 && full.length > 500, `full ${full.length}`);
  assert.match(full, /13 jaar en ouder/);
  const notes = section('Release-opmerkingen versie 1.0.0 (500)').replace(/<\/?nl-NL>/g, '').trim();
  assert.ok(notes.length <= 500 && notes.length > 20);
  assert.doesNotMatch(listing + full, /Snapchat\+|Bitmoji/, 'no competitor trademarks in store copy');
});

test('Play listing facts: package, developer, support, privacy + deletion URLs', () => {
  assert.match(listing, /`com\.snapshotx\.app`/);
  assert.match(listing, /\| Ontwikkelaarsnaam \| Vonk Byte \|/);
  assert.match(listing, /support@snapshot-x\.nl/);
  assert.match(listing, /https:\/\/snapshot-x\.nl\/privacy/);
  assert.match(listing, /https:\/\/snapshot-x\.nl\/account-verwijderen/);
});

test('store graphics exist with the Play sizes', () => {
  const size = p => { const b = readFileSync(new URL(p, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20), b[25]]; };
  assert.ok(existsSync(new URL('../assets/store/play-icon-512.png', import.meta.url)));
  assert.deepEqual(size('../assets/store/play-icon-512.png').slice(0, 2), [512, 512]);
  const [w, h, colorType] = size('../assets/store/play-feature-graphic.png');
  assert.deepEqual([w, h], [1024, 500]);
  assert.notEqual(colorType, 6, 'feature graphic must not have an alpha channel');
});

test('Data safety + content rating drafts cover what Play asks', () => {
  const ds = read('../docs/google-play/DATA_SAFETY_NL.md');
  for (const n of ['Precieze locatie', 'E-mailadres', 'Foto\'s', 'Aankoopgeschiedenis', 'Apparaat-ID', 'versleuteld', 'account-verwijderen', 'Advertenties / tracking? | Nee'])
    assert.ok(ds.includes(n), n);
  const cr = read('../docs/google-play/CONTENT_RATING_NL.md');
  for (const n of ['13–15', 'Families-beleid', 'Melden', 'blokkeren', 'Child Safety']) assert.ok(cr.includes(n), n);
  const rc = read('../docs/revenuecat/GOOGLE_PLAY_NL.md');
  for (const n of ['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'goog_', 'snapshot_x', 'lifetime', 'RTDN', 'com.snapshotx.app']) assert.ok(rc.includes(n), n);
});

test('closed test plan: verified account, 10 Postwacht testers + 12×14 Google rule, Dutch invite, no live test accounts', () => {
  const ct = read('../docs/google-play/CLOSED_TEST_NL.md');
  for (const n of ['geverifieerd', '10 testers', 'Postwacht', '12 testers', '14 dagen', 'snapshot-x.nl/add/kevraz0r', 'support@snapshot-x.nl', 'Gesprek beëindigen?', '2f336b8f', 'versionCode', 'Geen testaccounts of nepdata', 'RevenueCat']) assert.ok(ct.includes(n), n);
  assert.doesNotMatch(ct, /wachtwoord:\s*\S+/i, 'no passwords in the repo');
});

test('Play closed-test release notes (versionCode 3) ≤500 chars, Dutch, no competitor names', () => {
  const notes = section('Release-opmerkingen gesloten test, versionCode 3 (500)').split('<nl-NL>')[1].split('</nl-NL>')[0].trim();
  assert.ok(notes.length <= 500 && notes.length > 50, `notes ${notes.length}`);
  assert.match(notes, /Meldingen/);
  assert.doesNotMatch(notes, /Snapchat|Bitmoji|demo-account|test-account/i);
  const ds = read('../docs/google-play/DATA_SAFETY_NL.md');
  assert.match(ds, /Uitloggen\*\* verwijdert het pushtoken/);
});
