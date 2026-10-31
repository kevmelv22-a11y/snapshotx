# Snapshot X — iPhone-testbuild

## Build gate

- Start no iOS IPA build before **1 November 2026** (Europe/Amsterdam).
- The EAS free iOS build allowance is expected to reset on that date; verify the quota in Expo before starting.
- Use the `ios-adhoc` profile on `feat/snaplion-staff-console`.
- `app.config.js` applies `app.star4684.aquila7560` only when the profile supplies `SNAPSHOTX_IOS_ADHOC_BUNDLE_ID`; ordinary builds remain `com.snapshotx.app`.
- The ad hoc provisioning profile must include the test iPhone UDID. EAS signing credentials and UDID registration have not been inspected from this workspace.

## Before starting the build

1. Confirm the latest branch contains the approved app screens, the new Snapshot X icon, and the `expo-updates` configuration.
2. In Expo's `preview` environment, verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exist. Do not put a service-role key in the app.
3. Confirm EAS credentials and the iPhone UDID are registered for the ad hoc bundle ID.
4. On or after 1 November, start the iOS build with profile `ios-adhoc`. Do not enable automatic App Store submission.
5. Install the resulting IPA using the EAS install link/QR on the registered iPhone.

The equivalent CLI command, if one is available, is:

```sh
npx eas-cli@latest build --platform ios --profile ios-adhoc --non-interactive
```

## OTA updates after the first install

The project now includes SDK 57 `expo-updates`, the EAS project URL, `appVersion` runtime policy, and per-profile channels. The first IPA must be built with these settings. After that, compatible JavaScript and asset changes can use channel `ios-adhoc`; changes to native modules, permissions, bundle ID, or runtime need another IPA.

## Database and testing status

- No Supabase request or migration was run for this release-preparation work.
- The staff RPC and friend-suggestion migrations are source files only. The staff search/statistics schema-cache errors require the reviewed migration to be applied to a test database and then the intended hosted database.
- The seven staff actions have not been live-server tested. Do not mark them as passed.
- Lint, TypeScript, source tests, and the iOS JavaScript export pass. Device installation, signing, live database behavior, and iOS UI remain unverified.

## Open launch items (bijgewerkt 31-10-2026 21:00)

- **App Review-telefoonnummer**: nog niet door Kevin gegeven; Apple vereist het bij indienen (docs/app-store/METADATA_NL.md).
- **Universal links**: code/config klaar (zie docs/web/WEB_NL.md). Nodig: Kevins eigen Apple Team ID in de web-env (`SNAPSHOTX_APPLE_TEAM_ID`) + web redeploy, Associated Domains-capability op App ID `com.snapshotx.app` (EAS synchroniseert die bij een production-build met eigen credentials). Ad-hoc-testbuilds blijven zonder associated domains.
- **Gesprekken**: echte test tussen twee apparaten; TURN-dienst kiezen en `EXPO_PUBLIC_TURN_*` zetten; groepsgesprekken nog niet gebouwd.
- **Supabase Auth Redirect URLs** voor `https://snapshot-x.nl/auth/callback` (+ www): controleren in het dashboard.
- **App Review-demo-account**: opnieuw aanmaken vlak voor indienen (de live DB bevat nu alleen Kevins account).
