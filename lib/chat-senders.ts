/** Snapchat-style sender presentation for chats: per-sender colours, "IK" label for yourself, runs of consecutive
 *  messages from one sender (name label + avatar once per run, coloured left bar on every message). */
export const ME_COLOR = '#FF4D6A';
/** Friend colours (distinct from ME_COLOR and from each other; readable on the dark chat background). */
export const SENDER_COLORS = ['#4FA3FF', '#B57CFF', '#3DDC97', '#FF9F43', '#2ED3E6', '#FF7AC8', '#FFD43B', '#9BE15D'] as const;
export const ME_LABEL = 'IK';
/** Gap after which the same sender starts a new run (Snapchat re-shows the name after a pause). */
export const RUN_GAP_MS = 15 * 60_000;

/** Stable colour per sender. 1:1 = the friend is blue. Groups: friends get palette colours in member order (sorted ids). */
export function senderColors(memberIds: readonly string[], me: string): Map<string, string> {
  const out = new Map<string, string>([[me, ME_COLOR]]);
  [...new Set(memberIds)].filter(id => id !== me).sort().forEach((id, i) => out.set(id, SENDER_COLORS[i % SENDER_COLORS.length]));
  return out;
}
/** Colour for a sender not in the member list (e.g. left the group): hashed into the palette, never ME_COLOR. */
export function colorFor(id: string, colors: Map<string, string>): string {
  const c = colors.get(id); if (c) return c;
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}
/** Uppercase name label: "IK" for yourself, else the first name (Snapchat shows first names in caps). */
export function senderLabel(id: string, me: string, name: string | null | undefined): string {
  if (id === me) return ME_LABEL;
  const first = (name ?? '').trim().split(/\s+/)[0];
  return (first || 'Vriend').toLocaleUpperCase('nl-NL');
}
export type RunMsg = { id: string; sender_id: string; kind: string; created_at: string };
/** Ids of messages that START a run, for a NEWEST-FIRST list (as the inverted FlatList gets it).
 *  A message starts a run when the older neighbour is from someone else, is a system line, or is > RUN_GAP_MS older. */
export function runStarts(rowsNewestFirst: readonly RunMsg[], gapMs = RUN_GAP_MS): Set<string> {
  const out = new Set<string>();
  rowsNewestFirst.forEach((m, i) => {
    if (m.kind === 'system') return;
    const older = rowsNewestFirst[i + 1];
    if (!older || older.kind === 'system' || older.sender_id !== m.sender_id || Date.parse(m.created_at) - Date.parse(older.created_at) > gapMs) out.add(m.id);
  });
  return out;
}
/** Text shown for a message without renderable content (e.g. a snap row without media) instead of an empty bubble. */
export function emptyMessageText(m: { kind: string; body: string | null; media_path?: string | null }): string | null {
  if (m.kind === 'snap' && !m.media_path) return '📷 Snap (niet meer beschikbaar)';
  if ((m.kind === 'text' || !m.kind) && !(m.body ?? '').trim() && !m.media_path) return 'Bericht niet beschikbaar';
  return null;
}
/** Long-press / context-menu actions for a message. Everyone can reply (quoted reply); others also get report + block. */
export function messageMenuActions(mine: boolean): ('reply' | 'report' | 'block')[] { return mine ? ['reply'] : ['reply', 'report', 'block']; }
export const MENU_LABEL = { reply: 'Antwoorden', report: 'Meld bericht', block: 'Blokkeer gebruiker' } as const;
