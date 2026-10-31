import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { APP_BUNDLE_ID, LINK_HOSTS, androidAssetLinks, androidIntentFilters, appleAppSiteAssociation, iosAssociatedDomains, isTeamId, normalizeSha256, wellKnownFiles } from './universal-links.ts';
import { parseFriendCode, friendLink } from './friend-code.ts';

const require = createRequire(import.meta.url);
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const SHA = 'AB:'.repeat(31) + 'CD';

function withEnv(env, fn) {
  const keys = ['SNAPSHOTX_IOS_ADHOC_BUNDLE_ID', 'SNAPSHOTX_UNIVERSAL_LINKS'], old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return fn(); } finally { for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
}
const resolve = env => withEnv(env, () => require('../app.config.js')({ config: appJson }));

test('AASA lists only /add/* for TEAM.com.snapshotx.app (modern + legacy keys)', () => {
  const a = appleAppSiteAssociation('ABCDE12345');
  assert.deepEqual(a.applinks.details[0].appIDs, ['ABCDE12345.com.snapshotx.app']);
  assert.equal(a.applinks.details[0].appID, 'ABCDE12345.com.snapshotx.app');
  assert.deepEqual(a.applinks.details[0].paths, ['/add/*']);
  assert.equal(a.applinks.details[0].components[0]['/'], '/add/*');
  assert.throws(() => appleAppSiteAssociation('abc'));
  assert.equal(isTeamId('29897MSSY7'), true); assert.equal(isTeamId('abcde12345'), false);
});

test('assetlinks needs a real SHA-256 fingerprint; plain hex is normalised', () => {
  assert.equal(normalizeSha256('ab'.repeat(32)), 'AB:'.repeat(31) + 'AB');
  assert.equal(normalizeSha256(SHA), SHA);
  assert.equal(normalizeSha256('nope'), null);
  const l = androidAssetLinks([SHA]);
  assert.equal(l[0].target.package_name, 'com.snapshotx.app');
  assert.deepEqual(l[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.throws(() => androidAssetLinks([]));
});

test('web export writes .well-known files only from valid env, otherwise explains why not', () => {
  assert.deepEqual(wellKnownFiles({}).files, []);
  assert.equal(wellKnownFiles({}).notes.length, 2);
  assert.match(wellKnownFiles({ SNAPSHOTX_APPLE_TEAM_ID: 'x' }).notes[0], /ongeldig/);
  const ok = wellKnownFiles({ SNAPSHOTX_APPLE_TEAM_ID: 'ABCDE12345', SNAPSHOTX_ANDROID_SHA256: SHA });
  assert.deepEqual(ok.files.map(f => f.path), ['.well-known/apple-app-site-association', '.well-known/assetlinks.json']);
  assert.deepEqual(ok.notes, []);
});

test('app.config: associated domains only for opted-in production builds, never for the ad hoc (Hadian) bundle', () => {
  assert.equal(resolve({}).ios.associatedDomains, undefined);
  assert.equal(resolve({}).ios.bundleIdentifier, APP_BUNDLE_ID);
  assert.deepEqual(resolve({ SNAPSHOTX_UNIVERSAL_LINKS: '1' }).ios.associatedDomains, iosAssociatedDomains());
  const adhoc = resolve({ SNAPSHOTX_UNIVERSAL_LINKS: '1', SNAPSHOTX_IOS_ADHOC_BUNDLE_ID: 'app.star4684.aquila7560' });
  assert.equal(adhoc.ios.associatedDomains, undefined);
  assert.equal(adhoc.ios.bundleIdentifier, 'app.star4684.aquila7560');
});

test('app.config mirrors lib/universal-links (hosts + Android /add filter) and eas production opts in', () => {
  assert.deepEqual(resolve({}).android.intentFilters, androidIntentFilters());
  assert.equal(resolve({}).android.package, 'com.snapshotx.app');
  assert.deepEqual(iosAssociatedDomains(), LINK_HOSTS.map(h => `applinks:${h}`));
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build;
  assert.equal(eas.production.env.SNAPSHOTX_UNIVERSAL_LINKS, '1');
  assert.equal(eas['ios-adhoc'].env.SNAPSHOTX_UNIVERSAL_LINKS, undefined);
});

test('every QR/share link is an /add/* path that the universal link covers', () => {
  const link = friendLink('kevraz0r', '00000000-0000-0000-0000-000000000000');
  assert.match(new URL(link).pathname, /^\/add\//);
  assert.ok(LINK_HOSTS.includes(new URL(link).host));
  assert.deepEqual(parseFriendCode(link), { kind: 'username', value: 'kevraz0r' });
});
