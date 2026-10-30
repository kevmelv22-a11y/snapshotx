# RevenueCat instellen voor Snapshot X (stap voor stap)

De app gebruikt RevenueCat voor Snapshot X+ (entitlement `snapshot_x`). In de app staat de **test-SDK-key** `test_FHajsikJnhKazfUlcsUduRIJtqI` als standaard. Die werkt **alleen met de RevenueCat Test Store** (nep-aankopen). Voor echte App Store-aankopen heb je de **productie-key `appl_…`** nodig.

## 1. App Store Connect – producten
1. Ga naar App Store Connect → jouw app (`com.snapshotx.app`) → **Abonnementen**.
2. Maak een abonnementsgroep, bijv. "Snapshot X+", met:
   - `yearly` – automatisch verlengbaar abonnement, 1 jaar
   - `monthly` – automatisch verlengbaar abonnement, 1 maand
3. Ga naar **In-app-aankopen** en maak `lifetime` aan als **niet-verbruikbaar** (non-consumable).
4. Vul prijs, naam/omschrijving (NL) en een review-screenshot in; zet ze op "Klaar voor indiening".
5. Zorg dat de Paid Apps-overeenkomst, bank- en belastinggegevens zijn ingevuld.
6. Maak een **In-App Purchase Key** (Gebruikers en toegang → Integraties) en upload die in RevenueCat (Project → Apps → iOS-app).

## 2. RevenueCat-dashboard
1. **Apps**: voeg de iOS-app toe (bundle id `com.snapshotx.app`). Kopieer de **Public API key `appl_…`**.
2. **Products**: importeer `lifetime`, `yearly`, `monthly` uit App Store Connect (en maak ze ook aan voor de Test Store als je daar wilt testen).
3. **Entitlements**: maak `snapshot_x` aan en koppel alle drie de producten.
4. **Offerings**: maak offering `default`, zet hem op **Current**, en voeg 3 packages toe:
   - Lifetime (`$rc_lifetime`) → `lifetime`
   - Annual (`$rc_annual`) → `yearly`
   - Monthly (`$rc_monthly`) → `monthly`
5. **Paywalls**: open offering `default` → *Paywall* → kies een template, ontwerp hem (NL-teksten, kleuren) en **publiceer**. De app toont deze paywall zelf; er staat geen paywall-ontwerp in de code.
6. **Customer Center**: zet het aan (Tools → Customer Center) en stel de opties in (opzeggen, terugbetaling vragen, enz.).

## 3. Key in de app
- In `.env` of als EAS-secret/environment variable: `EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…`
- Zonder deze variabele valt de app terug op de test-key (alleen Test Store).

## 4. Testen
- Werkt **alleen in een development build of EAS-build** (native code). **Niet in Expo Go en niet op de web-demo**: daar blijft de oude mock-aankoop actief (ook bij `EXPO_PUBLIC_DEMO_MODE=1`).
- In de app: Instellingen → banner Snapshot X+ → paywall (als je nog geen X+ hebt). Met X+: Instellingen → **Abonnement beheren** → Customer Center.
- Voor echte App Store-tests: sandbox-tester in App Store Connect + `appl_`-key.
