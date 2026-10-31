/** Help & support centre (Snapchat "Ondersteuning"): FAQ, crisis numbers and a pre-filled support e-mail.
 *  Rendered by app/help.tsx. Public on the web demo (https://snapshot-x.expo.app/help), so it can be the
 *  App Store "Support-URL" (App Store Connect wants an https URL, not mailto:). Pure data/logic, no network. */
import { SUPPORT_EMAIL } from './legal';

export type HelpAction = { label: string; route: string };
export type HelpArticle = { id: string; q: string; a: string[]; keywords?: string; action?: HelpAction };
export type HelpCategory = { id: string; title: string; icon: string; articles: HelpArticle[] };

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'account', title: 'Account en inloggen', icon: 'person-circle-outline', articles: [
    { id: 'wachtwoord-vergeten', q: 'Ik ben mijn wachtwoord vergeten', keywords: 'inloggen reset herstellen kwijt',
      a: ['Kies op het inlogscherm „Wachtwoord vergeten”. Je krijgt een e-mail met een link om een nieuw wachtwoord te kiezen.', 'Geen mail? Kijk in je spam-map of wacht een paar minuten en probeer het opnieuw.'] },
    { id: 'wachtwoord-wijzigen', q: 'Hoe wijzig ik mijn wachtwoord?', keywords: 'veranderen beveiliging uitloggen toestellen',
      a: ['Ga naar Instellingen › Mijn account › Wachtwoord. Vul je huidige en je nieuwe wachtwoord in.', 'Zet „Uitloggen op andere toestellen” aan als je denkt dat iemand anders in je account kan.'],
      action: { label: 'Wachtwoord wijzigen', route: '/change-password' } },
    { id: 'naam-wijzigen', q: 'Hoe wijzig ik mijn naam?', keywords: 'weergavenaam profiel',
      a: ['Ga naar Instellingen › Mijn account › Naam, typ je nieuwe naam en tik op Opslaan. Je gebruikersnaam (@…) blijft hetzelfde.'],
      action: { label: 'Naar Instellingen', route: '/settings' } },
    { id: 'gehackt', q: 'Ik denk dat mijn account gehackt is', keywords: 'hack overgenomen gestolen inbraak',
      a: ['Wijzig meteen je wachtwoord en zet „Uitloggen op andere toestellen” aan.', 'Kom je niet meer in je account? Mail ons via ' + SUPPORT_EMAIL + ' vanaf het e-mailadres van je account.'],
      action: { label: 'Wachtwoord wijzigen', route: '/change-password' } },
    { id: 'account-verwijderen', q: 'Hoe verwijder ik mijn account?', keywords: 'opzeggen stoppen wissen weg',
      a: ['Ga naar Instellingen › Account verwijderen en typ VERWIJDER. Je profiel, berichten, verhalen en opgeslagen media worden definitief verwijderd.', 'Heb je Snapshot X+? Zeg dat apart op in de abonnementen van je Apple ID.'],
      action: { label: 'Account verwijderen', route: '/delete-account' } },
  ] },
  { id: 'snaps', title: 'Snaps, chats en verhalen', icon: 'chatbubbles-outline', articles: [
    { id: 'verdwijnen', q: 'Wanneer verdwijnen snaps en chats?', keywords: 'verwijderd weg bewaren 24 uur',
      a: ['Snaps en chats verdwijnen standaard na het bekijken (of 24 uur daarna). Ongeopende chats worden na 31 dagen verwijderd.', 'Wil je iets houden? Houd een bericht ingedrukt en kies „Opslaan in chat”.'] },
    { id: 'verhaal', q: 'Hoe lang blijft mijn verhaal staan?', keywords: 'story verhalen zichtbaar',
      a: ['Een verhaal is 24 uur zichtbaar. Bij Instellingen › Privacy › Wie kan… kies je wie je nieuwe verhalen ziet.'],
      action: { label: 'Wie kan…', route: '/who-can' } },
    { id: 'streaks', q: 'Hoe werken Snapstreaks?', keywords: 'streak vuur vlam emoji',
      a: ['Stuur elkaar elke dag (binnen 24 uur) een snap. Het getal naast 🔥 telt het aantal dagen.', 'Verschijnt ⌛, dan loopt je streak bijna af: stuur snel een snap.'],
      action: { label: "Vriend-emoji's", route: '/friend-emojis' } },
    { id: 'screenshot', q: 'Ziet de ander dat ik een screenshot maak?', keywords: 'schermafbeelding opname',
      a: ['Ja. In de chat zie je een melding als iemand een screenshot maakt van je snap of chat. Deel dus niets wat je niet wilt laten zien.'] },
    { id: 'meldingen', q: 'Ik krijg geen meldingen', keywords: 'notificaties push geluid',
      a: ['Controleer Instellingen › Meldingen in de app en de meldingen voor Snapshot X in de instellingen van je telefoon.'],
      action: { label: 'Meldingen', route: '/notifications' } },
  ] },
  { id: 'vrienden', title: 'Vrienden en kaart', icon: 'people-outline', articles: [
    { id: 'toevoegen', q: 'Hoe voeg ik vrienden toe?', keywords: 'zoeken gebruikersnaam qr code',
      a: ['Ga naar Vrienden en zoek op gebruikersnaam, of scan elkaars QR-code.'] },
    { id: 'ghost', q: 'Hoe verberg ik mijn locatie?', keywords: 'ghost mode kaart map locatie delen',
      a: ['Op de kaart zet je Ghost mode aan. Dan ziet niemand waar je bent. Je locatie wordt alleen gedeeld als jij dat kiest.'],
      action: { label: 'Locatie en Ghost mode', route: '/map' } },
    { id: 'suggesties', q: 'Ik wil niet in vriendensuggesties staan', keywords: 'snel toevoegen vindbaar',
      a: ['Zet in Instellingen › Privacy „Vindbaar in vriendensuggesties” uit, of zet Snel toevoegen uit bij Wie kan….'],
      action: { label: 'Wie kan…', route: '/who-can' } },
  ] },
  { id: 'veiligheid', title: 'Veiligheid en melden', icon: 'shield-outline', articles: [
    { id: 'melden', q: 'Hoe meld ik iemand of iets?', keywords: 'rapporteren report pesten ongepast',
      a: ['Houd een chat, snap of verhaal ingedrukt en kies „Melden”. Een account meld je via het profiel van die persoon › Account melden.', 'Ons team bekijkt elke melding. Degene die je meldt, ziet niet dat jij het was.'] },
    { id: 'blokkeren', q: 'Hoe blokkeer of deblokkeer ik iemand?', keywords: 'block blokkade',
      a: ['Open het profiel van die persoon en kies Blokkeren. Iemand die je blokkeert kan je geen berichten sturen en ziet je verhalen niet.', 'Deblokkeren doe je via Instellingen › Geblokkeerde gebruikers.'],
      action: { label: 'Geblokkeerde gebruikers', route: '/blocked-users' } },
    { id: 'chantage', q: 'Iemand bedreigt me of wil naaktfoto’s', keywords: 'sextortion chantage afpersing naakt dreigen',
      a: ['Stuur niets en betaal niets. Maak screenshots als bewijs, meld en blokkeer het account.', 'Praat erover met iemand die je vertrouwt. Bij direct gevaar: bel 112. Ook Helpwanted.nl helpt (gratis en anoniem).'] },
  ] },
  { id: 'privacy', title: 'Privacy en gegevens', icon: 'lock-closed-outline', articles: [
    { id: 'download', q: 'Hoe download ik mijn gegevens?', keywords: 'export kopie avg inzage data',
      a: ['Ga naar Instellingen › Mijn gegevens, kies wat je wilt (ook je foto’s en video’s) en download een HTML- of JSON-bestand.'],
      action: { label: 'Mijn gegevens', route: '/my-data' } },
    { id: 'beleid', q: 'Wat doen jullie met mijn gegevens?', keywords: 'privacybeleid avg',
      a: ['Dat lees je in ons Privacybeleid. We verkopen je gegevens niet en tonen geen advertenties van derden.'],
      action: { label: 'Privacybeleid', route: '/privacy' } },
  ] },
  { id: 'plus', title: 'Snapshot X+ en betalingen', icon: 'sparkles-outline', articles: [
    { id: 'opzeggen', q: 'Hoe zeg ik Snapshot X+ op?', keywords: 'abonnement stoppen annuleren',
      a: ['Op iPhone: Instellingen van je telefoon › je naam › Abonnementen › Snapshot X+. In de app vind je dit ook onder Instellingen › Abonnement beheren.', 'Opzeggen kan tot 24 uur voor het einde van de periode.'],
      action: { label: 'Snapshot X+', route: '/plus' } },
    { id: 'terugbetaling', q: 'Kan ik mijn geld terugkrijgen?', keywords: 'refund terugbetaling geld',
      a: ['Betalingen lopen via de App Store. Vraag een terugbetaling aan via reportaproblem.apple.com.'] },
    { id: 'herstellen', q: 'Mijn aankoop is weg', keywords: 'herstellen restore kwijt nieuwe telefoon',
      a: ['Log in met hetzelfde account en hetzelfde Apple ID. Open Snapshot X+ en kies „Aankopen herstellen”.'],
      action: { label: 'Snapshot X+', route: '/plus' } },
  ] },
];

