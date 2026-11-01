/** App Store launch readiness: Privacybeleid + Gebruiksvoorwaarden (Apple guideline 5.1.1: the privacy policy must be
 *  reachable inside the app, and its URL goes into App Store Connect). Rendered by app/privacy.tsx and app/voorwaarden.tsx;
 *  on the web they are public pages (https://snapshot-x.nl/privacy and /voorwaarden), no login needed.
 *  The text describes what the app really does (see the migrations / Edge Functions it names). */
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { route: '/privacy' | '/voorwaarden' | '/account-verwijderen'; title: string; updated: string; intro: string; sections: LegalSection[] };

/** Support contact (provided by Kevin, 30 okt 2026). Also in app.json extra.supportEmail + App Store metadata. */
export const SUPPORT_EMAIL = 'support@snapshot-x.nl';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const SUPPORT_LINK = { label: 'Contact en support', description: SUPPORT_EMAIL, url: SUPPORT_MAILTO } as const;

export const LEGAL_UPDATED = '1 november 2026';
export const LEGAL_LINKS = {
  privacy: { label: 'Privacybeleid', description: 'Welke gegevens we gebruiken en waarom', route: '/privacy' },
  terms: { label: 'Gebruiksvoorwaarden', description: 'De afspraken voor het gebruik van Snapshot X', route: '/voorwaarden' },
} as const;
export const LEGAL_CONSENT = { before: 'Door een account aan te maken ga je akkoord met de ', terms: 'Gebruiksvoorwaarden', middle: ' en het ', privacy: 'Privacybeleid', after: '.' } as const;

export const PRIVACY: LegalDoc = {
  route: '/privacy', title: 'Privacybeleid', updated: LEGAL_UPDATED,
  intro: 'Snapshot X is een app om met vrienden foto’s, video’s en berichten te delen. Hier lees je welke gegevens we daarvoor gebruiken, waarom, hoe lang we ze bewaren en welke keuzes je hebt.',
  sections: [
    { heading: 'Welke gegevens we verwerken', body: [
      'Account: gebruikersnaam, weergavenaam, e-mailadres, wachtwoord (versleuteld opgeslagen), geboortedatum en, als je dat invult, je mobiele nummer.',
      'Inhoud die je deelt: snaps, chatberichten, spraakberichten, verhalen, herinneringen, chat-achtergronden en je personage (avatar).',
      'Vrienden en gebruik: je vrienden, verzoeken, blokkeringen, reacties en of een snap of chat is bekeken.',
      'Locatie: alleen als je die zelf op de kaart deelt. Met Ghost mode deel je niets.',
      'Toestel en beveiliging: een pushmeldingstoken, de naam van je toestel en het IP-adres bij het inloggen, zodat jij je inloggeschiedenis kunt zien en wij misbruik kunnen opsporen.',
    ] },
    { heading: 'Camera, microfoon en foto’s', body: [
      'De app vraagt pas toegang tot je camera, microfoon of fotobibliotheek als je een functie gebruikt die dat nodig heeft (snap maken, bellen, spraakbericht, foto versturen of als chat-achtergrond kiezen). Je kunt dit altijd uitzetten in de instellingen van je telefoon.',
    ] },
    { heading: 'Waarvoor we gegevens gebruiken', body: [
      'Om de app te laten werken: berichten afleveren, verhalen tonen, vrienden voorstellen en meldingen sturen.',
      'Voor veiligheid: meldingen van gebruikers beoordelen, misbruik tegengaan en strengere standaardinstellingen voor gebruikers van 13 tot en met 17 jaar.',
      'Voor Snapshot X+: bijhouden welk abonnement je hebt. Betalingen lopen via de App Store (iPhone) of Google Play (Android); wij zien geen betaalgegevens.',
      'We verkopen je gegevens niet en gebruiken ze niet voor advertenties van derden.',
    ] },
    { heading: 'Hoe lang we bewaren', body: [
      'Snaps en chats verdwijnen standaard na het bekijken (of 24 uur daarna). Ongeopende chats worden na 31 dagen verwijderd. Berichten die je in de chat bewaart, blijven tot jij of de ander ze verwijdert.',
      'Verhalen zijn 24 uur zichtbaar. Herinneringen bewaren we tot je ze zelf verwijdert.',
      'Verlopen foto’s en video’s worden automatisch uit onze opslag verwijderd.',
    ] },
    { heading: 'Wie je gegevens kan zien', body: [
      'Alleen de mensen met wie je iets deelt. Wie je blokkeert, kan je niet meer berichten en ziet je verhalen niet meer.',
      'Onze moderatoren zien alleen wat nodig is om een melding te beoordelen.',
      'We gebruiken dienstverleners voor opslag, inloggen, abonnementen en pushmeldingen (zoals Supabase, Expo, RevenueCat, Apple en Google). Zij verwerken gegevens alleen in onze opdracht.',
    ] },
    { heading: 'Jouw rechten en keuzes', body: [
      'Je kunt je naam, privacy-instellingen, locatie delen en vindbaarheid in vriendensuggesties zelf aanpassen in Instellingen.',
      'Je kunt via Instellingen › Mijn gegevens meteen een kopie van je gegevens downloaden (HTML- en/of JSON-bestand).',
      'Je kunt je account en je inhoud op elk moment zelf definitief verwijderen via Instellingen › Account verwijderen. Heb je de app niet meer? Kijk dan op snapshot-x.nl/account-verwijderen.',
      'Je hebt het recht op inzage, correctie, verwijdering, beperking en bezwaar (AVG). Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.',
    ] },
    { heading: 'Leeftijd', body: ['Snapshot X is voor iedereen van 13 jaar en ouder. Ben je jonger, maak dan geen account aan.'] },
    { heading: 'Wijzigingen', body: ['Als we dit beleid aanpassen, zie je hier de nieuwe datum. Bij grote wijzigingen laten we het je in de app weten.'] },
  ],
};

