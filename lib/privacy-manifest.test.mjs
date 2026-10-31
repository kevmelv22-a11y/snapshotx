import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// App Store: the app's PrivacyInfo.xcprivacy (generated from app.json ios.privacyManifests) must declare the data
// the app collects. Keep this in sync with docs/app-store/METADATA_NL.md (App Privacy) and lib/legal.ts.
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const m = app.ios.privacyManifests;
const APPLE_TYPES = new Set(['Name', 'EmailAddress', 'PhoneNumber', 'PhysicalAddress', 'OtherUserContactInfo', 'Health', 'Fitness', 'PaymentInfo', 'CreditInfo', 'OtherFinancialInfo', 'PreciseLocation', 'CoarseLocation', 'SensitiveInfo', 'Contacts', 'EmailsOrTextMessages', 'PhotosorVideos', 'AudioData', 'GameplayContent', 'CustomerSupport', 'OtherUserContent', 'BrowsingHistory', 'SearchHistory', 'UserID', 'DeviceID', 'PurchaseHistory', 'ProductInteraction', 'AdvertisingData', 'OtherUsageData', 'CrashData', 'PerformanceData', 'OtherDiagnosticData', 'EnvironmentScanning', 'Hands', 'Head', 'OtherDataTypes'].map(t => `NSPrivacyCollectedDataType${t}`));
const PURPOSES = new Set(['ThirdPartyAdvertising', 'DeveloperAdvertising', 'Analytics', 'ProductPersonalization', 'AppFunctionality', 'Other'].map(p => `NSPrivacyCollectedDataTypePurpose${p}`));

test('privacy manifest: no tracking, valid collected data types', () => {
  assert.equal(m.NSPrivacyTracking, false);
  assert.deepEqual(m.NSPrivacyTrackingDomains, []);
  const types = m.NSPrivacyCollectedDataTypes;
  assert.ok(Array.isArray(types) && types.length > 0);
  const seen = new Set();
  for (const t of types) {
    assert.ok(APPLE_TYPES.has(t.NSPrivacyCollectedDataType), t.NSPrivacyCollectedDataType);
    assert.ok(!seen.has(t.NSPrivacyCollectedDataType), 'duplicate ' + t.NSPrivacyCollectedDataType); seen.add(t.NSPrivacyCollectedDataType);
    assert.equal(t.NSPrivacyCollectedDataTypeTracking, false);
    assert.equal(typeof t.NSPrivacyCollectedDataTypeLinked, 'boolean');
    assert.ok(t.NSPrivacyCollectedDataTypePurposes.length && t.NSPrivacyCollectedDataTypePurposes.every(p => PURPOSES.has(p)));
    assert.ok(!t.NSPrivacyCollectedDataTypePurposes.some(p => /Advertising/.test(p)), 'no ads');
  }
});

test('privacy manifest covers what the app actually collects', () => {
  const types = new Set(m.NSPrivacyCollectedDataTypes.map(t => t.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', '')));
  // account (email/phone/name), chats, snaps, voice notes, Snap Map, RevenueCat purchases, push/device id, login history
  for (const t of ['EmailAddress', 'PhoneNumber', 'Name', 'UserID', 'DeviceID', 'EmailsOrTextMessages', 'PhotosorVideos', 'AudioData', 'PreciseLocation', 'PurchaseHistory'])
    assert.ok(types.has(t), `missing ${t}`);
  // the permission strings exist for what we collect
  for (const k of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription']) assert.ok(app.ios.infoPlist[k]);
});

test('App Store metadata App Privacy section mentions the same categories', () => {
  const doc = readFileSync(new URL('../docs/app-store/METADATA_NL.md', import.meta.url), 'utf8');
  for (const w of ['e-mailadres', 'telefoonnummer', 'naam', 'foto', 'audio', 'chats', 'gebruikers-ID', 'apparaat-ID', 'precieze locatie', 'Aankopen']) assert.ok(doc.includes(w), w);
});
