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
| Locatie | Precieze locatie | **ja** (alleen bij delen op de kaart) | App-functionaliteit |
| Berichten | Andere in-app-berichten (chats, snaps) | nee | App-functionaliteit |
| Foto's en video's | Foto's, Video's | ja (alleen wat je verstuurt/bewaart) | App-functionaliteit |
| Audiobestanden | Spraak- of geluidsopnamen (spraakberichten) | ja | App-functionaliteit |
| Financiële info | Aankoopgeschiedenis (Snapshot X+, via Google Play/RevenueCat; geen betaalgegevens) | ja | App-functionaliteit |
| App-activiteit | App-interacties (bekeken/gelezen, reacties), Andere door gebruikers gemaakte inhoud (verhalen, polls, personage) | nee | App-functionaliteit |
| App-info en prestaties | — niet verzameld (geen crashrapportage-SDK) | | |
| Apparaat- of andere ID's | Apparaat-ID (installatie-ID, pushtoken) + IP-adres bij inloggen | nee | App-functionaliteit, Fraudepreventie en beveiliging |

**Niet** verzameld: contacten/adresboek, agenda, gezondheid, financiële rekeninggegevens, webgeschiedenis, zoekgeschiedenis, geïnstalleerde apps, SMS/oproeplog.

Verwerking is **niet tijdelijk** (gegevens worden opgeslagen), behalve live gesprekken (niet opgeslagen).

## Controle bij elke release
- Nieuwe SDK of permissie? Werk dit document, `app.json` (`ios.privacyManifests` + `android.permissions/blockedPermissions`) en `lib/legal.ts` samen bij. `lib/android-config.test.mjs` bewaakt de Android-permissies.
