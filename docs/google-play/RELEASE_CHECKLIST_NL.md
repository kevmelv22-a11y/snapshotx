# Snapshot X — Google Play launch-checklist

Status 6 nov 2026 (21:14-sessie). Bouwen en indienen gebeurt **alleen op Kevins verzoek**. Niets hiervan is al in de Play Console gedaan.

## Al klaar in de code
- [x] `app.json` › `android.package` = `com.snapshotx.app`, `versionCode` 3 (laatste gevraagde productiebuild EAS `2f336b8f`; EAS `production` verhoogt automatisch), adaptief icoon (voor-/achtergrond + monochroom voor Android 13-thema-iconen).
- [x] Permissies minimaal: camera, microfoon, locatie (alleen tijdens gebruik), meldingen. **Geblokkeerd**: achtergrondlocatie, READ_MEDIA_IMAGES/VIDEO/AUDIO (Play-beleid foto/video-rechten), SYSTEM_ALERT_WINDOW, READ_PHONE_STATE. Bewaakt door `lib/android-config.test.mjs`.
- [x] `allowBackup: false` (geen chats/sessies in Google-back-ups; past bij Data safety).
- [x] Meldingen: wit X-icoon (`assets/notification-icon.png`), accentkleur, standaardkanaal `messages`; kanalen "Berichten en snaps" en "Vrienden" (privé op het vergrendelscherm).
- [x] App Links: verified intent filter voor `https://snapshot-x.nl/add/*` **en** `/g/*` (groepsuitnodiging; app.config.js; alleen apex — `www.` stuurt door met 308). Website-kant: `assetlinks.json` met EAS-uploadsleutel live; Play-signing-SHA later.
- [x] Android-terugknop sluit eerst de open editor-tool / het vriendenvenster in de snap-editor; alle Modals hebben `onRequestClose`.
- [x] Toetsenbord: tabbalk verbergt zich op Android als het toetsenbord open is; verhaal-antwoordveld schuift niet dubbel.
- [x] RevenueCat kiest de `goog_`-key op Android; teksten noemen Google Play i.p.v. alleen de App Store (instellingen, help, voorwaarden, privacy).
- [x] Openbare pagina **https://snapshot-x.nl/account-verwijderen** (verplicht voor Data safety).
- [x] Winkelteksten, Data safety, contentclassificatie: `LISTING_NL.md`, `DATA_SAFETY_NL.md`, `CONTENT_RATING_NL.md`. Grafische middelen: `assets/store/play-icon-512.png`, `assets/store/play-feature-graphic.png`.

