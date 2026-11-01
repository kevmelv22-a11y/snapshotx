import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { callScreenMode, devToolsAllowed, isDevOnlyPath } from './release-guard.ts';
import { callerName, incomingCallerLabel } from './call-signal.ts';

// Kevin (1 nov 2026): store builds + snapshot-x.nl are the real production app — no demo mode, test tools or test accounts.
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('test tools only in a dev server or a local demo build', () => {
  assert.equal(devToolsAllowed({ dev: false, demo: false }), false);
  assert.equal(devToolsAllowed({ dev: true, demo: false }), true);
  assert.equal(devToolsAllowed({ dev: false, demo: true }), true);
});

test('dev-only paths: every /dev-* harness and the Face Lab, nothing else', () => {
  for (const p of ['/dev-staff', '/dev-plus?scene=paywall', '/dev-live-lens', '/face-lab', '/DEV-CHAT', '/dev-stories/']) assert.ok(isDevOnlyPath(p), p);
  for (const p of ['/', '/settings', '/developer', '/add/kevraz0r', '/chat/dev-123', '/face-lab-x', null, undefined, '']) assert.ok(!isDevOnlyPath(p), String(p));
});

test('every dev/test route is wrapped in devOnly (redirects home in production before mocks mount)', () => {
  const files = readdirSync(new URL('../app', import.meta.url)).filter(f => /^(dev-.*|face-lab(\.web)?)\.tsx$/.test(f));
  assert.ok(files.length >= 15, `found ${files.length}`);
  for (const f of files) {
    const src = read(`../app/${f}`);
    assert.match(src, /^export default devOnly\(\w+\);\s*$/m, f);
    assert.equal((src.match(/^export default /gm) || []).length, 1, `${f}: exactly one default export`);
    assert.match(src, /from '\.\.\/components\/DevOnly'/, f);
  }
  const guard = read('../components/DevOnly.tsx');
  assert.match(guard, /devToolsAllowed\(\{ dev: typeof __DEV__ !== 'undefined' && __DEV__, demo: DEMO_MODE \}\)/);
  assert.match(guard, /<Redirect href="\/" \/>/);
});

