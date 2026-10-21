/**
 * Web map style (components/FriendMap.web.tsx): takes the open, key-less OpenFreeMap "liberty" vector style and
 * recolours it into the dark green/teal look of the iOS map (Apple Maps dark), keeping roads, labels, parks, POIs
 * and the 3D building layer. Pure function so it can be unit tested without a browser.
 */
export const WEB_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const WEB_MAP_COLORS = {
  land: '#24504c', residential: '#285651', park: '#2d6b4b', water: '#26398c', casing: '#1b3a39', road: '#6f8b88',
  major: '#86a09c', motorway: '#9fb3ae', path: '#3f6966', rail: '#557574', building: '#33625d', building3d: '#3f706a',
  boundary: '#6f8f8b', text: '#e3ece9', halo: '#163332', poi: '#7fd68f', transit: '#8fb6ff', waterText: '#9fb0ff',
} as const;

type Layer = {id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown>; minzoom?: number; [k: string]: unknown};
type Style = {layers: Layer[]; [k: string]: unknown};

function fillColor(id: string): string {
  const c = WEB_MAP_COLORS;
  if (id.startsWith('water')) return c.water;
  if (id === 'park' || /wood|grass|wetland|pitch|track|cemetery/.test(id)) return c.park;
  if (id === 'landuse_residential') return c.residential;
  if (id === 'building') return c.building;
  return c.land;
}

function lineColor(id: string): string {
  const c = WEB_MAP_COLORS;
  if (id.startsWith('waterway')) return c.water;
  if (id.startsWith('boundary')) return c.boundary;
  if (id.startsWith('park')) return c.park;
  if (/casing/.test(id)) return c.casing;
  if (/rail/.test(id)) return c.rail;
  if (/path|pedestrian|aeroway/.test(id)) return c.path;
  if (/motorway/.test(id)) return c.motorway;
  if (/trunk|primary|secondary|link/.test(id)) return c.major;
  return c.road;
}

export function darkGreenStyle<T extends Style>(style: T): T {
  const c = WEB_MAP_COLORS;
  const layers: Layer[] = [];
  for (const source of style.layers) {
    if (source.type === 'raster' || source.id === 'road_area_pattern') continue;
    // Never emit `layout: undefined`: MapLibre's style validator rejects it.
    const layer: Layer = {...source, paint: {...(source.paint ?? {})}};
    const paint = layer.paint!;
    if (layer.type === 'background') paint['background-color'] = c.land;
    else if (layer.type === 'fill') {
      delete paint['fill-pattern'];
      paint['fill-color'] = fillColor(layer.id);
      paint['fill-opacity'] = layer.id === 'building' ? 0.95 : 1;
      if ('fill-outline-color' in paint) paint['fill-outline-color'] = layer.id === 'building' ? c.casing : fillColor(layer.id);
    } else if (layer.type === 'line') {
      paint['line-color'] = lineColor(layer.id);
      if (layer.id.startsWith('tunnel')) paint['line-opacity'] = 0.5;
    } else if (layer.type === 'fill-extrusion') {
      paint['fill-extrusion-color'] = c.building3d;
      paint['fill-extrusion-opacity'] = 0.92;
      layer.minzoom = 14.5;
    } else if (layer.type === 'symbol') {
      const poi = layer.id.startsWith('poi') && layer.id !== 'poi_transit';
      paint['text-color'] = poi ? c.poi : layer.id === 'poi_transit' ? c.transit : /water/.test(layer.id) ? c.waterText : c.text;
      paint['text-halo-color'] = c.halo;
      paint['text-halo-width'] = 1.2;
    }
    layers.push(layer);
  }
  return {...style, layers};
}
