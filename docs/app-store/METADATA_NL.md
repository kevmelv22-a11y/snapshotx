# App Store-vermelding — concept (nl-NL)

Concept voor App Store Connect. Nog **niet** ingediend. Alles met `TODO(Kevin)` moet Kevin invullen of bevestigen.
Limieten tussen haakjes zijn die van App Store Connect.

## App-informatie
| Veld | Concept |
|---|---|
| Naam (30) | Snapshot X |
| Subtitel (30) | Snaps, chats en je vriendenkaart |
| Bundle ID | `com.snapshotx.app` (app.json) — TODO(Kevin): bevestigen bij eigen Apple Developer-account |
| Primaire categorie | Foto en video |
| Secundaire categorie | Sociale netwerken |
| Leeftijdsclassificatie | 13+ (zie vragenlijst hieronder); app weigert registratie onder 13 jaar (lib/auth-form.ts) |
| Copyright | © 2026 Vonk Byte |
| Support-URL | https://snapshot-x.expo.app/help — openbare pagina Help en support (app/help.tsx): veelgestelde vragen, hulplijnen en een knop om support@snapshot-x.nl te mailen. Werkt zonder inloggen. |
| Support-e-mail | support@snapshot-x.nl |
| Marketing-URL | https://snapshot-x.expo.app (optioneel) |
| Privacybeleid-URL | https://snapshot-x.expo.app/privacy |
| Gebruiksvoorwaarden (EULA) | https://snapshot-x.expo.app/voorwaarden |

## Promotietekst (170)
Nieuw: kies precies welke meldingen je krijgt, download een kopie van je gegevens en meld accounts met één tik.

## Beschrijving (4000)
Snapshot X is de snelste manier om met je vrienden te delen wat er nu gebeurt.

• Snaps — maak een foto of video, voeg tekst, stickers en lenzen toe en stuur hem naar je vrienden. Snaps verdwijnen nadat ze bekeken zijn.
• Chats — chat één-op-één of in groepen, met spraakberichten, reacties, polls, @vermeldingen en je eigen chat-achtergrond. Kies zelf of chats na het bekijken, na 24 uur of nooit verdwijnen.
• Verhalen — deel je dag 24 uur lang met al je vrienden.
• Vriendenkaart — zie waar je vrienden zijn als zij dat willen delen. Met Ghost mode ben je onzichtbaar.
• Personage — maak je eigen 3D-personage en kleed het aan in de Kast.
• Herinneringen — bewaar je mooiste snaps privé in de app.
• Gesprekken — bel met spraak of video.
• Snapshot X+ — extra functies zoals eigen app-icoontjes, vriend-emoji's en meer.

Veilig en privé:
• Blokkeer en meld accounts, chats en verhalen. Ons team bekijkt elke melding.
• Bepaal zelf wie je kan vinden, wie je locatie ziet en welke meldingen je krijgt.
• Download je gegevens of verwijder je account wanneer je wilt, gewoon in de app.

Snapshot X is voor iedereen van 13 jaar en ouder.

## Trefwoorden (100, komma's zonder spaties)
snap,chat,vrienden,verhalen,foto,video,kaart,lenzen,stickers,avatar,groepschat,berichten

## Wat is er nieuw (versie 1.0.0)
Eerste versie van Snapshot X.

## Leeftijdsclassificatie — voorgestelde antwoorden
- Door gebruikers gegenereerde inhoud / onbeperkt chatten met andere gebruikers: **ja** (met melden + blokkeren + moderatie, richtlijn 1.2).
- Geweld, seksuele inhoud, grof taalgebruik, drugs, gokken (door de ontwikkelaar aangeboden): **geen**.
- Locatie delen met andere gebruikers: **ja, optioneel** (Ghost mode standaard beschikbaar).
- Uitkomst verwacht: 13+ (Apple-schaal na 2025: 13+).

## App Privacy ("voedingslabel") — voorstel
Gekoppeld aan de gebruiker, niet voor tracking (geen tracking, geen advertenties):
- Contactgegevens: e-mailadres, telefoonnummer (optioneel) — app-functionaliteit.
- Gebruikersinhoud: foto's/video's, audio, chats, overige inhoud — app-functionaliteit.
- Identificatoren: gebruikers-ID, apparaat-ID (pushtoken) — app-functionaliteit.
- Locatie: precieze locatie (alleen als je deelt op de kaart) — app-functionaliteit.
- Gebruiksgegevens: interactie met het product (inloggeschiedenis voor beveiliging) — app-functionaliteit.
- Gezondheid, financiën, browsegeschiedenis, zoekgeschiedenis: **niet verzameld**.
Controleer tegen de privacymanifest in app.json (`ios.privacyManifests`) en lib/legal.ts.

## Gegevens voor de beoordeling (App Review)
- Demo-account: `appreview@snapshot-x.nl` — password: see secure file (niet in de repo).
- Opmerking voor de reviewer (Engels):
  "Snapshot X is a photo/video messaging app. Users can report content and accounts (long-press a chat/story → Melden, or friend profile → Account melden) and block users; reports are reviewed by our staff in the in-app staff console. Account deletion: Instellingen › Account verwijderen. Data export: Instellingen › Mijn gegevens. Help & support (FAQ, crisis lines, contact): Instellingen › Help en support."
- Contactpersoon: Vonk Byte — e-mail support@snapshot-x.nl — telefoon: TODO(Kevin) (verplicht voor Apple).

## Schermafbeeldingen (6,9" iPhone, 1320 × 2868 — of 6,5", 1284 × 2778)
1. Camera met lens — "Snap wat er nu gebeurt"
2. Chatlijst met Snapstreaks — "Chat met je vrienden"
3. Groepschat met gekleurde namen en poll — "Groepen die écht leven"
4. Verhalen — "Deel je dag"
5. Vriendenkaart met personages — "Zie waar je vrienden zijn"
6. Personage in de Kast — "Maak je eigen personage"
7. Instellingen › Meldingen / Mijn gegevens — "Jij bepaalt"

## Nog nodig vóór indienen
- [ ] Eigen Apple Developer-account + bundle ID (geen ondertekening via een ander team).
- [x] Support-e-mail: support@snapshot-x.nl (lib/legal.ts). Support-URL: https://snapshot-x.expo.app/help (openbare helppagina, app/help.tsx).
- [ ] Openstaande Supabase-migraties toepassen (zie supabase/migrations, o.a. 20261029030000 en 20261029120000).
- [ ] In-app aankopen (Snapshot X+) aanmaken in App Store Connect als ze bij de lancering meegaan.
- [x] Demo-account voor App Review.
