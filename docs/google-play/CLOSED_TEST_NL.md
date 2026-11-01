# Snapshot X — gesloten test op Google Play (concept)

Status 1 nov 2026 (06:00-sessie). Niets hiervan is al in de Play Console gedaan; bouwen/indienen alleen op Kevins verzoek.

## Waarom
Een **nieuw persoonlijk** Play-ontwikkelaarsaccount krijgt pas productietoegang na een **gesloten test met minstens 12 testers die 14 dagen achter elkaar ingeschreven blijven**. (Een organisatie-account via de KvK-inschrijving van Vonk Byte, gepland jan 2027, heeft die eis niet.)

## Stappen (Kevin, in de Play Console)
1. Account geverifieerd → app aanmaken: naam **Snapshot X**, standaardtaal **Nederlands (nl-NL)**, app (geen game), gratis, pakket `com.snapshotx.app`.
2. **Testen › Gesloten testen › Track maken** (bijv. "Vrienden-test"). Testers: een **Google-groep** (makkelijkst) of een e-maillijst van minstens 12 Google-accounts.
3. AAB uploaden van de echte productiebuild (`eas build --platform android --profile production`, alleen op verzoek). Dezelfde build is de echte app: geen demo-modus, geen testfuncties, echte database.
4. App-content invullen (Data safety, contentclassificatie, doelgroep, App-toegang) met `DATA_SAFETY_NL.md`, `CONTENT_RATING_NL.md`, `LISTING_NL.md`.
5. Uitnodigingslink (opt-in-URL) delen met de testers. **Teller van 14 dagen** loopt pas vanaf het moment dat ≥ 12 testers zijn ingeschreven; laat niemand tussentijds uitschrijven.
6. Na 14 dagen: **Productietoegang aanvragen** (Google stelt vragen over de test: hoe testers geworven, welke feedback, wat verbeterd). Gebruik het logboek hieronder.

## Uitnodiging voor testers (concept, door Kevin zelf te versturen)
> Hoi! Ik lanceer binnenkort mijn eigen app **Snapshot X** (snaps, chats, verhalen en een vriendenkaart). Wil je 14 dagen meetesten op Android?
> 1. Open deze link op je Android-telefoon en tik op **Tester worden**: <opt-in-link uit de Play Console>
> 2. Installeer Snapshot X via de Play Store-link op die pagina.
> 3. Maak een account (13+), voeg mij toe: **snapshot-x.nl/add/kevraz0r**
> 4. Blijf 14 dagen ingeschreven en gebruik de app een paar keer per week.
> Problemen of ideeën? Mail **support@snapshot-x.nl** of stuur me een chat in de app. Dankjewel! 🙌

## Wat testers proberen (checklist)
- Account maken, inloggen, wachtwoord vergeten (e-mail komt aan, link opent de app/website).
- Vriend toevoegen via QR-code, via de link `snapshot-x.nl/add/<gebruikersnaam>` (opent de app zodra App Links geverifieerd zijn) en via zoeken.
- Snap maken met lens/filter, versturen, opslaan in de galerij (geen vraag om toegang tot al je foto's).
- Chatten: tekst, spraakbericht, foto, reageren, bewerken, verwijderen; meldingen komen binnen (ook met de app dicht).
- Verhaal plaatsen en bekijken; kaart met vrienden (alleen als je locatie deelt; Ghost mode werkt).
- (Video)bellen met een andere tester; **Android-terugknop tijdens een gesprek vraagt eerst "Gesprek beëindigen?"**.
- Terugknop overal: sluit eerst open vensters/tools, verlaat dan pas het scherm.
- Melden en blokkeren; account verwijderen (Instellingen of snapshot-x.nl/account-verwijderen).

## Logboek (invullen tijdens de test — Google vraagt hiernaar)
| Datum | Testers ingeschreven | Feedback / bugs | Opgelost in versie |
|---|---|---|---|
| | | | |

## Let op
- Geen testaccounts of nepdata in de live database aanmaken; testers maken hun eigen account.
- De gesloten test gebruikt dezelfde echte backend als snapshot-x.nl: echte gebruikers, echte meldingen.
- Pre-launch report (automatische tests van Google) kan niet inloggen zonder App-toegang-account: dat is normaal; vul App-toegang pas in vlak voor productie.
