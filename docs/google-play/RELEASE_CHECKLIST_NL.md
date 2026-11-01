# Snapshot X — Google Play launch-checklist

Status 1 nov 2026 (06:00-sessie). Bouwen en indienen gebeurt **alleen op Kevins verzoek**. Niets hiervan is al in de Play Console gedaan.

## Al klaar in de code
- [x] `app.json` › `android.package` = `com.snapshotx.app`, `versionCode` 1 (EAS `production` verhoogt automatisch), adaptief icoon (voor-/achtergrond + monochroom voor Android 13-thema-iconen).
- [x] Permissies minimaal: camera, microfoon, locatie (alleen tijdens gebruik), meldingen. **Geblokkeerd**: achtergrondlocatie, READ_MEDIA_IMAGES/VIDEO/AUDIO (Play-beleid foto/video-rechten), SYSTEM_ALERT_WINDOW, READ_PHONE_STATE. Bewaakt door `lib/android-config.test.mjs`.
- [x] `allowBackup: false` (geen chats/sessies in Google-back-ups; past bij Data safety).
- [x] Meldingen: wit X-icoon (`assets/notification-icon.png`), accentkleur, standaardkanaal `messages`; kanalen "Berichten en snaps" en "Vrienden" (privé op het vergrendelscherm).
- [x] App Links: verified intent filter voor `https://snapshot-x.nl/add/*` en `www.` (app.config.js). Website-kant: `assetlinks.json` zodra de SHA-256 bekend is (zie docs/web/WEB_NL.md).
- [x] Android-terugknop sluit eerst de open editor-tool / het vriendenvenster in de snap-editor; alle Modals hebben `onRequestClose`.
- [x] Toetsenbord: tabbalk verbergt zich op Android als het toetsenbord open is; verhaal-antwoordveld schuift niet dubbel.
- [x] RevenueCat kiest de `goog_`-key op Android; teksten noemen Google Play i.p.v. alleen de App Store (instellingen, help, voorwaarden, privacy).
- [x] Openbare pagina **https://snapshot-x.nl/account-verwijderen** (verplicht voor Data safety).
- [x] Winkelteksten, Data safety, contentclassificatie: `LISTING_NL.md`, `DATA_SAFETY_NL.md`, `CONTENT_RATING_NL.md`. Grafische middelen: `assets/store/play-icon-512.png`, `assets/store/play-feature-graphic.png`.

- [x] **Echte productieversie (1 nov 2026, 06:00)**: alle testschermen (`app/dev-*`, Face Lab) sturen in een release-build door naar het beginscherm (`devOnly`, `lib/release-guard.ts`); Face Lab staat niet meer in Instellingen; `/call/<onzin>` toont "Gesprek niet beschikbaar" i.p.v. een nep-gesprek; de demo-client (nepdata) en de demo-inlogknop zitten niet meer in productiebundels (web:real weigert anders te exporteren). EAS-profiel `production` wordt bewaakt: geen demo-vlaggen, geen dev-client, geen ad-hoc-bundle, geen APK (`lib/release-guard.test.mjs`).
- [x] **Geen foreground service**: expo-audio `enableBackgroundPlayback: false`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` geblokkeerd → geen FGS-verklaring in de Play Console. iOS houdt `UIBackgroundModes: audio` (gesprekken). Eén microfoontekst in alle plugins.
- [x] **Android-terugknop**: tijdens een gesprek eerst "Gesprek beëindigen?"; in verhalen sluit hij eerst het antwoordveld/kijkerslijst, in Uitgelicht eerst de reacties.
- [x] Gesloten-testplan + uitnodigingstekst + testerschecklist: `CLOSED_TEST_NL.md`.

## Nog te doen (Kevin / volgende sessies)
1. **Verificatie Play-ontwikkelaarsaccount** afwachten.
2. **Nieuw persoonlijk account?** Google eist dan een **gesloten test met minstens 12 testers die 14 dagen achter elkaar meedoen** vóór productietoegang. Plan dit vroeg (organisatie-account via KvK Vonk Byte, gepland jan 2027, heeft die eis niet).
3. **Pushmeldingen op Android (FCM)**: ✅ Firebase-project `snapshot-x-2dcb7` met Android-app `com.snapshotx.app`; `google-services.json` staat in de repo-root en is gekoppeld via `android.googleServicesFile` in app.json; FCM V1 API staat aan. Resterend: **FCM V1-serviceaccountsleutel** in EAS (`eas credentials` › Android › Push Notifications) wordt geüpload — controleren dat die er staat vóór de eerste build.
4. **Eerste build**: volgens commit a6ad8c2 is er al een EAS production-build gemaakt (versionCode 2, build 06b14bd2), dus de Android-uploadsleutel bestaat in EAS. Nu kan de **FCM V1-sleutel** (`/workspace/secrets/snapshotx-fcm-service-account.json`, niet in git) via `eas credentials` › Android › Push Notifications (FCM V1) worden geüpload; dit moet Kevin goedkeuren (accountinstelling). De wijzigingen van deze sessie (audio-config, terugknop, geen testschermen) komen pas mee in een **nieuwe** build.
5. **SHA-256** van de app-ondertekeningssleutel → `SNAPSHOTX_ANDROID_SHA256` → web redeploy → App Links geverifieerd.
6. **RevenueCat Google Play**: zie `docs/revenuecat/GOOGLE_PLAY_NL.md`.
7. **Screenshots** van de echte Android-build (telefoon, 9:16).
8. **Demo-account** voor App-toegang vlak voor indienen opnieuw aanmaken (live DB bevat nu alleen Kevins account).
9. **Echte toestellen testen**: Android 10, 13, 14/15 (edge-to-edge), camera/lenzen, gesprekken (WebRTC), kaart, QR-scanner, terugknop, meldingen.
