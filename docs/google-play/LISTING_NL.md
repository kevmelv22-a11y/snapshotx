# Google Play-vermelding — concept (nl-NL)

Concept voor de Play Console (Winkelvermelding › Hoofdvermelding). Nog **niet** ingediend. `TODO(Kevin)` = Kevin vult in of bevestigt.
Limieten tussen haakjes zijn die van Google Play. Teksten gecontroleerd door `lib/play-store.test.mjs`.

## App-gegevens
| Veld | Concept |
|---|---|
| App-naam (30) | Snapshot X |
| Pakketnaam | `com.snapshotx.app` (app.json `android.package`; kan na de eerste upload **nooit** meer veranderen) |
| Standaardtaal | Nederlands – nl-NL |
| App of game | App |
| Gratis of betaald | Gratis (met in-app-aankopen: Snapshot X+) |
| Categorie | Communicatie (Snapchat staat ook in Communicatie) |
| Tags (max 5) | Berichten, Foto's delen, Sociaal, Videochat, Camera |
| Ontwikkelaarsnaam | Vonk Byte |
| E-mail (verplicht, openbaar) | support@snapshot-x.nl |
| Website | https://snapshot-x.nl |
| Telefoon (optioneel) | TODO(Kevin) — mag leeg blijven bij Google Play |
| Privacybeleid-URL | https://snapshot-x.nl/privacy |
| URL account verwijderen (Gegevensveiligheid) | https://snapshot-x.nl/account-verwijderen |

## Korte beschrijving (80)
Snaps, chats, verhalen en je vriendenkaart. Deel het moment met je vrienden.

## Volledige beschrijving (4000)
Snapshot X is de snelste manier om met je vrienden te delen wat er nu gebeurt.

• Snaps — maak een foto of video, voeg tekst, stickers en lenzen toe en stuur hem naar je vrienden. Snaps verdwijnen nadat ze bekeken zijn.
• Chats — chat één-op-één of in groepen, met spraakberichten, reacties, polls, @vermeldingen en je eigen chat-achtergrond. Kies zelf of chats na het bekijken, na 24 uur of nooit verdwijnen.
• Verhalen — deel je dag 24 uur lang met je vrienden.
• Vriendenkaart — zie waar je vrienden zijn als zij dat willen delen. Met Ghost mode ben je onzichtbaar.
• Vrienden toevoegen — scan iemands QR-code of open een snapshot-x.nl/add-link.
• Personage — maak je eigen 3D-personage en kleed het aan in de Kast.
• Herinneringen — bewaar je mooiste snaps privé in de app.
• Gesprekken — bel met spraak of video.
• Ook op je computer — chat en bel via snapshot-x.nl.
• Snapshot X+ — extra functies zoals eigen app-icoontjes, vriend-emoji's en meer opslag.

Veilig en privé:
• Blokkeer en meld accounts, chats en verhalen. Ons team bekijkt elke melding.
• Bepaal zelf wie je kan vinden, wie je locatie ziet en welke meldingen je krijgt.
• Download je gegevens of verwijder je account wanneer je wilt.
• Geen advertenties en we verkopen je gegevens niet.

Snapshot X is voor iedereen van 13 jaar en ouder.

## Release-opmerkingen versie 1.0.0 (500)
<nl-NL>
Eerste versie van Snapshot X op Android: snaps, chats, verhalen, vriendenkaart, gesprekken en je eigen personage.
</nl-NL>

## Release-opmerkingen gesloten test, versionCode 3 (500)
Voor de volgende AAB (na build 06b14bd2 / versionCode 2; alleen bouwen op Kevins verzoek).
<nl-NL>
Meldingen werken nu echt op Android: tik op een melding en de juiste chat opent meteen, ook als de app dicht was. In een open chat krijg je geen dubbele melding. Uitloggen stopt de meldingen op dit toestel. Snapshot X+-abonnementen tonen het juiste niveau (zoals Platinum). Geen testfuncties of demo meer in de app. De terugknop sluit eerst open vensters. Het toetsenbord bedekt het typveld niet meer. Links naar snapshot-x.nl/add openen de app.
</nl-NL>

## Afbeeldingen
| Onderdeel | Eis Google Play | Bestand |
|---|---|---|
| App-icoon | 512 × 512 PNG (32-bit), max 1 MB | `assets/store/play-icon-512.png` |
| Feature graphic | 1024 × 500 JPG/PNG (24-bit, geen alfa) | `assets/store/play-feature-graphic.png` |
| Telefoonschermafbeeldingen | 2–8 stuks, 9:16, min. 1080 px aan de korte kant aanbevolen | TODO: maken op een Android-toestel/emulator met de echte build (zelfde 7 onderwerpen als docs/app-store/METADATA_NL.md) |
| Tablet (7"/10") | optioneel | — |

## Toegang tot de app (App-toegang, voor Google-review)
Inloggen is verplicht. Geef in Play Console › App-content › App-toegang een demo-account op (zelfde aanpak als App Review: vlak voor indienen opnieuw aanmaken; wachtwoord nooit in de repo).
Instructie (Engels): "Log in with the provided account. Report: long-press a chat/story → Melden, or friend profile → Account melden. Block: friend profile → Blokkeren. Account deletion: Instellingen › Account verwijderen or https://snapshot-x.nl/account-verwijderen."

## Overige verklaringen in App-content
- **Advertenties**: Nee, de app bevat geen advertenties.
- **Doelgroep en content**: zie `CONTENT_RATING_NL.md` (13–15, 16–17, 18+; niet voor kinderen).
- **Gegevensveiligheid**: zie `DATA_SAFETY_NL.md`.
- **Nieuws-app**: Nee. **COVID-19-app**: Nee. **Overheids-app**: Nee. **Financiële functies**: Geen.
- **Gezondheid**: Geen gezondheidsfuncties.
- **Foto- en videorechten**: de app vraagt **geen** READ_MEDIA_IMAGES/VIDEO (geblokkeerd in app.json); foto kiezen gaat via de systeem-fotokiezer, opslaan in de galerij via MediaStore zonder leesrecht. Niets te verklaren.
- **Locatie op de achtergrond**: niet gebruikt (ACCESS_BACKGROUND_LOCATION geblokkeerd).
- **Volledig scherm-meldingen / foreground service**: geen. Sinds 1 nov 2026 staat achtergrond-afspelen van expo-audio uit (`enableBackgroundPlayback: false`) en is `FOREGROUND_SERVICE_MEDIA_PLAYBACK` geblokkeerd in app.json, dus Play vraagt **geen** verklaring voor foreground services. (react-native-webrtc declareert alleen een `mediaProjection`-service voor schermdelen, die de app niet start.)
