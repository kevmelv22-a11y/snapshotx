# Google Play — Gegevensveiligheid (Data safety) — voorgestelde antwoorden

Gebaseerd op wat de app echt doet (lib/legal.ts privacybeleid, app.json privacymanifest, migraties/Edge Functions). Nog **niet** ingevuld in Play Console.

## Algemeen
| Vraag | Antwoord |
|---|---|
| Verzamelt of deelt je app vereiste gebruikersgegevens? | **Ja** |
| Worden alle gegevens versleuteld tijdens overdracht? | **Ja** (alleen HTTPS/WSS naar Supabase, Expo, RevenueCat; gesprekken via WebRTC DTLS-SRTP) |
| Kunnen gebruikers verzoeken hun gegevens te verwijderen? | **Ja** — in de app (Instellingen › Account verwijderen) en via https://snapshot-x.nl/account-verwijderen |
| Delen met derden? | **Nee** — Supabase, Expo (push), RevenueCat en Google zijn verwerkers die in onze opdracht werken; dat telt volgens Google niet als "delen" |
| Advertenties / tracking? | Nee |

## Verzamelde gegevens (allemaal: verzameld, niet gedeeld, niet optioneel tenzij vermeld, doel = App-functionaliteit; beveiliging/fraudepreventie waar vermeld)
| Categorie Play | Gegevenstype | Optioneel? | Doel |
|---|---|---|---|
| Persoonlijke info | Naam (weergavenaam) | nee | App-functionaliteit, Accountbeheer |
| Persoonlijke info | E-mailadres | nee | Accountbeheer, App-functionaliteit |
| Persoonlijke info | Gebruikers-ID's (gebruikersnaam, account-ID) | nee | App-functionaliteit, Accountbeheer |
| Persoonlijke info | Telefoonnummer | **ja** | App-functionaliteit |
| Persoonlijke info | Andere info: geboortedatum | nee | App-functionaliteit (leeftijdsgrens 13+, tienerinstellingen) |
| Locatie | Precieze locatie | **ja** (alleen bij delen op de kaart of 'Mijn locatie sturen' in een chat) | App-functionaliteit |
| Berichten | Andere in-app-berichten (chats, snaps, spelletjes-zetten in de chat) | nee | App-functionaliteit |
| Berichten | Andere in-app-berichten: **Mijn AI**-chat (bericht + laatste ≤12 beurten) | **ja** (alleen als je Mijn AI gebruikt) | App-functionaliteit — **tijdelijk verwerkt** ("Data is processed ephemerally"): niet op onze server opgeslagen, alleen op het toestel |
| Foto's en video's | Foto's, Video's | ja (alleen wat je verstuurt/bewaart) | App-functionaliteit |
| Audiobestanden | Spraak- of geluidsopnamen (spraakberichten) | ja | App-functionaliteit |
| Financiële info | Aankoopgeschiedenis (Snapshot X+, via Google Play/RevenueCat; geen betaalgegevens) | ja | App-functionaliteit |
| App-activiteit | App-interacties (bekeken/gelezen, reacties), Andere door gebruikers gemaakte inhoud (verhalen, **gedeelde verhalen + leden**, polls, personage, gekozen muziek/stemfilter bij een snap) | nee | App-functionaliteit |
| App-activiteit | Andere acties: aantal Mijn AI-berichten per dag (teller, na 7 dagen verwijderd) + gemelde AI-antwoorden | ja | App-functionaliteit, Fraudepreventie en beveiliging |
| App-info en prestaties | — niet verzameld (geen crashrapportage-SDK) | | |
| Apparaat- of andere ID's | Apparaat-ID (installatie-ID, pushtoken) + IP-adres bij inloggen | nee | App-functionaliteit, Fraudepreventie en beveiliging |

**Niet** verzameld: contacten/adresboek, agenda, gezondheid, financiële rekeninggegevens, webgeschiedenis, zoekgeschiedenis, geïnstalleerde apps, SMS/oproeplog.

Verwerking is **niet tijdelijk** (gegevens worden opgeslagen), behalve live gesprekken (niet opgeslagen).

### Pushtoken (toelichting, 1 nov 2026)
- Het Expo-pushtoken (via FCM) wordt pas opgeslagen na toestemming voor meldingen (Android 13+: systeemvraag; kanalen "Berichten en snaps" en "Vrienden" bestaan al vóór die vraag). Bij elke start wordt het token stil ververst, alleen als toestemming al gegeven is en "Meldingen inschakelen" aan staat — de app vraagt nooit zomaar om toestemming.
- **Uitloggen** verwijdert het pushtoken van dít toestel uit `sx_push_tokens` en logt alleen dit toestel uit. Account verwijderen verwijdert alle tokens (cascade).
- Een melding bevat nooit chattekst of media, alleen wie je iets stuurde en een chat-ID om de juiste chat te openen.

