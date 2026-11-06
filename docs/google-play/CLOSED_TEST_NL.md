# Snapshot X — gesloten test op Google Play

Status **6 nov 2026** (21:14-sessie). Kevin’s Google Play-ontwikkelaarsaccount (Vonk Byte) is **geverifieerd** (bevestigd 2 nov 2026). Niets hiervan is al in de Play Console gedaan; bouwen/indienen alleen op Kevins verzoek.

## Testers (Kevin, 2 nov 2026)
- Gesloten test gebruikt **dezelfde 10 testers als Postwacht**.
- Google eist voor een *nieuw persoonlijk* account minstens **12 testers × 14 dagen** vóór productietoegang. Kevin plant 10 (gelijk aan Postwacht); noteer dit verschil: óf 2 extra testers werven vóór de 14-dagen-teller, óf later een organisatie-account via KvK Vonk Byte (gepland jan 2027) gebruiken — dat heeft die 12-tester-eis niet.
- Geen testaccounts of nepdata in de live database; testers maken hun eigen account.

## Waarom
Een geverifieerd account mag de app aanmaken en een gesloten test starten. Productietoegang op een persoonlijk account volgt de 12×14-regel hierboven.

## Stappen (Kevin, in de Play Console)
1. App aanmaken: naam **Snapshot X**, standaardtaal **Nederlands (nl-NL)**, app (geen game), gratis, pakket `com.snapshotx.app`.
2. **Testen › Gesloten testen › Track maken** (bijv. "Vrienden-test"). Testers: Google-groep of e-maillijst — start met de **10 Postwacht-testers**; vul aan tot 12 als je de persoonlijke-account-route aanhoudt.
3. AAB uploaden van de echte productiebuild. Laatste gevraagde Android-productiebuild: EAS `2f336b8f`, `versionCode` **3**, pakket `com.snapshotx.app` (geen demo-modus, echte database). Nieuwe build alleen op verzoek.
4. App-content invullen (Data safety, contentclassificatie, doelgroep, App-toegang) met `DATA_SAFETY_NL.md`, `CONTENT_RATING_NL.md`, `LISTING_NL.md`.
5. Uitnodigingslink delen. De 14-dagen-teller start pas bij ≥ 12 ingeschreven testers (persoonlijk account).
6. Na 14 dagen: **Productietoegang aanvragen**. Gebruik het logboek hieronder.

## Uitnodiging voor testers (concept, door Kevin zelf te versturen)
> Hoi! Ik lanceer binnenkort mijn eigen app **Snapshot X** (snaps, chats, verhalen en een vriendenkaart). Wil je 14 dagen meetesten op Android?
> 1. Open deze link op je Android-telefoon en tik op **Tester worden**: <opt-in-link uit de Play Console>
> 2. Installeer Snapshot X via de Play Store-link op die pagina.
> 3. Maak een account (13+), voeg mij toe: **snapshot-x.nl/add/kevraz0r**
> 4. Blijf 14 dagen ingeschreven en gebruik de app een paar keer per week.
> Problemen of ideeën? Mail **support@snapshot-x.nl** of stuur me een chat in de app. Dankjewel! 🙌

## Wat testers proberen (checklist)
- Account maken, inloggen, wachtwoord vergeten (e-mail komt aan, link opent de app/website).
- Vriend toevoegen via QR-code, via `snapshot-x.nl/add/<gebruikersnaam>` (App Links) en via zoeken; vriendschap beëindigen op het vriendschapsprofiel.
- Snap maken met lens/filter, versturen, herbekijken (zender ziet "Herbekeken"), opslaan in de galerij.
- Chatten: tekst, spraakbericht, foto, reageren, bewerken, verwijderen; groepsuitnodigingslink (`snapshot-x.nl/g/…`); meldingen (ook met de app dicht).
- Verhaal plaatsen met publiekkiezer (Vrienden / Iedereen), bekijken en **eigen verhaal verwijderen**.
- Kaart met vrienden (Ghost mode); (video)bellen — Android-terugknop vraagt eerst "Gesprek beëindigen?".
- Melden en blokkeren; account verwijderen (Instellingen of snapshot-x.nl/account-verwijderen).

## Logboek (invullen tijdens de test — Google vraagt hiernaar)
| Datum | Testers ingeschreven | Feedback / bugs | Opgelost in versie |
|---|---|---|---|
| | | | |

## Open (geen build deze sessie)
- Eerste handmatige AAB-upload in de Play Console (Kevin).
- Play-app-ondertekenings-SHA-256 → `SNAPSHOTX_ANDROID_SHA256` + web redeploy (uploadsleutel staat al in assetlinks).
- RevenueCat: nog **geen** Google Play-app / `goog_`-key (`docs/revenuecat/GOOGLE_PLAY_NL.md`); Android-aankopen uit tot die er is en er opnieuw gebouwd wordt.
- FCM V1-sleutel staat in EAS (project snapshot-x-2dcb7).

## Let op
- Geen testaccounts of nepdata in de live database aanmaken; testers maken hun eigen account.
- De gesloten test gebruikt dezelfde echte backend als snapshot-x.nl.
- Pre-launch report kan niet inloggen zonder App-toegang-account: normaal; vul App-toegang pas in vlak voor productie.
