/** Snap Map "Plekken" + hotspot heatmap (Snapchat Places / heat layer), pure + unit-tested.
 *  Snapshot X does not store where snaps were made, so the heat is NOT fake snap activity: it combines a fixed list of
 *  well-known public places (popularity weight, a little busier at typical times) with the positions of friends you can
 *  already see on the map. The legend in the app says exactly that. No extra location data is collected or sent. */
export type PlaceCategory = 'stad' | 'natuur' | 'strand' | 'cultuur' | 'eten' | 'uitgaan' | 'sport' | 'pret';
export type MapPlace = { id: string; name: string; city: string; category: PlaceCategory; latitude: number; longitude: number; weight: number };
export type HeatPoint = { latitude: number; longitude: number; weight: number };

export const CATEGORY_INFO: Record<PlaceCategory, { emoji: string; label: string }> = {
  stad: { emoji: '🏙️', label: 'Stad' }, natuur: { emoji: '🌳', label: 'Natuur' }, strand: { emoji: '🏖️', label: 'Strand' },
  cultuur: { emoji: '🏛️', label: 'Cultuur' }, eten: { emoji: '🍔', label: 'Eten & drinken' }, uitgaan: { emoji: '🎶', label: 'Uitgaan' },
  sport: { emoji: '⚽', label: 'Sport' }, pret: { emoji: '🎢', label: 'Pretpark' },
};
const P = (id: string, name: string, city: string, category: PlaceCategory, latitude: number, longitude: number, weight: number): MapPlace => ({ id, name, city, category, latitude, longitude, weight });
/** Public, well-known places only (no homes/schools). Weight 1–5 = how busy the spot usually is. */
export const PLACES: readonly MapPlace[] = [
  P('dam', 'De Dam', 'Amsterdam', 'stad', 52.3731, 4.8926, 5), P('vondelpark', 'Vondelpark', 'Amsterdam', 'natuur', 52.3580, 4.8686, 5),
  P('rijksmuseum', 'Rijksmuseum', 'Amsterdam', 'cultuur', 52.3600, 4.8852, 4), P('leidseplein', 'Leidseplein', 'Amsterdam', 'uitgaan', 52.3641, 4.8828, 4),
  P('jcarena', 'Johan Cruijff ArenA', 'Amsterdam', 'sport', 52.3144, 4.9415, 4), P('markthal', 'Markthal', 'Rotterdam', 'eten', 51.9200, 4.4873, 4),
  P('erasmusbrug', 'Erasmusbrug', 'Rotterdam', 'stad', 51.9094, 4.4868, 4), P('scheveningen', 'Strand Scheveningen', 'Den Haag', 'strand', 52.1135, 4.2800, 5),
  P('binnenhof', 'Binnenhof', 'Den Haag', 'cultuur', 52.0799, 4.3133, 3), P('domtoren', 'Domtoren', 'Utrecht', 'cultuur', 52.0907, 5.1214, 4),
  P('oudegracht', 'Oudegracht', 'Utrecht', 'eten', 52.0894, 5.1200, 4), P('efteling', 'Efteling', 'Kaatsheuvel', 'pret', 51.6497, 5.0437, 5),
  P('walibi', 'Walibi Holland', 'Biddinghuizen', 'pret', 52.4398, 5.7646, 3), P('zandvoort', 'Strand Zandvoort', 'Zandvoort', 'strand', 52.3743, 4.5251, 4),
  P('keukenhof', 'Keukenhof', 'Lisse', 'natuur', 52.2697, 4.5465, 3), P('kinderdijk', 'Kinderdijk', 'Kinderdijk', 'cultuur', 51.8840, 4.6390, 3),
  P('stratumseind', 'Stratumseind', 'Eindhoven', 'uitgaan', 51.4386, 5.4810, 4), P('vrijthof', 'Vrijthof', 'Maastricht', 'stad', 50.8486, 5.6889, 4),
  P('grotemarkt-gron', 'Grote Markt', 'Groningen', 'stad', 53.2186, 6.5676, 4), P('hogeveluwe', 'Nationaal Park De Hoge Veluwe', 'Otterlo', 'natuur', 52.0944, 5.8128, 3),
  P('burgerszoo', "Burgers' Zoo", 'Arnhem', 'pret', 52.0060, 5.9010, 4), P('korenmarkt', 'Korenmarkt', 'Arnhem', 'uitgaan', 51.9827, 5.9050, 3),
  P('waalkade', 'Waalkade', 'Nijmegen', 'stad', 51.8492, 5.8673, 3), P('philipsstadion', 'Philips Stadion', 'Eindhoven', 'sport', 51.4417, 5.4675, 3),
  P('texel', 'Strand Texel (Paal 17)', 'De Koog', 'strand', 53.0833, 4.7476, 3), P('giethoorn', 'Giethoorn', 'Giethoorn', 'natuur', 52.7393, 6.0779, 3),
];

/** Typical busy hours (local time): nightlife late, beaches/parks afternoon, rest daytime. Multiplier 0.5–1.3. */
export function busyFactor(category: PlaceCategory, hour: number): number {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (category === 'uitgaan') return h >= 21 || h < 3 ? 1.3 : h >= 17 ? 1 : 0.5;
  if (category === 'strand' || category === 'natuur' || category === 'pret') return h >= 11 && h < 19 ? 1.3 : h >= 8 && h < 22 ? 0.9 : 0.5;
  return h >= 9 && h < 22 ? 1.1 : 0.6;
}
/** Heat points: places (weight × busy factor) + one point per visible friend (weight 2). */
export function heatPoints(places: readonly MapPlace[], friends: readonly { latitude: number; longitude: number }[], hour: number): HeatPoint[] {
  return [
    ...places.map(p => ({ latitude: p.latitude, longitude: p.longitude, weight: Math.round(p.weight * busyFactor(p.category, hour) * 10) / 10 })),
    ...friends.filter(f => Number.isFinite(f.latitude) && Number.isFinite(f.longitude)).map(f => ({ latitude: f.latitude, longitude: f.longitude, weight: 2 })),
  ];
}
/** Distance in km (haversine). */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const r = (x: number) => x * Math.PI / 180, dLat = r(b.latitude - a.latitude), dLon = r(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function distanceLabel(km: number): string {
  if (!Number.isFinite(km)) return '';
  return km < 1 ? `${Math.max(50, Math.round(km * 20) * 50)} m` : km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}
/** Friends within `km` of a place (for "2 vrienden in de buurt"). */
export function friendsNear<T extends { latitude: number; longitude: number }>(place: MapPlace, friends: readonly T[], km = 2): T[] {
  return friends.filter(f => distanceKm(place, f) <= km);
}
/** Places sorted by distance from you (or by weight when your location is unknown), optionally one category. */
export function nearbyPlaces(from: { latitude: number; longitude: number } | null, category?: PlaceCategory | null, places: readonly MapPlace[] = PLACES): MapPlace[] {
  const list = places.filter(p => !category || p.category === category);
  return from ? [...list].sort((a, b) => distanceKm(from, a) - distanceKm(from, b)) : [...list].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'nl'));
}
/** Heat circle radius (m) + opacity for maps without a native heat layer (react-native-maps Circle). */
export function heatCircle(weight: number): { radius: number; opacity: number } {
  const w = Math.max(0, Math.min(7, weight));
  return { radius: Math.round(500 + w * 260), opacity: Math.round((0.12 + w * 0.045) * 100) / 100 };
}
