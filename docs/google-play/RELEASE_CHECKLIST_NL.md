# Snapshot X — Google Play launch-checklist

Status 1 nov 2026 (03:00-sessie). Bouwen en indienen gebeurt **alleen op Kevins verzoek**. Niets hiervan is al in de Play Console gedaan.

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

## Nog te doen (Kevin / volgende sessies)
1. **Verificatie Play-ontwikkelaarsaccount** afwachten.
2. **Nieuw persoonlijk account?** Google eist dan een **gesloten test met minstens 12 testers die 14 dagen achter elkaar meedoen** vóór productietoegang. Plan dit vroeg (organisatie-account via KvK Vonk Byte, gepland jan 2027, heeft die eis niet).
3. **Pushmeldingen op Android (FCM)**: Firebase-project aanmaken, Android-app `com.snapshotx.app` toevoegen, `google-services.json` downloaden en via `android.googleServicesFile` / EAS-secret meegeven, en de **FCM V1-serviceaccountsleutel** uploaden in EAS (`eas credentials` › Android › Push Notifications). Zonder dit krijgt Android geen pushtoken.
4. **Eerste build** (op verzoek): `npx eas-cli build --platform android --profile production` (AAB). EAS maakt een uploadsleutel; Google Play App Signing beheert de echte sleutel.
5. **SHA-256** van de app-ondertekeningssleutel → `SNAPSHOTX_ANDROID_SHA256` → web redeploy → App Links geverifieerd.
6. **RevenueCat Google Play**: zie `docs/revenuecat/GOOGLE_PLAY_NL.md`.
7. **Screenshots** van de echte Android-build (telefoon, 9:16).
8. **Demo-account** voor App-toegang vlak voor indienen opnieuw aanmaken (live DB bevat nu alleen Kevins account).
9. **Echte toestellen testen**: Android 10, 13, 14/15 (edge-to-edge), camera/lenzen, gesprekken (WebRTC), kaart, QR-scanner, terugknop, meldingen.
