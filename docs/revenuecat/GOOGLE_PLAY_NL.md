# RevenueCat + Google Play voor Snapshot X (stap voor stap)

Stand van RevenueCat-project **SnapShot X** (`proj34c5e052`, gelezen 1 nov 2026, niets gewijzigd):
- Apps: **Snapshot X (iOS)** (`app4809d04a02`, bundle `app.star4684.aquila7560` = de ad-hoc-testbundle — voor de echte release `com.snapshotx.app` gebruiken) en **Test Store** (`app828472c675`). **Nog geen Google Play-app.**
- Producten (alleen Test Store): `monthly`, `yearly`, `lifetime`, `family_monthly`, `lens_monthly`, `platinum_monthly`, `platinum_yearly`, `storage_monthly`, `storage_yearly`.
- Entitlement: `snapshot_x` (de app leest daarnaast de server-tiers uit `sx_entitlements`).

De app kiest de SDK-key per platform (`rcApiKeyFor` in `lib/revenuecat-logic.ts`): iOS → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`), Android → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`). Ontbreekt de key of is het de key van de andere store, dan valt de app terug op de Test Store-key.

## 1. Google Play Console (na verificatie van het ontwikkelaarsaccount)
1. Maak de app aan: naam **Snapshot X**, pakketnaam `com.snapshotx.app`, standaardtaal nl-NL, gratis.
2. Upload eerst één build naar **Interne test** (vereist voordat je producten kunt aanmaken). Build alleen op Kevins verzoek: `eas build --platform android --profile production`.
3. Zet **Betalingsprofiel** + verkopersgegevens in orde (Instellingen › Betalingsprofiel). Zonder dit geen in-app-aankopen.
4. **Monetiseren › Abonnementen** — maak per tier één abonnement met basisabonnementen (auto-verlengend), product-ID = basisnaam, basisabonnement-ID = periode:
   | Product-ID (abonnement) | Basisabonnementen | RevenueCat-product-ID wordt |
   |---|---|---|
   | `snapshot_x_plus` | `monthly` (P1M), `yearly` (P1Y) | `snapshot_x_plus:monthly`, `snapshot_x_plus:yearly` |
   | `snapshot_x_family` | `monthly` | `snapshot_x_family:monthly` |
   | `snapshot_x_lens` | `monthly` | `snapshot_x_lens:monthly` |
   | `snapshot_x_platinum` | `monthly`, `yearly` | `snapshot_x_platinum:monthly`, `…:yearly` |
   | `snapshot_x_storage` | `monthly`, `yearly` | `snapshot_x_storage:monthly`, `…:yearly` |
   Google Play kent geen "monthly" als los product-ID per abonnement zoals Apple; RevenueCat koppelt `abonnement:basisabonnement`.
5. **Monetiseren › In-app-producten**: `lifetime` (eenmalig, niet-verbruikbaar).
6. Prijzen in EUR gelijk aan iOS (`lib/plus.ts`): X+ € 3,49/mnd of € 29,99/jaar (7 dagen gratis proberen), Family € 5,99/mnd, Lens € 6,99/mnd, Platinum € 11,99/mnd of € 109,99/jaar, Herinneringen-opslag € 1,79/mnd of € 17,99/jaar; `lifetime`: TODO(Kevin) prijs kiezen. Proefperiode: als **aanbieding** (gratis proefperiode, 7 dagen, nieuwe klanten) op de basisabonnementen van `snapshot_x_plus`, niet als apart product.

## 2. Service-account voor RevenueCat
1. Google Cloud Console: maak een project → schakel **Google Play Android Developer API** en **Google Play Developer Reporting API** in.
2. Maak een service-account, download de JSON-sleutel (nooit in de repo; bewaar in /workspace/secrets alleen als Kevin dat wil).
3. Play Console › Gebruikers en rechten › nodig het service-account-e-mailadres uit met: *Financiële gegevens bekijken*, *Bestellingen en abonnementen beheren*, *App-informatie bekijken*.
4. Het kan tot 36 uur duren voordat Google de rechten activeert.

## 3. RevenueCat-dashboard
1. Project SnapShot X › **Apps › + New › Google Play Store**: pakket `com.snapshotx.app`, upload de service-account-JSON.
2. Kopieer de **Public API key `goog_…`** → EAS environment variable `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (environment `production`, zichtbaarheid "plain text" — het is een publieke key).
3. **Products › Import** de Play-producten van stap 1.4/1.5.
4. **Entitlement `snapshot_x`**: koppel alle Play-producten (zoals bij iOS).
5. **Offerings**: voeg in dezelfde offering(s) per package het Play-product toe naast het App Store-product:
   - `$rc_monthly` → `snapshot_x_plus:monthly`, `$rc_annual` → `snapshot_x_plus:yearly`, `$rc_lifetime` → `lifetime`.
6. **Real-time developer notifications (RTDN)**: Apps › Google Play-app › kopieer het Pub/Sub-topic en zet dat in Play Console › Monetiseren › Monetisatie-instellingen. Zonder RTDN komen opzeggingen/verlengingen pas vertraagd binnen.
7. **Customer Center**: werkt ook op Android (opzeggen opent Google Play).

## 4. Testen op Android
- Alleen met een build uit de interne test-track (niet sideloaden van een andere signing-key: Play Billing weigert dat).
- Voeg testaccounts toe in Play Console › Instellingen › Licentietests (testkopers betalen niets; verlengingen gaan versneld).
- Controleer: paywall toont prijzen in EUR, aankoop → entitlement `snapshot_x` actief → Snapshot X+ in de app, herstellen, Customer Center › opzeggen.

## Nog open
- TODO(Kevin): Google Play-verificatie afwachten; Play-app + producten aanmaken; service-account; `goog_`-key in EAS.
- iOS-app in RevenueCat staat op de ad-hoc-bundle; voor de App Store een app voor `com.snapshotx.app` toevoegen (zie SETUP_NL.md).