/** Crisis numbers shown at the top (Netherlands). */
export const CRISIS_LINES = [
  { label: 'Direct gevaar', number: '112', tel: 'tel:112' },
  { label: '113 Zelfmoordpreventie', number: '0800-0113', tel: 'tel:08000113' },
  { label: 'Kindertelefoon (tot 18)', number: '0800-0432', tel: 'tel:08000432' },
] as const;

export const SUPPORT_TOPICS = [
  { id: 'account', label: 'Account en inloggen' },
  { id: 'bug', label: 'Iets werkt niet' },
  { id: 'veiligheid', label: 'Veiligheid' },
  { id: 'privacy', label: 'Privacy en gegevens' },
  { id: 'plus', label: 'Snapshot X+ en betalingen' },
  { id: 'anders', label: 'Iets anders' },
] as const;
export type SupportTopicId = (typeof SUPPORT_TOPICS)[number]['id'];

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toLocaleLowerCase();

export type HelpHit = { category: HelpCategory; article: HelpArticle };
/** All-words search over question, answer and keywords (accent/case-insensitive). Empty query → []. */
export function searchHelp(query: string, cats: HelpCategory[] = HELP_CATEGORIES): HelpHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: (HelpHit & { score: number })[] = [];
  for (const category of cats) for (const article of category.articles) {
    const q = fold(article.q), text = fold([article.q, ...article.a, article.keywords ?? '', category.title].join(' '));
    if (!words.every(w => text.includes(w))) continue;
    hits.push({ category, article, score: words.filter(w => q.includes(w)).length });
  }
  return hits.sort((x, y) => y.score - x.score).map(({ category, article }) => ({ category, article }));
}

export function findArticle(id: string, cats: HelpCategory[] = HELP_CATEGORIES): HelpHit | null {
  for (const category of cats) { const article = category.articles.find(a => a.id === id); if (article) return { category, article }; }
  return null;
}

export type SupportMailInput = { topic: SupportTopicId; message?: string; handle?: string; version?: string; platform?: string };
/** mailto: URL with subject + body (encodeURIComponent, so spaces are %20 — mail apps treat "+" literally). */
export function supportMailto(input: SupportMailInput): string {
  const topic = SUPPORT_TOPICS.find(t => t.id === input.topic) ?? SUPPORT_TOPICS[SUPPORT_TOPICS.length - 1];
  const subject = `Snapshot X support: ${topic.label}`;
  const lines = [
    (input.message ?? '').trim() || 'Beschrijf hier je vraag of probleem:',
    '',
    '—',
    `Onderwerp: ${topic.label}`,
    input.handle ? `Gebruikersnaam: @${input.handle.replace(/^@/, '')}` : '',
    `App: Snapshot X ${input.version ?? ''}`.trim(),
    input.platform ? `Toestel: ${input.platform}` : '',
  ].filter((l, i) => l !== '' || i === 1);
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
