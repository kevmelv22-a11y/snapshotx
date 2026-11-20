// Android parity guards for the 20 Nov 2026 features (Gedeeld verhaal, Plekken/Hotspots, Spelletje, Mijn AI).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('no new Android permissions were needed for the new features', async () => {
  const app = JSON.parse(await read('app.json')).expo.android;
  assert.deepEqual(app.permissions, ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.DETECT_SCREEN_CAPTURE']);
  assert.ok(app.blockedPermissions.includes('android.permission.ACCESS_BACKGROUND_LOCATION'));
});
test('new screens with text input avoid the keyboard on Android (edge-to-edge) and modals close on Back', async () => {
  for (const f of ['app/shared-story.tsx', 'app/my-ai.tsx']) {
    const s = await read(f);
    assert.match(s, /behavior=\{kavBehavior\(Platform\.OS\)\}/, f);
    for (const m of s.match(/<Modal [^>]*>/g) ?? []) assert.match(m, /onRequestClose=/, f);
  }
});
test('map place markers track view changes briefly (Google Maps snapshots on Android)', async () => {
  const s = await read('components/FriendMap.native.tsx');
  assert.match(s, /const PlaceMarker = React\.memo/);
  assert.match(s, /tracksViewChanges=\{tracks\}/);
  assert.doesNotMatch(s, /place-[^\n]*tracksViewChanges=\{false\}/);
  assert.match(s, /<Circle /);
});
