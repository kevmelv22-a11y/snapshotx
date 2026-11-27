/** "Mijn locatie sturen" in a chat (Snapchat: share your location in chat). A one-off pin, NOT live sharing:
 *  a normal `text` message whose body is `[loc]{"lat":52.3731,"lng":4.8926,"acc":25}` (≈11 m precision, 4 decimals),
 *  so it follows the chat's retention rules (24 h / after viewing) like any message. No table, no migration, no I/O.
 *  Push notifications never include chat text (push-message), so the coordinates are never in a push. */
export const LOC_PREFIX = '[loc]';
export const LOCATION_LABEL = { preview: '📍 Locatie', mine: 'Je deelde je locatie', theirs: 'deelde een locatie', open: 'Openen in Kaarten', send: 'Mijn locatie sturen' } as const;
export type ChatLocation = { lat: number; lng: number; acc: number | null };
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function locationBody(lat: number, lng: number, accuracy?: number | null): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const acc = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? Math.min(Math.round(accuracy), 5000) : null;
  return LOC_PREFIX + JSON.stringify(acc == null ? { lat: r4(lat), lng: r4(lng) } : { lat: r4(lat), lng: r4(lng), acc });
}
export function parseLocation(body: string | null | undefined): ChatLocation | null {
  if (typeof body !== 'string' || !body.startsWith(LOC_PREFIX) || body.length > 120) return null;
  try {
    const v = JSON.parse(body.slice(LOC_PREFIX.length)) as { lat?: unknown; lng?: unknown; acc?: unknown };
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number' || !Number.isFinite(v.lat) || !Number.isFinite(v.lng) || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
    return { lat: v.lat, lng: v.lng, acc: typeof v.acc === 'number' && Number.isFinite(v.acc) && v.acc >= 0 ? v.acc : null };
  } catch { return null; }
}
/** 52.3731° N, 4.8926° O (Dutch compass letters). */
export function formatCoords(l: ChatLocation): string {
  const f = (v: number) => Math.abs(v).toFixed(4).replace('.', ',');
  return `${f(l.lat)}° ${l.lat >= 0 ? 'N' : 'Z'}, ${f(l.lng)}° ${l.lng >= 0 ? 'O' : 'W'}`;
}
export const accuracyText = (l: ChatLocation) => l.acc == null || l.acc < 1 ? '' : l.acc <= 50 ? 'Nauwkeurig tot op ±' + l.acc + ' m' : 'Ongeveer (±' + (l.acc >= 1000 ? (Math.round(l.acc / 100) / 10).toString().replace('.', ',') + ' km' : l.acc + ' m') + ')';
/** Universal maps link: Apple Maps on iOS, Google Maps elsewhere (both open the app when installed, else the website). */
export function mapsUrl(l: ChatLocation, platform: string): string {
  return platform === 'ios' ? `https://maps.apple.com/?ll=${l.lat},${l.lng}&q=Locatie` : `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
}
