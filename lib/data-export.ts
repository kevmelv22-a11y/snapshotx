/**
 * "Mijn gegevens" (Snapchat: Settings › My Data / Download My Data). AVG art. 15 + 20: a user can download a copy of
 * the data Snapshot X keeps about them, in a machine-readable file (JSON). Everything is read with the user's own
 * session, so RLS decides what is visible: the export never contains more than the app itself can show this user.
 * Media bytes are not embedded (storage paths only); expired chats/stories are left out because the server deletes them.
 */
export type ExportCategory = 'account' | 'friends' | 'chats' | 'stories' | 'memories' | 'location';
type Row = Record<string, unknown>;

export const EXPORT_CATEGORIES: { key: ExportCategory; label: string; description: string }[] = [
  { key: 'account', label: 'Account en profiel', description: 'Gebruikersnaam, naam, e-mailadres, aanmaakdatum en voorkeuren' },
  { key: 'friends', label: 'Vrienden', description: 'Je vrienden, vriendschapsverzoeken en geblokkeerde accounts' },
  { key: 'chats', label: 'Chatgeschiedenis', description: 'Chats en snaps die nog niet verwijderd zijn, met afzender en tijd' },
  { key: 'stories', label: 'Verhalen', description: 'Je eigen verhalen die nu nog zichtbaar zijn' },
  { key: 'memories', label: 'Herinneringen', description: 'Lijst van je opgeslagen herinneringen (zonder de foto’s zelf)' },
  { key: 'location', label: 'Locatie', description: 'Je laatst gedeelde locatie en kaartinstellingen' },
];
export const ALL_CATEGORIES: ExportCategory[] = EXPORT_CATEGORIES.map(c => c.key);
export const EXPORT_ERRORS = { none: 'Kies minstens één categorie.', signedOut: 'Log in om je gegevens te downloaden.' } as const;

export type ExportSource = {
  profile?: Row | null; preferences?: Row | null; friends?: Row[]; requests?: Row[]; blocks?: Row[]; people?: Row[];
  threads?: Row[]; members?: Row[]; messages?: Row[]; stories?: Row[]; memories?: Row[]; location?: Row | null;
};
export type ExportCounts = Partial<Record<ExportCategory, number>>;
export type DataExport = { file: Record<string, unknown>; counts: ExportCounts; filename: string };

const str = (v: unknown) => (v == null ? null : String(v));
const expired = (row: Row, nowIso: string) => row.expires_at != null && String(row.expires_at) <= nowIso;
const pick = (row: Row | null | undefined, keys: string[]) => row ? Object.fromEntries(keys.filter(k => row[k] !== undefined).map(k => [k, row[k] ?? null])) : null;

