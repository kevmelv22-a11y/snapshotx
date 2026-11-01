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

## Child Safety Standards (verplicht voor sociale apps)
Play vraagt een gepubliceerde norm tegen kindermisbruik (CSAE) + contactpersoon:
- Norm: gebruiksvoorwaarden, sectie "Wat niet mag" (seksuele inhoud van minderjarigen wordt verwijderd en gemeld bij de bevoegde instanties).
- Contact voor CSAM-meldingen: support@snapshot-x.nl. TODO(Kevin): bevestigen wie dit leest.
- Meldfunctie in de app: ja (Melden › reden „Naaktheid of seksuele inhoud”, lib/report-reasons.ts).
