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

## Sessie 01-11-2026 00:00 (live DB)
- Toegepast: `20261101000000_revoke_anon_sx_is_plus` (security advisor 0028: `sx_is_plus` niet meer aanroepbaar zonder account) en `20261101003000_friend_nicknames` (Naam bewerken; RLS alleen eigen rijen + alleen vrienden, woordfilter, ban-guard). Getest in PGlite (/workspace/pgtest/revoke-is-plus.mjs, nicknames.mjs).
- Privacymanifest: `NSPrivacyCollectedDataTypes` toegevoegd in app.json (geen tracking; alle categorieën app-functionaliteit), gecontroleerd door lib/privacy-manifest.test.mjs. Komt pas in een nieuwe build.
- Registratie gebruikt nu dezelfde wachtwoordregels als Wachtwoord wijzigen (geen zwakke wachtwoorden of je eigen gebruikersnaam/e-mail) + sterktemeter.
- Nog open (dashboard, Kevin): Supabase Auth › "Leaked password protection" (HaveIBeenPwned) aanzetten — security advisor-waarschuwing.

## Sessie 01-11-2026 03:00 (Android / Google Play)
- Geen migraties, geen edge-function-deploys, geen builds. Android-config, Play-documenten en openbare pagina /account-verwijderen; zie docs/google-play/RELEASE_CHECKLIST_NL.md.
- Firebase gekoppeld (01-11-2026): project `snapshot-x-2dcb7`, `google-services.json` in repo-root via `android.googleServicesFile`, FCM V1 aan; FCM V1-serviceaccountsleutel wordt in EAS geüpload; server-pushes zonder channelId vallen in kanaal `messages` (defaultChannel in app.json).

## Sessie 01-11-2026 06:00 (echte productieversie + Android)
- Geen migraties, geen builds. Webdeploy van de echte (niet-demo) versie.
- Live gevonden en opgelost: `https://snapshot-x.nl/dev-staff` toonde een staffconsole met MOCK-backend (nepdata, geen echte toegang). Alle `app/dev-*`-schermen en Face Lab zijn nu `devOnly` (alleen dev-server of lokale demo-build).
- Productiebundels bevatten geen demo-client/nepdata en geen demo-inlogknop meer (literal env-check die de bundler wegvouwt); `npm run web:real` keurt een bundle af die ze wel bevat.
- Gesprekken: inkomend gesprek toont naam + @gebruikersnaam uit het eigen profiel-lookup (niet de naam uit het broadcast-bericht); beller stuurt @gebruikersnaam als er geen weergavenaam is; Android-terugknop vraagt eerst "Gesprek beëindigen?".
- Android/iOS-config: geen foreground-service voor media (expo-audio), iOS `UIBackgroundModes: audio` expliciet, één microfoontekst. Pas actief in een nieuwe build.

