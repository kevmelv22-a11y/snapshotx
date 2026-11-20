# Google Play — contentclassificatie (IARC) en doelgroep

Concept-antwoorden voor Play Console › App-content › Contentclassificatie en › Doelgroep en content. Nog **niet** ingevuld.

## IARC-vragenlijst (categorie: "Social of communicatie")
| Vraag | Antwoord | Toelichting |
|---|---|---|
| Kunnen gebruikers met elkaar communiceren of inhoud delen (chat, foto's, video, spraak)? | **Ja** | Chats, snaps, verhalen, gesprekken |
| Kunnen gebruikers hun precieze locatie met anderen delen? | **Ja** | Alleen als ze zelf delen op de vriendenkaart; Ghost mode |
| Kunnen gebruikers digitale goederen kopen? | **Ja** | Snapshot X+ (abonnement en lifetime) via Google Play Billing |
| Bevat de app gokken of gesimuleerd gokken? | Nee | |
| Bevat de app door de ontwikkelaar aangeboden geweld, seks, grof taalgebruik, drugs? | Nee | Alleen door gebruikers gemaakte inhoud, met moderatie |
| Kan de app onbeperkt toegang geven tot het internet (browser)? | Nee | |
| Is er moderatie van door gebruikers gemaakte inhoud? | **Ja** | Melden + blokkeren in de app, staffpaneel, woordfilter op namen |
| Deelt de app persoonsgegevens met derden? | Nee (alleen verwerkers in opdracht) | Zie DATA_SAFETY_NL.md |
| Bevat de app door AI gegenereerde inhoud? (vraag in App-content / AI-verklaring) | **Ja** | Mijn AI: tekst-chatbot (geen afbeeldingen). Systeemprompt verbiedt seksuele/gewelddadige/illegale inhoud, verwijst bij zelfbeschadiging naar 113/112, zegt eerlijk dat het een AI is (`supabase/functions/my-ai/logic.ts`) |
| Bevat de app spellen met prijzen of gokken? | Nee | Spelletje in de chat (boter, kaas en eieren) is gratis, zonder inzet of prijzen |

Verwachte uitkomst: PEGI 12 / USK 12 / ESRB Teen ("Users Interact", "Shares Location", "In-App Purchases"). Snapchat heeft PEGI 12 / Teen.

## Doelgroep en content
- Leeftijdsgroepen: **13–15, 16–17 en 18+**. Niet: 12 en jonger (registratie onder 13 wordt geweigerd: `lib/auth-form.ts` + server-side verjaardagsregels).
- "Kan de app onbedoeld kinderen aantrekken?": **Nee** (geen kinderthema's; personage is een algemene avatar).
- Daarom valt de app **niet** onder het Families-beleid.
- Tieners (13–17): strengere standaardinstellingen (privacy, vindbaarheid) — vermeld in het privacybeleid.

## Beleid voor door gebruikers gemaakte inhoud (UGC) — checklist
- [x] Gebruiksvoorwaarden verbieden aanstootgevende inhoud (https://snapshot-x.nl/voorwaarden).
- [x] Melden van berichten, snaps, verhalen en accounts in de app.
- [x] Gebruikers blokkeren.
- [x] Moderatie door staff (staffpaneel met audit-log, bans).
- [x] Contact: support@snapshot-x.nl.

## Beleid voor generatieve AI (Mijn AI) — checklist (20 nov 2026)
Google Play eist voor apps met generatieve AI dat gebruikers aanstootgevende AI-inhoud **in de app** kunnen melden en dat de AI geen verboden inhoud maakt.
- [x] Melden in de app: vlaggetje naast elk AI-antwoord (of lang indrukken) → reden kiezen → opgeslagen in `sx_ai_reports` (alleen eigen melding invoegen; lezen alleen staff/service_role).
- [x] Veiligheidsprompt voor tieners (13+), geen persoonsgegevens vragen, 113/112-verwijzing, geen medisch/juridisch advies als feit.
- [x] Duidelijk label: "AI-chatbot · geen mens" + disclaimer bovenaan de chat.
- [x] Misbruikgrens: 40 berichten per gebruiker per dag (server-side).
- [ ] TODO(Kevin): bepalen wie `sx_ai_reports` bekijkt (nu via SQL; nog niet in het staffpaneel).

## Child Safety Standards (verplicht voor sociale apps)
Play vraagt een gepubliceerde norm tegen kindermisbruik (CSAE) + contactpersoon:
- Norm: gebruiksvoorwaarden, sectie "Wat niet mag" (seksuele inhoud van minderjarigen wordt verwijderd en gemeld bij de bevoegde instanties).
- Contact voor CSAM-meldingen: support@snapshot-x.nl. TODO(Kevin): bevestigen wie dit leest.
- Meldfunctie in de app: ja (Melden › reden „Naaktheid of seksuele inhoud”, lib/report-reasons.ts).