const CONTACT: LegalSection = { heading: 'Contact', body: [`Vragen, of een verzoek over je gegevens (inzage, correctie, verwijdering)? Mail ons via ${SUPPORT_EMAIL}. We reageren zo snel mogelijk.`] };
PRIVACY.sections.push(CONTACT);

export const TERMS: LegalDoc = {
  route: '/voorwaarden', title: 'Gebruiksvoorwaarden', updated: LEGAL_UPDATED,
  intro: 'Fijn dat je Snapshot X gebruikt. Door een account aan te maken ga je akkoord met deze voorwaarden en met ons Privacybeleid.',
  sections: [
    { heading: 'Je account', body: [
      'Je moet minimaal 13 jaar oud zijn. Gebruik je echte geboortedatum.',
      'Je bent zelf verantwoordelijk voor je account en wachtwoord. Deel je account niet met anderen.',
    ] },
    { heading: 'Wat niet mag', body: [
      'We tolereren geen aanstootgevende inhoud en geen misbruik van andere gebruikers. Dus niet:',
      'Pesten, intimideren, bedreigen of haatdragende inhoud delen.',
      'Naaktbeelden of seksuele inhoud van minderjarigen, of seksuele inhoud van iemand zonder diens toestemming. Dit melden we bij de bevoegde instanties.',
      'Geweld verheerlijken, illegale goederen verkopen, oplichting, spam of je voordoen als iemand anders.',
      'Inhoud delen waarop je geen rechten hebt, of de app hacken, misbruiken of automatisch uitlezen.',
    ] },
    { heading: 'Melden en blokkeren', body: [
      'Je kunt chatberichten, snaps en verhalen melden en gebruikers blokkeren. We bekijken meldingen zo snel mogelijk, verwijderen inhoud die in strijd is met deze voorwaarden en kunnen accounts beperken of blokkeren.',
    ] },
    { heading: 'Jouw inhoud', body: [
      'Wat je deelt blijft van jou. Je geeft ons alleen toestemming om het op te slaan en te tonen aan de mensen met wie je het deelt, zolang dat nodig is om de app te laten werken.',
      'Let op: ontvangers kunnen een screenshot maken. Deel niets wat je niet wilt laten zien.',
    ] },
    { heading: 'Snapshot X+', body: [
      'Snapshot X+ is een optioneel abonnement met extra functies. Het wordt via je App Store-account (iPhone) of Google Play-account (Android) afgerekend en automatisch verlengd tot je het opzegt in de abonnementsinstellingen van je Apple ID of in Google Play › Betalingen en abonnementen, uiterlijk 24 uur voor het einde van de periode.',
      'Terugbetalingen lopen via Apple (reportaproblem.apple.com) of Google Play, volgens hun regels.',
    ] },
    { heading: 'Beëindigen', body: [
      'Je kunt je account altijd zelf verwijderen via Instellingen › Account verwijderen. Bij ernstige of herhaalde overtredingen kunnen wij je account beëindigen.',
    ] },
    { heading: 'Aansprakelijkheid', body: [
      'We doen ons best om Snapshot X veilig en beschikbaar te houden, maar kunnen niet garanderen dat de app altijd foutloos werkt. Op deze voorwaarden is Nederlands recht van toepassing.',
    ] },
    CONTACT,
  ],
};

