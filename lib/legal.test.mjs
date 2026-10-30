import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import * as L from './legal.ts';
import { HIDDEN_HEADER_TITLES } from './back-titles.ts';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Privacybeleid + Gebruiksvoorwaarden: Dutch, dated, one route each, no empty sections', () => {
  assert.deepEqual(L.LEGAL_DOCS.map(d => d.route), ['/privacy', '/voorwaarden']);
  for (const d of L.LEGAL_DOCS) {
    assert.equal(d.updated, L.LEGAL_UPDATED);
    assert.ok(d.intro.length > 40);
    assert.ok(d.sections.length >= 6, d.title);
    const headings = d.sections.map(x => x.heading);
    assert.equal(new Set(headings).size, headings.length, 'unique headings');
    for (const s of d.sections) { assert.ok(s.body.length >= 1, s.heading); for (const p of s.body) assert.ok(p.trim().length > 10, p); }
    assert.ok(headings.includes('Contact'));
  }
  assert.equal(L.legalDoc('privacy'), L.PRIVACY);
  assert.equal(L.legalDoc('/voorwaarden'), L.TERMS);
  assert.equal(L.legalDoc('/nope'), null);
});

test('privacy policy covers what App Review checks (5.1.1): data, permissions, retention, sharing, deletion, age', () => {
  const all = L.PRIVACY.sections.flatMap(s => [s.heading, ...s.body]).join(' ');
  for (const needle of ['e-mailadres', 'geboortedatum', 'Locatie', 'Ghost mode', 'camera', 'microfoon', 'fotobibliotheek', '31 dagen', '24 uur',
    'Account verwijderen', 'AVG', 'Autoriteit Persoonsgegevens', '13 jaar', 'App Store', 'verkopen je gegevens niet', 'IP-adres'])
    assert.ok(all.includes(needle), needle);
});

test('terms cover UGC rules Apple requires (1.2): objectionable content, report + block, enforcement, subscription renewal', () => {
  const all = [L.TERMS.intro, ...L.TERMS.sections.flatMap(s => [s.heading, ...s.body])].join(' ');
  for (const needle of ['tolereren geen aanstootgevende inhoud', 'Pesten', 'minderjarigen', 'melden en gebruikers blokkeren', 'verwijderen inhoud', 'automatisch verlengd', 'Privacybeleid', '13 jaar'])
    assert.ok(all.includes(needle), needle);
});

test('UI wiring: routes exist, settings + sign-up link to both, root stack hides the header', () => {
  assert.ok(existsSync(new URL('../app/privacy.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/voorwaarden.tsx', import.meta.url)));
  assert.match(read('../app/privacy.tsx'), /<LegalScreen doc=\{PRIVACY\}\/>/);
  assert.match(read('../app/voorwaarden.tsx'), /<LegalScreen doc=\{TERMS\}\/>/);
  const settings = read('../app/settings.tsx');
  assert.match(settings, /section\('Over Snapshot X'\)/);
  assert.match(settings, /router\.push\(LEGAL_LINKS\.privacy\.route\)/);
  assert.match(settings, /router\.push\(LEGAL_LINKS\.terms\.route\)/);
  const auth = read('../components/auth/AuthScreen.tsx');
  assert.match(auth, /testID="auth-legal"/); assert.match(auth, /testID="auth-privacy"/);
  const layout = read('../app/_layout.tsx');
  assert.match(layout, /name="privacy" options=\{\{headerShown:false/); assert.match(layout, /name="voorwaarden" options=\{\{headerShown:false/);
  assert.equal(HIDDEN_HEADER_TITLES.privacy, 'Privacybeleid');
  assert.equal(HIDDEN_HEADER_TITLES.voorwaarden, 'Voorwaarden');
});

test('iOS permission strings are present and Dutch for every permission the app uses', () => {
  const app = JSON.parse(read('../app.json')).expo;
  for (const k of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'])
    assert.match(app.ios.infoPlist[k], /SnapShot X|snaps/i, k);
  const loc = app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-location');
  assert.match(loc[1].locationWhenInUsePermission, /locatie/);
});

test('support e-mail is filled in everywhere (privacy, terms, settings, report, app.json, metadata)', () => {
  assert.equal(L.SUPPORT_EMAIL, 'support@snapshot-x.nl');
  assert.equal(L.SUPPORT_MAILTO, 'mailto:support@snapshot-x.nl');
  for (const doc of [L.PRIVACY, L.TERMS]) assert.ok(doc.sections.some(s => s.heading === 'Contact' && s.body.join(' ').includes(L.SUPPORT_EMAIL)));
  const rd = f => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(rd('../app/settings.tsx'), /SUPPORT_LINK\.url/);
  assert.match(rd('../app/report.tsx'), /SUPPORT_MAILTO/);
  assert.equal(JSON.parse(rd('../app.json')).expo.extra.supportEmail, L.SUPPORT_EMAIL);
  assert.match(rd('../docs/app-store/METADATA_NL.md'), /support@snapshot-x\.nl/);
  assert.doesNotMatch(rd('./legal.ts'), /TODO\(Kevin\): support/);
});