- [x] **Echte productieversie (1 nov 2026, 06:00)**: alle testschermen (`app/dev-*`, Face Lab) sturen in een release-build door naar het beginscherm (`devOnly`, `lib/release-guard.ts`); Face Lab staat niet meer in Instellingen; `/call/<onzin>` toont "Gesprek niet beschikbaar" i.p.v. een nep-gesprek; de demo-client (nepdata) en de demo-inlogknop zitten niet meer in productiebundels (web:real weigert anders te exporteren). EAS-profiel `production` wordt bewaakt: geen demo-vlaggen, geen dev-client, geen ad-hoc-bundle, geen APK (`lib/release-guard.test.mjs`).
- [x] **Geen foreground service**: expo-audio `enableBackgroundPlayback: false`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` geblokkeerd → geen FGS-verklaring in de Play Console. iOS houdt `UIBackgroundModes: audio` (gesprekken). Eén microfoontekst in alle plugins.
- [x] **Android-terugknop**: tijdens een gesprek eerst "Gesprek beëindigen?"; in verhalen sluit hij eerst het antwoordveld/kijkerslijst, in Uitgelicht eerst de reacties.
- [x] Gesloten-testplan + uitnodigingstekst + testerschecklist: `CLOSED_TEST_NL.md`.

- [x] **Meldingen op Android (1 nov 2026, 09:00)**: kanalen worden aangemaakt vóór de toestemmingsvraag (Android 13+), tik op een melding opent de chat (ook bij koude start), geen banner voor de chat die open is, token stil ververst bij inloggen, Uitloggen verwijdert het token van dit toestel. Komt mee in de volgende build.
- [x] **RevenueCat Play-product-ID's** volgen `snapshot_x_<niveau>:<monthly|yearly>`; de app leidt het niveau en bron `play` daaruit af (`lib/revenuecat-logic.ts`).
- [x] Release-opmerkingen voor versionCode 3 in `LISTING_NL.md`.

- [x] **1 nov 2026, 12:00**: `https://snapshot-x.nl/.well-known/assetlinks.json` staat live met de SHA-256 van de **EAS-uploadsleutel** (`79:28:8D:38:…:D5:53:82`, alleen-lezen opgehaald via `eas credentials`; staat in `lib/universal-links.ts`). Daarmee werken App Links al voor builds die met die sleutel zijn ondertekend; voor installaties uit Google Play moet later de Play-sleutel erbij (punt 5).
- [x] **FCM V1-sleutel staat in EAS** (gecontroleerd 1 nov 2026, 12:00, alleen-lezen): Google-serviceaccount `firebase-adminsdk-fbsvc@snapshot-x-2dcb7…`, project `snapshot-x-2dcb7`. Push op Android werkt dus vanaf de volgende build.
- [x] **Server-push op Android** (2 nov 2026): push-message stuurt `priority: high` + `channelId: messages`; kanaal "Berichten en snaps" bestaat al vóór de toestemmingsvraag (lib/push-device.ts). Gedeelde telefoon: token wordt via `sx_claim_push_token` naar het ingelogde account verplaatst.
- [x] **Toetsenbord op Android**: alle invoervelden (chat, reacties, verhaal-antwoord, peilingen, inloggen, wachtwoord, verjaardag) gebruiken `padding` op Android (`lib/keyboard.ts`); met edge-to-edge (Android 15+) bleef het typveld anders onder het toetsenbord.
- [x] **Geen schermdeel-service**: `plugins/withAndroidNoScreenShareService.js` haalt de `mediaProjection`-service van react-native-webrtc uit het manifest; `FOREGROUND_SERVICE_CAMERA/MICROPHONE/MEDIA_PROJECTION` geblokkeerd; `DETECT_SCREEN_CAPTURE` expliciet (screenshotmelding Android 14+). Zie DATA_SAFETY_NL.md.

## Nog te doen (Kevin / volgende sessies)
1. **Play-account geverifieerd** ✅ (Vonk Byte, 2 nov 2026). App in Console aanmaken + eerste AAB **handmatig** uploaden.
2. **Gesloten test**: dezelfde **10 testers als Postwacht**. Google’s 12×14-regel geldt nog voor een persoonlijk account — zie `CLOSED_TEST_NL.md` (2 extra testers of later KvK-organisatie-account jan 2027).
3. **Pushmeldingen op Android (FCM)**: ✅ klaar — Firebase `snapshot-x-2dcb7`, FCM V1 in EAS.
4. **Builds**: versionCode 3 / EAS `2f336b8f` bestaat; volgende AAB alleen op verzoek (bevat o.a. App Links `/g/*`).
5. **SHA-256 van de Play-app-ondertekeningssleutel** na eerste upload → `SNAPSHOTX_ANDROID_SHA256` + web redeploy.
6. **RevenueCat Google Play**: nog geen Play-app / `goog_`-key — zie `docs/revenuecat/GOOGLE_PLAY_NL.md`.
7. **Screenshots** van de echte Android-build (telefoon, 9:16).
8. **Demo-account** voor App-toegang vlak voor indienen opnieuw aanmaken (live DB bevat nu alleen Kevins account).
9. **Echte toestellen testen**: Android 10, 13, 14/15 (edge-to-edge), camera/lenzen, gesprekken (WebRTC), kaart, QR-scanner, terugknop, meldingen.
