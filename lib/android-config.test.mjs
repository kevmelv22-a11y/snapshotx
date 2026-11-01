import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { ANDROID_CHANNELS } from './backend/push.ts';
import { androidAssetLinks, normalizeSha256, wellKnownFiles } from './universal-links.ts';

// Google Play launch readiness: Android config in app.json/app.config.js (docs/google-play/RELEASE_CHECKLIST_NL.md).
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const appJson = JSON.parse(read('../app.json')).expo;
const require = createRequire(import.meta.url);
const plugin = name => appJson.plugins.find(p => (Array.isArray(p) ? p[0] : p) === name);

test('Android identity: package, versionCode, adaptive + monochrome icon files exist', () => {
  const a = appJson.android;
  assert.equal(a.package, 'com.snapshotx.app');
  assert.ok(Number.isInteger(a.versionCode) && a.versionCode >= 1);
  assert.equal(appJson.ios.buildNumber, '1');
  for (const k of ['foregroundImage', 'backgroundImage', 'monochromeImage']) assert.ok(existsSync(new URL('../' + a.adaptiveIcon[k], import.meta.url)), k);
  assert.equal(a.allowBackup, false, 'no chats/sessions in Google backups');
});

test('Android permissions: only what the app uses; Play-sensitive ones are blocked', () => {
  const a = appJson.android;
  for (const p of ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'])
    assert.ok(a.permissions.includes(`android.permission.${p}`), p);
  for (const p of ['ACCESS_BACKGROUND_LOCATION', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_AUDIO', 'READ_MEDIA_VISUAL_USER_SELECTED', 'SYSTEM_ALERT_WINDOW', 'READ_PHONE_STATE'])
    assert.ok(a.blockedPermissions.includes(`android.permission.${p}`), p);
  for (const p of a.blockedPermissions) assert.ok(!a.permissions.includes(p), `${p} both requested and blocked`);
  const media = plugin('expo-media-library')[1];
  assert.deepEqual(media.granularPermissions, [], 'saving to the gallery is write-only');
  // Saving uses the write-only permission request, so no READ_MEDIA_* is ever needed at runtime.
  assert.match(read('../app/compose.tsx'), /MediaLibrary\.requestPermissionsAsync\(true\)/);
  const loc = plugin('expo-location')[1];
  assert.ok(!loc.isAndroidBackgroundLocationEnabled && !loc.locationAlwaysAndWhenInUsePermission, 'foreground location only');
});

test('Android notifications: white icon, accent colour, default channel exists in the channel list', () => {
  const n = plugin('expo-notifications')[1];
  assert.ok(existsSync(new URL('../' + n.icon, import.meta.url)));
  assert.match(n.color, /^#[0-9A-F]{6}$/i);
  assert.ok(ANDROID_CHANNELS.some(c => c.id === n.defaultChannel));
  assert.deepEqual(ANDROID_CHANNELS.map(c => c.id), ['messages', 'social']);
  for (const c of ANDROID_CHANNELS) assert.ok(c.name.length > 3 && c.description.length > 10);
  assert.match(read('./backend/pushExpo.ts'), /for \(const c of ANDROID_CHANNELS\)/);
  assert.match(read('./backend/pushExpo.ts'), /AndroidNotificationVisibility\.PRIVATE/);
});

test('Android App Links: verified https intent filter for /add on both hosts', () => {
  const cfg = require('../app.config.js')({ config: appJson });
  const f = cfg.android.intentFilters.find(x => x.autoVerify);
  assert.ok(f);
  assert.deepEqual(f.data.map(d => `${d.scheme}://${d.host}${d.pathPrefix}`), ['https://snapshot-x.nl/add/', 'https://www.snapshot-x.nl/add/']);
  assert.deepEqual([...f.category].sort(), ['BROWSABLE', 'DEFAULT']);
});

test('assetlinks template: placeholder is never accepted as a fingerprint; structure matches the generator', () => {
  const tpl = JSON.parse(read('../docs/google-play/assetlinks.template.json'));
  const fp = tpl[0].target.sha256_cert_fingerprints[0];
  assert.match(fp, /PLACEHOLDER/);
  assert.equal(normalizeSha256(fp), null);
  assert.equal(wellKnownFiles({ SNAPSHOTX_ANDROID_SHA256: fp }).files.some(f => f.path.includes('assetlinks')), false);
  const real = androidAssetLinks(['AB:'.repeat(31) + 'AB']);
  assert.deepEqual({ ...real[0], target: { ...real[0].target, sha256_cert_fingerprints: [fp] } }, tpl[0]);
});

test('Android back button: snap editor closes the open tool first; every Modal handles onRequestClose', () => {
  const compose = read('../app/compose.tsx');
  assert.match(compose, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(compose, /<Modal visible=\{pick\}[^>]*onRequestClose=/);
  assert.match(read('../app/(tabs)/_layout.tsx'), /tabBarHideOnKeyboard:Platform\.OS==='android'/);
  assert.doesNotMatch(read('../components/stories/StoryViewer.tsx'), /KeyboardAvoidingView behavior="padding"/);
});
