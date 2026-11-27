/** "Stuur naar vriend" from Spotlight (Snapchat: send a Spotlight snap in chat). A normal `text` message whose body is
 *  `[spot]{"id":"<story uuid>","o":"<creator uuid>","n":"<creator name ≤ 40>","c":"<caption ≤ 80>"}`; tapping the card opens Uitgelicht with that
 *  snap first. The snap itself stays public/unchanged; when it is gone the feed says so. No table, no migration. */
export const SPOT_PREFIX = '[spot]';
export const SPOT_LABEL = { preview: '🎬 Spotlight', open: 'Bekijk in Spotlight', gone: 'Deze Spotlight-snap is niet meer beschikbaar.', sheet: 'Stuur naar…', outside: 'Delen buiten de app' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SpotShare = { id: string; owner: string; name: string; caption: string };
const clip = (v: string, n: number) => { const c = [...v.replace(/\s+/g, ' ').trim()]; return c.length > n ? c.slice(0, n - 1).join('') + '…' : c.join(''); };

export function spotlightBody(i: { id: string; owner_id: string; caption?: string | null }, creatorName?: string | null): string | null {
  if (!UUID.test(i.id) || !UUID.test(i.owner_id)) return null;
  return SPOT_PREFIX + JSON.stringify({ id: i.id, o: i.owner_id, n: clip(creatorName ?? '', 40), c: clip(i.caption ?? '', 80) });
}
export function parseSpotlight(body: string | null | undefined): SpotShare | null {
  if (typeof body !== 'string' || !body.startsWith(SPOT_PREFIX) || body.length > 400) return null;
  try {
    const v = JSON.parse(body.slice(SPOT_PREFIX.length)) as { id?: unknown; o?: unknown; n?: unknown; c?: unknown };
    if (typeof v.id !== 'string' || !UUID.test(v.id) || typeof v.o !== 'string' || !UUID.test(v.o)) return null;
    return { id: v.id, owner: v.o, name: typeof v.n === 'string' ? clip(v.n, 40) : '', caption: typeof v.c === 'string' ? clip(v.c, 80) : '' };
  } catch { return null; }
}
/** Uitgelicht opened from a shared card: that snap first, the rest of the ranked feed after it; `found` false when gone. */
export function startFirst<T extends { id: string }>(items: T[], id: string | null | undefined): { items: T[]; found: boolean } {
  if (!id) return { items, found: true };
  const hit = items.find(i => i.id === id);
  return hit ? { items: [hit, ...items.filter(i => i.id !== id)], found: true } : { items, found: false };
}