test('settings: Face Lab (test) row only with test tools; no other route links to /dev-*', () => {
  const s = read('../app/settings.tsx');
  assert.match(s, /DEV_TOOLS&&row\('Face Lab \(test\)'/);
  assert.doesNotMatch(s.replace(/DEV_TOOLS&&row\('Face Lab \(test\)'/, ''), /row\('Face Lab/);
  const walk = d => readdirSync(new URL(d, import.meta.url), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []);
  for (const f of [...walk('../app'), ...walk('../components')].filter(f => !/\/app\/dev-/.test(f)))
    assert.doesNotMatch(read(f), /(push|replace|href)\s*[(=:]\s*\{?\s*['"`]\/dev-/, f);
});

test('call screen: release builds never show the scripted demo call', () => {
  const rel = { demo: false, devTools: false };
  assert.equal(callScreenMode({ ...rel, realId: true, hasState: false }), 'real');
  assert.equal(callScreenMode({ ...rel, realId: true, hasState: true }), 'real', 'a ?state= param cannot force the mock');
  assert.equal(callScreenMode({ ...rel, realId: false, hasState: false }), 'unavailable');
  assert.equal(callScreenMode({ ...rel, realId: false, hasState: true }), 'unavailable');
  assert.equal(callScreenMode({ demo: true, devTools: true, realId: true, hasState: false }), 'demo');
  assert.equal(callScreenMode({ demo: false, devTools: true, realId: true, hasState: true }), 'demo', 'dev harness');
  assert.equal(callScreenMode({ demo: false, devTools: true, realId: false, hasState: false }), 'demo');
  const src = read('../app/call/[id].tsx');
  assert.match(src, /mode==='unavailable'\)return <CallUnavailable\/>/);
  assert.match(src, /Gesprek niet beschikbaar/);
});

test('EAS production profile: real backend, no demo flag, no dev client, no ad hoc bundle', () => {
  const eas = JSON.parse(read('../eas.json'));
  const prod = eas.build.production;
  assert.equal(prod.environment, 'production');
  assert.notEqual(prod.developmentClient, true);
  assert.equal(prod.distribution ?? 'store', 'store');
  const env = prod.env ?? {};
  assert.ok(!('EXPO_PUBLIC_DEMO_MODE' in env) && !('EXPO_PUBLIC_DEMO_LOGIN' in env), 'no demo flags');
  assert.ok(!('SNAPSHOTX_IOS_ADHOC_BUNDLE_ID' in env), 'store bundle id only');
  assert.notEqual(prod.android?.buildType, 'apk', 'Play needs an AAB');
  assert.doesNotMatch(JSON.stringify(read('../app.json')), /EXPO_PUBLIC_DEMO_MODE/);
});

test('caller name: display name, else @username, never an id', () => {
  assert.equal(callerName({ display_name: ' Kevin ', username: 'kevraz0r' }), 'Kevin');
  assert.equal(callerName({ display_name: '', username: 'kevraz0r' }), '@kevraz0r');
  assert.equal(callerName(null), 'Iemand');
  assert.equal(callerName({ display_name: 'x'.repeat(80) }).length, 60);
});

test('incoming call sheet: server profile wins over the broadcast name, shows @username', () => {
  assert.deepEqual(incomingCallerLabel({ fromName: 'Nep Naam' }, { display_name: 'Joanna', username: 'joanna' }), { name: 'Joanna', handle: '@joanna' });
  assert.deepEqual(incomingCallerLabel({ fromName: 'Nep' }, { display_name: null, username: 'joanna' }), { name: '@joanna', handle: '' });
  assert.deepEqual(incomingCallerLabel({ fromName: 'Lisa' }, null), { name: 'Lisa', handle: '' });
  const src = read('../components/call/IncomingCall.tsx');
  assert.match(src, /from\('profiles'\)\.select\('display_name, username'\)\.eq\('id', invite\.from\)/);
});

test('Android: back button during a call asks before hanging up', () => {
  const src = read('../components/call/RealCall.native.tsx');
  assert.match(src, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(src, /Gesprek beëindigen\?/);
  assert.match(src, /callerName\(prof as CallerProfile\)/);
  assert.match(read('../components/call/RealCall.tsx'), /callerName\(prof as CallerProfile\)/);
});

test('release bundles: no demo client, no demo login button (checked by npm run web:real after export)', async () => {
  const { releaseBundleProblems } = await import('./web-env.ts');
  assert.deepEqual(releaseBundleProblems('const a=1;"• © Vonk Byte • Snapshot-X 2026-2027 •"'), []);
  assert.equal(releaseBundleProblems('children:"Start demo als Kevin"').length, 1);
  assert.equal(releaseBundleProblems("x={'demo/strand.svg':[1]}").length, 1);
  assert.match(read('../scripts/web/export-web-real.mjs'), /releaseBundleProblems\(js\)/);
  // The demo client is only reachable through a literal env check the production bundler folds away.
  const sb = read('./supabase.ts');
  assert.doesNotMatch(sb, /^import \{ DemoClient \}/m, 'no static (value) import of the demo client');
  assert.match(sb, /process\.env\.EXPO_PUBLIC_DEMO_MODE === '1'\s*\n.*\n\s*\? \(new \(require\('\.\/demo-client'\)/);
  const auth = read('../components/auth/AuthScreen.tsx');
  assert.doesNotMatch(auth, /from '\.\.\/\.\.\/lib\/demo-client'/);
  assert.match(auth, /const SHOW_DEMO_BUTTON = process\.env\.EXPO_PUBLIC_DEMO_BUTTON === '1' && /);
  assert.match(auth, /\{process\.env\.EXPO_PUBLIC_DEMO_BUTTON === '1' && SHOW_DEMO_BUTTON && isLogin && /);
});

test('audio: no background-playback foreground service on Android (no Play FGS declaration); iOS keeps audio for calls', () => {
  const app = JSON.parse(read('../app.json')).expo;
  const audio = app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-audio');
  assert.ok(audio, 'expo-audio configured');
  assert.equal(audio[1].enableBackgroundPlayback, false);
  assert.equal(audio[1].enableBackgroundRecording, false);
  assert.equal(audio[1].microphonePermission, app.ios.infoPlist.NSMicrophoneUsageDescription);
  // One microphone text everywhere (expo-camera / expo-audio / webrtc plugins would otherwise overwrite each other).
  for (const p of app.plugins.filter(p => Array.isArray(p) && p[1]?.microphonePermission)) assert.equal(p[1].microphonePermission, app.ios.infoPlist.NSMicrophoneUsageDescription, p[0]);
  assert.ok(app.android.blockedPermissions.includes('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'));
  assert.ok(!app.android.permissions.some(p => /FOREGROUND_SERVICE/.test(p)));
  assert.deepEqual(app.ios.infoPlist.UIBackgroundModes, ['audio']);
  const video = app.plugins.find(p => (Array.isArray(p) ? p[0] : p) === 'expo-video');
  assert.ok(!Array.isArray(video) || !video[1]?.supportsBackgroundPlayback, 'expo-video adds no playback service');
});

test('Android back button closes story/Uitgelicht panels first', () => {
  const sv = read('../components/stories/StoryViewer.tsx');
  assert.match(sv, /if\(Platform\.OS!=='android'\|\|!panelOpen\)return;const sub=BackHandler\.addEventListener\('hardwareBackPress',\(\)=>\{closeRef\.current\(\);return true\}\)/);
  const hf = read('../components/spotlight/HighlightFeed.tsx');
  assert.match(hf, /BackHandler\.addEventListener\('hardwareBackPress',\(\)=>\{setSheetFor\(null\);return true\}\)/);
});
