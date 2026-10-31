# Snapshot X Web op snapshot-x.nl — plan

## Status (31-10-2026)
- Demo: https://snapshot-x.expo.app (EXPO_PUBLIC_DEMO_MODE=1, in-memory DemoClient, geen Supabase-verkeer).
- Footer web-login: "• © Vonk Byte • Snapshot-X 2026-2027 •" (lib/web-layout.ts `WEB_FOOTER`).
- Geen knop "Start demo als Kevin" op de publieke versie: alleen zichtbaar met `EXPO_PUBLIC_DEMO_BUTTON=1` (lokaal testen) en nooit op snapshot-x.nl / www / snapshot-x.expo.app. In de demo kun je gewoon inloggen met elke naam + wachtwoord.
- snapshot-x.nl: geregistreerd via **TransIP** (NS ns0.transip.net / ns1.transip.nl / ns2.transip.eu, MX mx.transip.email).
  Toont nu de TransIP-pagina "Reserved domain". Huidige records: A 85.10.159.96, AAAA 2a01:7c8:f0:1091:0:2:f0a4:abf8, www CNAME -> apex.
  Houder is via SIDN niet publiek; aangenomen: Kevins TransIP-account.

## Wat een echte (niet-demo) webbuild nodig heeft
1. Build-env: `EXPO_PUBLIC_SUPABASE_URL=https://udantesxduijzhhunadv.supabase.co`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>`, **geen** `EXPO_PUBLIC_DEMO_MODE`. (lib/supabase.ts gooit een fout als die ontbreken.)
2. Supabase Auth → URL Configuration: Site URL / Redirect URLs aanvullen met `https://snapshot-x.nl/**` (en `https://snapshot-x.expo.app/**`) voor wachtwoord-reset/magic links. Login met e-mail+wachtwoord werkt op web met de bestaande client (AsyncStorage → localStorage). `detectSessionInUrl:false` moet op web `true` worden als we e-mail-links op web willen afhandelen.
3. Header `x-snaplion-device-id` (custom fetch) → CORS: Supabase staat custom headers toe, maar verifiëren in browser.
4. Wat breekt / ontbreekt op web:
   - Bellen (**klaar 31-10, 18:00**): `components/call/RealCall.tsx` = echte browsergesprekken (RTCPeerConnection + getUserMedia) via `lib/call-engine.ts` (zelfde Realtime-protocol als de iPhone-app → web ↔ app werkt). Video (📹) en spraak (📞, alleen microfoon). Duidelijke NL-melding bij geweigerde camera/microfoon of geen https.
   - Inkomend gesprek op web (**klaar**): `components/call/IncomingCall.tsx` is nu voor app én web; op web belgeluid (Web Audio) + knipperende tabtitel "📞 Naam belt…".
   - Getest met 2 echte accounts (appreview ↔ demo-lisa, echte webbuild): bellen → belscherm bij Lisa → opnemen → offer/answer/tracks → ophangen sluit beide kanten. De mediaverbinding zelf (ICE) kon op de box niet: de Chrome-policy van de box blokkeert WebRTC-UDP. Nog doen: echte test tussen 2 apparaten; TURN-server overwegen (nu alleen STUN, net als de app).
   - Camera: expo-camera werkt beperkt op web (getUserMedia, HTTPS vereist — oké op snapshot-x.nl).
   - Push, RevenueCat (aankopen), app-icons, kaart (`app/map.tsx` heeft web-check), 3D-avatar/face-lab: controleren/uitschakelen op web.
   - Unapplied migrations: web gebruikt dezelfde DB; features die daarvan afhangen falen totdat Kevin ze goedkeurt.