## Sessie 01-11-2026 09:00 (meldingen, Android/Play, web)
- Geen migraties, geen builds. Live DB alleen gelezen (kolommen/policies van `sx_push_tokens`: user_id, token, updated_at; PK user_id+token; RLS eigen rijen).
- **Pushmeldingen echt aangesloten** (iOS + Android, pas actief in een nieuwe build): `components/PushSync.tsx` in de root-layout — tik op een melding opent de juiste chat (ook bij koude start via `getLastNotificationResponse`), banner op de voorgrond behalve in de open chat, stille token-verversing bij inloggen (alleen als toestemming al gegeven is en Meldingen aan staat). Eén registratiepad `lib/push-device.ts` (Android-kanalen vóór de toestemmingsvraag, Android-tekst bij weigering). Pure regels: `lib/push-logic.ts` + tests.
- **Uitloggen** verwijdert het pushtoken van dit toestel en logt alleen dit toestel uit (`scope: 'local'`; was globaal = alle toestellen).
- **RevenueCat**: niveau uit het product-ID (`rcProductPlan`, ook Play-ID's `snapshot_x_platinum:monthly`), bron `play` op Google Play; Platinum/Lens/Family toonden eerder altijd X+.
- **Gebruikersnamen**: verhalen, Uitgelicht, profiel, vriendschapsprofiel, chatlijst en doorsturen tonen @gebruikersnaam als iemand geen weergavenaam heeft (`lib/profile-name.ts`).
- **Web**: Verkennen-raster op desktop (5 kolommen op 1440px i.p.v. één brede kolom), instellingen-achtige pagina's in een gecentreerde leeskolom (760px).
- Play: release-opmerkingen versionCode 3, Data safety-toelichting pushtoken, RevenueCat-naamregel voor Play-product-ID's.

## Sessie 01-11-2026 12:00 (Android/Play, web, chat)
- Geen migraties, geen builds. Alleen-lezen: `eas credentials -p android` (profiel production) — uploadsleutel JKS, SHA-256 `79:28:8D:38:93:69:45:68:9A:27:1D:A9:F6:F7:7C:50:CD:68:41:D0:A3:F9:23:FF:90:BF:5E:DE:E2:D5:53:82`; FCM V1-sleutel staat er (project snapshot-x-2dcb7). RevenueCat gelezen: nog steeds geen Google Play-app.
- **App Links**: `/.well-known/assetlinks.json` wordt nu altijd gegenereerd met de EAS-uploadsleutel (`lib/universal-links.ts` `EAS_UPLOAD_KEY_SHA256`); Play-app-ondertekeningssleutel later via `SNAPSHOTX_ANDROID_SHA256` erbij.
- **Android-toetsenbord** (edge-to-edge): alle KeyboardAvoidingViews `padding` op Android (`lib/keyboard.ts`), pas actief in een nieuwe build.
- **Play-manifest**: schermdeel-service van react-native-webrtc verwijderd (`plugins/withAndroidNoScreenShareService.js`), FGS camera/microfoon/projectie geblokkeerd, `DETECT_SCREEN_CAPTURE` expliciet. Pas actief in een nieuwe build.
- **Chat**: eigen naam in systeemregels (screenshot, achtergrond, bewaren, verwijderen) = weergavenaam of @gebruikersnaam (was leeg → "Iemand"/"Je vriend"); "Gezien door", groepsleden, vriendenkiezers (nieuwe chat, snap versturen, groep) en verhaalreacties tonen @gebruikersnaam als er geen naam is. Screenshot terwijl een snap van de ander open is → "… heeft een screenshot van een snap gemaakt".
- **Web**: één /map-route (de Map-tab; de dubbele `app/map.tsx` gaf na verversen een kaart zonder zijbalk), Vrienden/vriendprofiel/Mijn profiel in de leeskolom, Herinneringen-raster op desktop (7 staande tegels op 1440px i.p.v. 3 brede strepen), terugknop "Chat" in de kop van losse pagina's die direct via een link geopend worden.

## Sessie 02-11-2026 22:48

- **Android-pushmeldingen**: push-message (edge function v9) stuurt nu `priority: 'high'` en `channelId: 'messages'` (Berichten en snaps), zodat Android het toestel wekt en het juiste kanaal gebruikt.
- **Gedeeld toestel**: nieuwe RPC `sx_claim_push_token` (migratie 20261102221000, live) — als iemand anders op dezelfde telefoon inlogt en meldingen registreert, verdwijnt de token-rij van het vorige account; dat account krijgt hier geen pushes meer.
- **Karakter (Jongen/Meisje) volgt de avatar-editor**: trigger `sx_profile_gender_sync_from_auth` op auth.users (migratie 20261102220000, live) zet profiles.gender bij elke latere wijziging; vrienden zien de juiste avatar-art.
- **Lint schoon** (0 fouten, 0 waarschuwingen); belgesprek-simulatie gebruikt de actuele `send` (geen verouderde closure).
- Nog open: Apple Team ID voor universal links (Kevin).

## Open launch items (bijgewerkt 01-11-2026 06:00)

- **Google Play**: verificatie account, gesloten test 12 testers × 14 dagen (persoonlijk account; plan in docs/google-play/CLOSED_TEST_NL.md), FCM V1-sleutel staat in EAS (gecontroleerd 01-11 12:00), nieuwe AAB-build op verzoek (bevat de fixes van 06:00), Play-app-ondertekenings-SHA-256 → assetlinks.json (uploadsleutel staat er al), RevenueCat Play-app + `goog_`-key (docs/revenuecat/GOOGLE_PLAY_NL.md), Android-screenshots.

- **App Review-telefoonnummer**: nog niet door Kevin gegeven; Apple vereist het bij indienen (docs/app-store/METADATA_NL.md).
- **Universal links**: code/config klaar (zie docs/web/WEB_NL.md). Nodig: Kevins eigen Apple Team ID in de web-env (`SNAPSHOTX_APPLE_TEAM_ID`) + web redeploy, Associated Domains-capability op App ID `com.snapshotx.app` (EAS synchroniseert die bij een production-build met eigen credentials). Ad-hoc-testbuilds blijven zonder associated domains.
- **Gesprekken**: echte test tussen twee apparaten; TURN-dienst kiezen en `EXPO_PUBLIC_TURN_*` zetten; groepsgesprekken nog niet gebouwd.
- **Supabase Auth Redirect URLs** voor `https://snapshot-x.nl/auth/callback` (+ www): controleren in het dashboard.
- **App Review-demo-account**: opnieuw aanmaken vlak voor indienen (de live DB bevat nu alleen Kevins account).
- **Leaked password protection** in Supabase Auth aanzetten (dashboard-instelling).
- **Privacymanifest/App Privacy**: in App Store Connect dezelfde categorieën invullen als docs/app-store/METADATA_NL.md.