export const LEGAL_DOCS = [PRIVACY, TERMS] as const;

/** Public account-deletion page (Google Play Data safety requires a web URL where users can request deletion without the
 *  app): https://snapshot-x.nl/account-verwijderen. Works signed out; signed in it links to the in-app deletion screen. */
export const ACCOUNT_DELETION_URL = 'https://snapshot-x.nl/account-verwijderen';
export const ACCOUNT_DELETION: LegalDoc = {
  route: '/account-verwijderen', title: 'Account verwijderen', updated: LEGAL_UPDATED,
  intro: 'Zo verwijder je je Snapshot X-account van Vonk Byte en de gegevens die erbij horen, ook als je de app niet meer op je telefoon hebt.',
  sections: [
    { heading: 'Zelf verwijderen (direct)', body: [
      'Open de Snapshot X-app op je iPhone of Android, of log in op snapshot-x.nl.',
      'Ga naar Instellingen › Account verwijderen, typ VERWIJDER en bevestig. Je account wordt meteen definitief verwijderd.',
    ] },
    { heading: 'Zonder de app', body: [
      `Mail naar ${SUPPORT_EMAIL} vanaf het e-mailadres van je account, met als onderwerp „Account verwijderen” en je gebruikersnaam.`,
      'We controleren of het verzoek echt van jou komt, verwijderen je account binnen 30 dagen en sturen je een bevestiging.',
    ] },
    { heading: 'Wat we verwijderen', body: [
      'Je profiel, gebruikersnaam, weergavenaam, e-mailadres, wachtwoord, geboortedatum en telefoonnummer.',
      'Je vrienden, verzoeken, chats, berichten, snaps, verhalen, Herinneringen, chat-achtergronden, je avatar en de kleding uit de Kast.',
      'Je gedeelde locatie, pushmeldingstokens en inloggeschiedenis. Berichten en verhalen die je hebt gemaakt verdwijnen ook voor anderen.',
    ] },
    { heading: 'Wat we kort kunnen bewaren', body: [
      'Alleen wat de wet verplicht of wat nodig is om ernstig misbruik tegen te gaan (zoals een actieve blokkade wegens overtredingen), en zo kort mogelijk.',
      'Een abonnement loopt via de App Store of Google Play. Zeg dat daar zelf op; verwijderen van je account stopt het abonnement niet automatisch.',
    ] },
    { heading: 'Liever eerst een kopie?', body: ['Download vooraf je gegevens via Instellingen › Mijn gegevens (HTML en/of JSON).'] },
    CONTACT,
  ],
};
export function legalDoc(route: string): LegalDoc | null {
  return [...LEGAL_DOCS, ACCOUNT_DELETION].find(d => d.route === route || d.route === `/${route.replace(/^\//, '')}`) ?? null;
}