5. **Klaar in code (31-10-2026, 09:00-sessie)**: `npm run web:real:check` controleert de env (geen demo-vlaggen, URL = https://<project>.supabase.co, sleutel = `sb_publishable_…`/anon — een `sb_secret_…`/service_role-sleutel of `sk_…` in een `EXPO_PUBLIC_*` wordt geweigerd, zonder de waarde te tonen). `npm run web:real` exporteert naar `dist-web-real/` en scant de bundle op gelekte geheimen. Het script deployt nooit; preview = `npx eas-cli deploy --export-dir dist-web-real` (zonder `--prod`).
   E-mail-links (registratie bevestigen, wachtwoord herstellen) gaan op web nu naar `<origin>/auth/callback` (lib/web-env.ts `authRedirectUrl`) i.p.v. `snapshotx://`; app/auth/callback.tsx rondt ze af. Supabase Auth → Redirect URLs moet daarvoor `https://snapshot-x.nl/auth/callback` (+ www, snapshot-x.expo.app) bevatten — dat is een Supabase-instelling voor Kevin, niet gedaan.
6. Niet getest: live login (geen echte .env/sleutel op de box; demo-only). Eerste stap = preview-deploy met echte env.

## Layout à la Snapchat Web (desktop ≥ 1024px)
- Links (~360px): profiel/zoek bovenaan, chatlijst (bestaande chat-list.ts), knop "Nieuwe chat".
- Rechts: geopende chat (berichten + invoer), header met bel/video-knoppen.
- Smal (<1024px): huidige mobiele tab-navigatie.
- Implementatie: `useWindowDimensions()` in `app/(tabs)/_layout.tsx` + een `app/(web)/chat` split-view; route `/chat/[id]` rendert rechts.

## Hosting & domein (EAS Hosting)
- Custom domain = **betaald Expo-plan nodig** (niet op Free; Starter is genoeg). 1 custom domain per project, wijst altijd naar de **production**-deployment.
- Dus pas koppelen nadat de echte webbuild op prod staat (nu is prod = demo).

### Exacte DNS-stappen voor Kevin (TransIP → Domein → DNS)
1. expo.dev → project → Hosting settings → Custom domain → `snapshot-x.nl` invullen. Het dashboard toont de exacte tokenwaarden.
2. In TransIP (in deze volgorde, telkens "Refresh" in Expo):
   | Naam | Type | Waarde |
   |---|---|---|
   | `_cf-custom-hostname` | TXT | (verificatietoken uit Expo-dashboard) |
   | `_acme-challenge` | CNAME | (SSL-doel uit Expo-dashboard) |
   | `@` | A | `172.66.0.241` (controleer in dashboard) |
   | `www` | CNAME | `origin.expo.app.` (www → 308 redirect naar apex) |
3. **Verwijderen**: de bestaande `@` A 85.10.159.96 en `@` AAAA 2a01:7c8:f0:1091:0:2:f0a4:abf8 (TransIP-parkeerpagina) en de oude `www` CNAME. MX/SPF (TransIP mail) laten staan.
4. Optioneel staging: `staging` CNAME `origin.expo.app.` + alias `staging` in EAS.

## Volgorde
1. Kevin: Expo-plan upgraden (Starter) + migrations beoordelen.
2. Wij: webbuild met echte env als preview-deploy (geen prod), login testen.
3. Desktop split-view + web-calls (WebRTC in browser).
4. Kevin akkoord → promote naar prod → DNS zoals hierboven.

## Sessie 31-10-2026 21:00
- **Universal links / App Links** (code + config, werkt pas na een nieuwe build):
  - `app.config.js`: iOS `associatedDomains` (`applinks:snapshot-x.nl`, `applinks:www.snapshot-x.nl`) **alleen** als `SNAPSHOTX_UNIVERSAL_LINKS=1` (eas.json-profiel `production`) en nooit voor de ad-hoc-bundle `app.star4684.aquila7560` (dat profiel van Hadian heeft geen Associated Domains-entitlement; anders faalt het tekenen). Android: geverifieerde intent-filter voor `https://snapshot-x.nl/add/*`.
  - `npm run web:real` schrijft `/.well-known/apple-app-site-association` (alleen pad `/add/*`) en `/.well-known/assetlinks.json` zodra `SNAPSHOTX_APPLE_TEAM_ID` / `SNAPSHOTX_ANDROID_SHA256` in de env staan (lib/universal-links.ts). Zonder die waarden: overgeslagen met melding (niets geraden).
  - Nog nodig van Kevin: zijn **eigen** Apple Team ID (na de Apple Developer-inschrijving) en later de Play-app-signing SHA-256. Daarna web opnieuw deployen en een production-build maken.
- **TURN** voor gesprekken: `EXPO_PUBLIC_TURN_URLS` (turn:/turns:), `EXPO_PUBLIC_TURN_USERNAME`, `EXPO_PUBLIC_TURN_CREDENTIAL` (lib/call-signal.ts `iceServersFrom`). Ongeldig/incompleet = alleen STUN. Nog geen TURN-dienst gekozen (bijv. Cloudflare Calls TURN, Twilio, Metered of eigen coturn).
- **Web**: Nederlandse 404-pagina (`app/+not-found.tsx`), tabtitels per pagina met ongelezen chats (`(2) Chat • SnapShot X`), SEO/linkpreview-tags + `manifest.webmanifest` (installeren als app) + `robots.txt`/`sitemap.xml`, actieve chat gemarkeerd in de split-view en `?chat=<id>` in de URL (blijft open na verversen), inlogscherm toont "Log in of maak een account om @naam toe te voegen" na het openen van een /add-link.