/** "snapshotx-mijn-gegevens-2026-10-29.json" (local date of the export). */
export function exportFilename(now: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `snapshotx-mijn-gegevens-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Pure: shapes the rows read for `uid` into the downloadable file. Only the chosen categories end up in the file. */
export function buildDataExport(input: { uid: string; email?: string | null; now: Date; categories: ExportCategory[]; source: ExportSource }): DataExport {
  const { uid, email, now, source: s } = input, nowIso = now.toISOString();
  const chosen = new Set(input.categories.filter(c => ALL_CATEGORIES.includes(c)));
  const names = new Map<string, string>();
  for (const p of [...(s.people ?? []), ...(s.profile ? [s.profile] : [])]) names.set(String(p.id), p.username ? `@${p.username}` : String(p.display_name ?? p.id));
  const who = (id: unknown) => (id === uid ? 'jij' : names.get(String(id)) ?? 'onbekend account');
  const file: Record<string, unknown> = {
    app: 'Snapshot X', type: 'Mijn gegevens', generated_at: nowIso, user_id: uid,
    note: 'Kopie van je gegevens (AVG art. 15/20). Foto’s en video’s staan er als opslagpad in, niet als bestand. Verwijderde of verlopen chats en verhalen bestaan niet meer en staan er dus niet in.',
  };
  const counts: ExportCounts = {};
  if (chosen.has('account')) {
    file.account = { ...pick(s.profile, ['username', 'display_name', 'created_at', 'birthdate', 'phone', 'is_verified']), email: email ?? null, preferences: pick(s.preferences, ['language', 'find_me']) };
    counts.account = s.profile ? 1 : 0;
  }
  if (chosen.has('friends')) {
    const friends = (s.friends ?? []).filter(f => f.user_id === uid).map(f => ({ friend: who(f.friend_id), since: str(f.created_at) }));
    const requests = (s.requests ?? []).filter(r => r.sender_id === uid || r.recipient_id === uid)
      .map(r => ({ direction: r.sender_id === uid ? 'verstuurd' : 'ontvangen', other: who(r.sender_id === uid ? r.recipient_id : r.sender_id), status: str(r.status), at: str(r.created_at) }));
    const blocked = (s.blocks ?? []).filter(b => b.blocker_id === uid).map(b => ({ account: who(b.blocked_id), at: str(b.created_at) }));
    file.friends = { friends, requests, blocked };
    counts.friends = friends.length;
  }
  if (chosen.has('chats')) {
    const mine = new Set((s.members ?? []).filter(m => m.user_id === uid).map(m => String(m.thread_id)));
    const live = (s.messages ?? []).filter(m => mine.has(String(m.thread_id)) && !expired(m, nowIso) && !m.unsent_at);
    const chats = (s.threads ?? []).filter(t => mine.has(String(t.id))).map(t => {
      const members = (s.members ?? []).filter(m => m.thread_id === t.id && m.user_id !== uid).map(m => who(m.user_id));
      const messages = live.filter(m => m.thread_id === t.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map(m => ({ from: who(m.sender_id), at: str(m.created_at), kind: str(m.kind), text: m.kind === 'snap' ? null : str(m.body), media: str(m.media_path), saved: !!m.saved }));
      return { chat: t.title ? String(t.title) : members.join(', ') || 'chat', group: !!t.is_group || members.length > 1, members, messages };
    }).filter(c => c.messages.length).sort((a, b) => String(b.messages.at(-1)?.at).localeCompare(String(a.messages.at(-1)?.at)));
    file.chats = chats;
    counts.chats = chats.reduce((n, c) => n + c.messages.length, 0);
  }
  if (chosen.has('stories')) {
    const stories = (s.stories ?? []).filter(x => x.owner_id === uid && !expired(x, nowIso))
      .map(x => ({ at: str(x.created_at), caption: str(x.caption), visibility: str(x.visibility), media_type: str(x.media_type), media: str(x.media_path) }));
    file.stories = stories; counts.stories = stories.length;
  }
  if (chosen.has('memories')) {
    const memories = (s.memories ?? []).filter(x => x.owner_id === uid && !x.deleted_at)
      .map(x => ({ at: str(x.created_at), caption: str(x.caption), media_type: str(x.media_type), private: !!x.private, media: x.private ? null : str(x.storage_path) }));
    file.memories = memories; counts.memories = memories.length;
  }
  if (chosen.has('location')) {
    const l = s.location && s.location.user_id === uid ? s.location : null;
    file.location = l ? { sharing: !!l.sharing, audience: str(l.share_audience), ghost_mode: !!l.ghost_forever || (l.ghost_until != null && String(l.ghost_until) > nowIso), latitude: l.latitude ?? null, longitude: l.longitude ?? null, updated_at: str(l.updated_at) } : null;
    counts.location = l ? 1 : 0;
  }
  return { file, counts, filename: exportFilename(now) };
}

/** One-line Dutch summary for the result card, e.g. "4 vrienden · 31 chats · 2 herinneringen". */
export function exportSummary(counts: ExportCounts) {
  const n = (k: ExportCategory, one: string, many: string) => counts[k] == null ? null : `${counts[k]} ${counts[k] === 1 ? one : many}`;
  return [n('friends', 'vriend', 'vrienden'), n('chats', 'chat', 'chats'), n('stories', 'verhaal', 'verhalen'), n('memories', 'herinnering', 'herinneringen')].filter(Boolean).join(' · ') || 'Accountgegevens';
}

type Q = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Chain = { select(c: string): Chain; eq(k: string, v: unknown): Chain; in(k: string, v: unknown[]): Chain; maybeSingle(): Q } & Q;
type Client = { from(t: string): unknown };

/** Reads only what the chosen categories need, each query scoped to the signed-in user. Throws on the first error. */
export async function collectMyData(client: Client, uid: string, categories: ExportCategory[]): Promise<ExportSource> {
  const c = new Set(categories), from = (t: string) => (client.from(t) as Chain).select('*');
  const rows = async (q: Q) => { const r = await q; if (r.error) throw new Error(r.error.message); return (r.data ?? []) as Row[] };
  const one = async (q: Q) => { const r = await q; if (r.error) throw new Error(r.error.message); return (r.data ?? null) as Row | null };
  const s: ExportSource = {};
  if (c.has('account')) [s.profile, s.preferences] = await Promise.all([one(from('profiles').eq('id', uid).maybeSingle()), one(from('sx_preferences').eq('user_id', uid).maybeSingle())]);
  else s.profile = await one(from('profiles').eq('id', uid).maybeSingle());
  if (c.has('friends')) [s.friends, s.requests, s.blocks] = await Promise.all([
    rows(from('sx_friends').eq('user_id', uid)), Promise.all([rows(from('sx_friend_requests').eq('sender_id', uid)), rows(from('sx_friend_requests').eq('recipient_id', uid))]).then(([a, b]) => [...a, ...b]), rows(from('sx_blocks').eq('blocker_id', uid))]);
  if (c.has('chats')) {
    const own = await rows(from('sx_members').eq('user_id', uid)), ids = own.map(m => m.thread_id);
    if (ids.length) [s.threads, s.members, s.messages] = await Promise.all([rows(from('sx_threads').in('id', ids)), rows(from('sx_members').in('thread_id', ids)), rows(from('sx_messages').in('thread_id', ids))]);
  }
  if (c.has('stories')) s.stories = await rows(from('sx_stories').eq('owner_id', uid));
  if (c.has('memories')) s.memories = await rows(from('memories').eq('owner_id', uid));
  if (c.has('location')) s.location = await one(from('sx_locations').eq('user_id', uid).maybeSingle());
  const other = new Set<unknown>();
  s.friends?.forEach(f => other.add(f.friend_id)); s.blocks?.forEach(b => other.add(b.blocked_id)); s.members?.forEach(m => other.add(m.user_id));
  s.requests?.forEach(r => { other.add(r.sender_id); other.add(r.recipient_id) }); other.delete(uid);
  if (other.size) s.people = await rows((client.from('profiles') as Chain).select('id,username,display_name').in('id', [...other]));
  return s;
}

/** Snapchat offers "HTML" (readable in a browser) and "JSON" (machine-readable) — or both. */
export type ExportFormat = 'html' | 'json' | 'both';
export const EXPORT_FORMATS: { key: ExportFormat; label: string; description: string }[] = [
  { key: 'html', label: 'HTML', description: 'Leesbaar in je browser' },
  { key: 'json', label: 'JSON', description: 'Voor andere apps' },
  { key: 'both', label: 'Beide', description: 'HTML + JSON' },
];
export const formatFilenames = (json: string, format: ExportFormat) =>
  format === 'json' ? [json] : format === 'html' ? [json.replace(/\.json$/, '.html')] : [json.replace(/\.json$/, '.html'), json];

/** HTML-escape (also quotes, the values end up inside text and attributes). */
export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** "31-10-2026 14:05" in the device's local time; unknown/invalid → "—". */
export function formatExportDate(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type R = Record<string, unknown>;
const arr = (v: unknown): R[] => (Array.isArray(v) ? (v as R[]) : []);
const KIND: Record<string, string> = { text: 'Bericht', snap: 'Snap', photo: 'Foto', video: 'Video', system: 'Melding', audio: 'Spraakbericht', sticker: 'Sticker' };
const AUDIENCE: Record<string, string> = { friends: 'Vrienden', everyone: 'Iedereen', custom: 'Aangepast', best_friends: 'Beste vrienden' };
function table(head: string[], rows: unknown[][], empty: string) {
  if (!rows.length) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<table><thead><tr>${head.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/**
 * Readable "Mijn gegevens" page (Snapchat HTML export): one self-contained HTML file with a section per chosen
 * category, built from the same object as the JSON (buildDataExport().file). Every value is escaped; no scripts,
 * no external resources, so it opens safely offline in any browser.
 */
export function renderExportHtml(file: Record<string, unknown>): string {
  const parts: string[] = [];
  const nav: string[] = [];
  const section = (id: string, title: string, body: string) => { nav.push(`<a href="#${id}">${escapeHtml(title)}</a>`); parts.push(`<section id="${id}"><h2>${escapeHtml(title)}</h2>${body}</section>`); };
  if ('account' in file) {
    const a = (file.account ?? {}) as R, pref = (a.preferences ?? {}) as R;
    section('account', 'Account', table(['Gegeven', 'Waarde'], [
      ['Gebruikersnaam', a.username ? `@${a.username}` : '—'], ['Weergavenaam', a.display_name], ['E-mailadres', a.email],
      ['Geboortedatum', a.birthdate], ['Telefoonnummer', a.phone], ['Account gemaakt op', formatExportDate(a.created_at)],
      ['Geverifieerd', a.is_verified ? 'Ja' : 'Nee'], ['Taal', pref.language === 'nl' ? 'Nederlands' : pref.language === 'en' ? 'Engels' : pref.language], ['Vindbaar voor anderen', pref.find_me == null ? '—' : pref.find_me ? 'Ja' : 'Nee'],
    ], 'Geen accountgegevens.'));
  }
  if ('friends' in file) {
    const f = (file.friends ?? {}) as R;
    section('friends', 'Vrienden',
      `<h3>Mijn vrienden (${arr(f.friends).length})</h3>` + table(['Vriend', 'Vrienden sinds'], arr(f.friends).map(x => [x.friend, formatExportDate(x.since)]), 'Nog geen vrienden.') +
      `<h3>Vriendschapsverzoeken</h3>` + table(['Richting', 'Account', 'Status', 'Datum'], arr(f.requests).map(x => [x.direction, x.other, x.status, formatExportDate(x.at)]), 'Geen verzoeken.') +
      `<h3>Geblokkeerd</h3>` + table(['Account', 'Sinds'], arr(f.blocked).map(x => [x.account, formatExportDate(x.at)]), 'Niemand geblokkeerd.'));
  }
  if ('chats' in file) {
    const chats = arr(file.chats);
    section('chats', 'Chats', chats.length ? chats.map(c => `<h3>${escapeHtml(c.chat)}${c.group ? ' <span class="tag">Groep</span>' : ''}</h3>` +
      `<ol class="chat">${arr(c.messages).map(m => `<li class="${m.from === 'jij' ? 'me' : ''}"><span class="from">${escapeHtml(m.from)}</span> <span class="at">${escapeHtml(formatExportDate(m.at))}</span>${m.saved ? ' <span class="tag">Bewaard</span>' : ''}<div>${m.text != null && m.text !== '' ? escapeHtml(m.text) : `<em>${escapeHtml(KIND[String(m.kind)] ?? 'Bericht')}${m.media ? ` · ${escapeHtml(m.media)}` : ''}</em>`}</div></li>`).join('')}</ol>`).join('')
      : '<p class="empty">Geen bewaarde chats.</p>');
  }
  if ('stories' in file) section('stories', 'Verhalen', table(['Datum', 'Bijschrift', 'Wie mag kijken', 'Type', 'Bestand'], arr(file.stories).map(x => [formatExportDate(x.at), x.caption, AUDIENCE[String(x.visibility)] ?? x.visibility, x.media_type, x.media]), 'Geen actieve verhalen.'));
  if ('memories' in file) section('memories', 'Herinneringen', table(['Datum', 'Bijschrift', 'Type', 'Privé (Alleen voor mij)', 'Bestand'], arr(file.memories).map(x => [formatExportDate(x.at), x.caption, x.media_type, x.private ? 'Ja' : 'Nee', x.private ? 'Verborgen (privé)' : x.media]), 'Geen herinneringen.'));
  if ('location' in file) {
    const l = file.location as R | null;
    section('location', 'Locatie', l ? table(['Gegeven', 'Waarde'], [['Locatie delen', l.sharing ? 'Aan' : 'Uit'], ['Met wie', AUDIENCE[String(l.audience)] ?? l.audience], ['Spookmodus', l.ghost_mode ? 'Aan' : 'Uit'],
      ['Laatste locatie', l.latitude != null && l.longitude != null ? `${l.latitude}, ${l.longitude}` : '—'], ['Bijgewerkt', formatExportDate(l.updated_at)]], '') : '<p class="empty">Geen locatie opgeslagen.</p>');
  }
  const css = 'body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#120d1c;color:#ece6f2;margin:0;padding:24px;line-height:1.45}main{max-width:820px;margin:auto}h1{margin:0 0 4px;font-size:26px}h2{border-bottom:2px solid #ae16c7;padding-bottom:6px;margin-top:34px}h3{margin:22px 0 8px;font-size:17px}nav{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}nav a{background:#2b253c;color:#e7a8f5;border-radius:16px;padding:6px 12px;text-decoration:none;font-weight:600}table{width:100%;border-collapse:collapse;background:#1a1425;border-radius:10px;overflow:hidden}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #2e2840;vertical-align:top;word-break:break-word}th{color:#cbb6dc;font-size:13px}.chat{list-style:none;padding:0}.chat li{background:#1a1425;border-left:3px solid #4ca1af;border-radius:8px;padding:8px 10px;margin:6px 0}.chat li.me{border-left-color:#ae16c7}.from{font-weight:700}.at{color:#9c93a6;font-size:12px}.tag{background:#3a2f52;border-radius:8px;padding:1px 7px;font-size:12px;color:#e7c8f2}.empty{color:#9c93a6}.note{color:#bdb4c8;font-size:14px}footer{color:#8e879e;font-size:13px;margin-top:40px;text-align:center}';
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mijn gegevens · Snapshot X</title><style>${css}</style></head><body><main>` +
    `<h1>Mijn gegevens</h1><p class="note">Snapshot X · gemaakt op ${escapeHtml(formatExportDate(file.generated_at))}</p><p class="note">${escapeHtml(file.note)}</p><nav>${nav.join('')}</nav>${parts.join('')}` +
    `<footer>• © Vonk Byte • Snapshot-X 2026-2027 •</footer></main></body></html>`;
}
