// Google Play: react-native-webrtc's library manifest declares a screen-sharing foreground service
// (com.oney.WebRTCModule.MediaProjectionService, foregroundServiceType="mediaProjection"). Snapshot X never shares
// the screen (no getDisplayMedia), so the merged manifest should not contain that service: it would invite a
// Play Console foreground-service (media projection) declaration for a feature that doesn't exist.
// This adds <service tools:node="remove"> to the app manifest so the Android manifest merger drops it.
// Idempotent: running prebuild again doesn't add a second entry.
const { withAndroidManifest } = require('expo/config-plugins');

const SERVICE = 'com.oney.WebRTCModule.MediaProjectionService';

function removeScreenShareService(manifest) {
  const root = manifest.manifest;
  root.$ = root.$ ?? {};
  if (!root.$['xmlns:tools']) root.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const app = (root.application ?? [])[0];
  if (!app) return manifest;
  app.service = app.service ?? [];
  if (!app.service.some(s => s.$?.['android:name'] === SERVICE)) {
    app.service.push({ $: { 'android:name': SERVICE, 'tools:node': 'remove' } });
  }
  return manifest;
}

const withAndroidNoScreenShareService = config =>
  withAndroidManifest(config, cfg => { cfg.modResults = removeScreenShareService(cfg.modResults); return cfg; });

module.exports = withAndroidNoScreenShareService;
module.exports.removeScreenShareService = removeScreenShareService;
module.exports.SERVICE = SERVICE;