## Toelichting permissies (1 nov 2026, 12:00)
- **Screenshotmelding in chats** (Android 14+): gebruikt `DETECT_SCREEN_CAPTURE` (installatiepermissie, geen pop-up). De app ziet alleen *dát* er een screenshot is gemaakt, nooit de afbeelding; er wordt niets extra verzameld. Op Android 13 en lager werkt de melding niet (we vragen bewust geen toegang tot foto's).
- **Geen foreground services**: geen media-afspelen, camera, microfoon of schermdelen op de achtergrond (`FOREGROUND_SERVICE_*` geblokkeerd; de schermdeel-service van react-native-webrtc wordt uit het manifest gehaald door `plugins/withAndroidNoScreenShareService.js`). In de Play Console hoeft dus **geen** verklaring voor foreground services ingevuld te worden.

## Nieuwe functies 20 nov 2026 (toelichting bij de antwoorden)
- **Gedeeld verhaal** (`sx_shared_stories`, `sx_shared_story_members`, `sx_stories.shared_story_id`): titel + leden + snaps; alleen leden zien het (RLS ook op de mediabestanden). Valt onder "Andere door gebruikers gemaakte inhoud" en "Foto's en video's" — geen nieuwe categorie.
- **Geluiden / stemfilters** (`sx_stories.sound`, `sx_messages.sound`): alleen een korte code (bv. `m:zomer;v:helium`), geen opname van de gebruiker; de muziek is eigen, rechtenvrij en zit in de app. Geen nieuwe categorie.
- **Snap Map Hotspots + Plekken**: vaste lijst openbare plekken in de app + de vriendenposities die je al ziet. **Er wordt geen extra locatie verzameld**; de antwoorden bij "Locatie" blijven gelijk.
- **Vriend-emoji's 😁 😬 😏** (`sx_friend_ranks`): berekend uit bestaande chats op de server; geeft alleen jouw eigen positie in de beste-vriendenlijst van een vriend terug. Geen nieuwe gegevens.
- **Spelletje in de chat**: zetten zijn gewone chatberichten (dezelfde bewaarregels). Geen nieuwe categorie.
- **Mijn AI** (edge function `my-ai`): bericht + korte geschiedenis gaan naar de AI-dienst (Groq; reserve OpenAI) als **verwerker in onze opdracht** → in Play telt dit **niet als "delen"** (dienstverlener). Geen naam/e-mail mee; `user` is een eenrichtings-hash. Niets van het gesprek wordt op onze server opgeslagen → "tijdelijk verwerkt". Wel opgeslagen: dagteller `sx_ai_usage` (7 dagen) en vrijwillige meldingen `sx_ai_reports` (gemeld antwoord + vraag ervoor).
- Versleuteling onderweg: ja (HTTPS naar Supabase en naar de AI-dienst). Verwijderen: account verwijderen wist ook `sx_ai_usage`, `sx_ai_reports`, gedeelde-verhaal-lidmaatschappen (cascade).

## Controle bij elke release
- Nieuwe SDK of permissie? Werk dit document, `app.json` (`ios.privacyManifests` + `android.permissions/blockedPermissions`) en `lib/legal.ts` samen bij. `lib/android-config.test.mjs` bewaakt de Android-permissies.

## Aanvulling 21 nov 2026
- **Mijn AI stuurt pas iets door na expliciete toestemming** in de app (kaart met Groq/OpenAI en wat er wordt verstuurd; Toestaan/Niet nu; intrekken via het schildje). De toestemming staat alleen op het toestel. De antwoorden in het formulier blijven gelijk (verwerker in onze opdracht, tijdelijk verwerkt).
- **Zonnestelsel (X+)** gebruikt alleen de bestaande RPC `sx_friend_ranks` (je eigen plek in de beste vrienden van een vriend, berekend uit berichten die al in de tabel "Berichten/App-activiteit" staan). Geen nieuw gegevenstype, niets gedeeld.
- **Nog een potje** (spelletje) = een gewoon chatbericht; valt onder "Andere in-app-berichten". **Staffpaneel › AI-meldingen** leest bestaande meldingen (alleen staff); geen nieuwe verzameling.
- Conclusie: Data safety-formulier hoeft voor deze wijzigingen **niet** aangepast te worden.

## Aanvulling 27 nov 2026
- **Mijn locatie sturen (chat)**: alleen na een tik + bevestiging; één punt (4 decimalen ≈ 11 m) als gewoon chatbericht, verdwijnt volgens de chatinstelling (24 u / na bekijken). Valt onder de bestaande rij **Precieze locatie** (al "ja", app-functionaliteit). Doorgeven aan de chatpartner gebeurt op verzoek van de gebruiker → in Play **geen "delen"**. Pushmeldingen bevatten nooit de coördinaten (push-message stuurt geen chattekst).
- **Spotlight sturen naar een vriend**: een chatbericht met de ID, naam van de maker en het bijschrift van een openbare snap. Geen nieuw gegevenstype.
- **Herinneringen › Camera-rol / Kies uit galerij**: de systeemkiezer geeft alleen het gekozen bestand; geen READ_MEDIA_*-permissie (blijft geblokkeerd). Pas na versturen wordt het geüpload, net als een snap. Geen nieuwe categorie.
- iOS-toestemmingstekst locatie bijgewerkt in `app.json` (kaart **of** eenmalig in een chat) — actief vanaf de volgende build. Privacybeleid: 27 november 2026.
