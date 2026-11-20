import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {FriendMapProps} from './FriendMap.native';
import {FriendAvatarFigure} from './avatar/FriendAvatar';
import {OwnAvatarFigure} from './avatar/OwnAvatar';
import {darkGreenStyle, WEB_MAP_STYLE_URL} from '../lib/map-web-style';
import {CATEGORY_INFO} from '../lib/map-places';

/*
 * Web map: MapLibre GL JS (open source) with the key-less OpenFreeMap vector tiles, recoloured to the dark
 * green/teal iOS look (lib/map-web-style.ts). Buildings extrude in 3D from zoom ~15. Avatars are React views
 * portalled into MapLibre HTML markers. Native keeps react-native-maps (FriendMap.native.tsx).
 */
type MapLibre = typeof import('maplibre-gl');
type MapInstance = import('maplibre-gl').Map;

const ARNHEM: [number, number] = [5.905, 51.984];
const NETHERLANDS_BOUNDS: [[number, number], [number, number]] = [[3.15, 50.70], [7.30, 53.60]];
const FIG_W = 82;
const FIG_H = Math.round(FIG_W * 119 / 82);
const CSS_ID = 'sx-maplibre-css';

function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  // Minimal subset of maplibre-gl.css (bundling the .css file is not supported by Metro web here).
  style.textContent = '.maplibregl-map{overflow:hidden;-webkit-tap-highlight-color:transparent}'
    + '.maplibregl-canvas{position:absolute;left:0;top:0}.maplibregl-canvas-container.maplibregl-interactive{cursor:grab}'
    + '.maplibregl-marker{position:absolute;top:0;left:0;will-change:transform}'
    + '.maplibregl-ctrl-attrib{position:absolute;right:8px;top:150px;font:9px sans-serif;color:#cfe0dc99}'
    + '.maplibregl-ctrl-attrib a{color:inherit;text-decoration:none}.maplibregl-ctrl-attrib-button{display:none}';
  document.head.appendChild(style);
}

export default function FriendMap({pins, own, ownAppearance, friendOutfits, trail, selectedId, focusOwn, focusNetherlands, onSelect, onLocate, places, heat, selectedPlaceId, onPlace}: FriendMapProps) {
  const container = useRef<View>(null);
  const map = useRef<MapInstance | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const [elements, setElements] = useState<Record<string, HTMLDivElement>>({});
  const markers = useRef(new Map<string, import('maplibre-gl').Marker>());
  const centered = useRef(false);

  useEffect(() => {
    let cancelled = false;
    ensureCss();
    void (async () => {
      const [maplibre, style] = await Promise.all([
        import('maplibre-gl') as Promise<MapLibre>,
        fetch(WEB_MAP_STYLE_URL).then(r => r.json()),
      ]);
      const node = container.current as unknown as HTMLElement | null;
      if (cancelled || !node) return;
      const ml = (maplibre as unknown as {default?: MapLibre}).default ?? maplibre;
      lib.current = ml;
      const instance = new ml.Map({container: node, style: darkGreenStyle(style), center: own ? [own.longitude, own.latitude] : ARNHEM, zoom: 13, maxPitch: 65, attributionControl: {compact: false}});
      map.current = instance;
      instance.on('load', () => { if (!cancelled) setReady(true); });
      instance.on('click', () => onSelect(null));
      (window as unknown as {__sxMap?: MapInstance}).__sxMap = instance;
    })().catch(error => console.warn('Kaart laden mislukt', error));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep one HTML marker per pin (+ own); React content is portalled into each element.
  const wanted = [...(own ? [{id: '__own', lng: own.longitude, lat: own.latitude}] : []), ...pins.map(p => ({id: p.id, lng: p.longitude, lat: p.latitude}))];
  const wantedKey = wanted.map(w => `${w.id}:${w.lng}:${w.lat}`).join('|');
  useEffect(() => {
    const ml = lib.current, instance = map.current;
    if (!ready || !ml || !instance) return;
    const next: Record<string, HTMLDivElement> = {};
    const keep = new Set(wanted.map(w => w.id));
    for (const [id, marker] of markers.current) if (!keep.has(id)) { marker.remove(); markers.current.delete(id); }
    for (const w of wanted) {
      let marker = markers.current.get(w.id);
      if (!marker) {
        const el = document.createElement('div');
        marker = new ml.Marker({element: el, anchor: w.id === '__own' ? 'center' : 'bottom'}).setLngLat([w.lng, w.lat]).addTo(instance);
        markers.current.set(w.id, marker);
      } else marker.setLngLat([w.lng, w.lat]);
      next[w.id] = marker.getElement() as HTMLDivElement;
    }
    setElements(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, wantedKey]);

  useEffect(() => {
    if (!ready || !own || centered.current) return;
    centered.current = true;
    map.current?.jumpTo({center: [own.longitude, own.latitude]});
  }, [own, ready]);

  useEffect(() => {
    if (ready && own && focusOwn) map.current?.easeTo({center: [own.longitude, own.latitude], duration: 450});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOwn, ready]);

  useEffect(() => {
    const pin = pins.find(p => p.id === selectedId);
    if (ready && pin) map.current?.easeTo({center: [pin.longitude, pin.latitude], duration: 500});
  }, [pins, ready, selectedId]);

  function showNetherlands() {
    onSelect(null);
    map.current?.fitBounds(NETHERLANDS_BOUNDS, {padding: {top: 100, right: 42, bottom: 200, left: 42}, pitch: 0, bearing: 0});
  }
  useEffect(() => {
    if (ready && focusNetherlands) showNetherlands();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNetherlands, ready]);

  // Footsteps trail.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const data = {type: 'Feature' as const, properties: {}, geometry: {type: 'LineString' as const, coordinates: trail.map(p => [p.longitude, p.latitude])}};
    const source = instance.getSource('sx-trail') as import('maplibre-gl').GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      instance.addSource('sx-trail', {type: 'geojson', data});
      instance.addLayer({id: 'sx-trail', type: 'line', source: 'sx-trail', paint: {'line-color': '#FFE436', 'line-width': 4, 'line-dasharray': [1, 1.3]}});
    }
  }, [ready, trail]);

  // Hotspots: MapLibre heatmap layer (fades out when zoomed in close, where the places/avatars take over).
  const heatKey = (heat ?? []).map(h => `${h.longitude},${h.latitude},${h.weight}`).join('|');
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const data = {type: 'FeatureCollection' as const, features: (heat ?? []).map(h => ({type: 'Feature' as const, properties: {w: h.weight}, geometry: {type: 'Point' as const, coordinates: [h.longitude, h.latitude]}}))};
    const source = instance.getSource('sx-heat') as import('maplibre-gl').GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      instance.addSource('sx-heat', {type: 'geojson', data});
      instance.addLayer({id: 'sx-heat', type: 'heatmap', source: 'sx-heat', maxzoom: 16, paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 7, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 1.6, 14, 3],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 22, 10, 40, 14, 70],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.85, 16, 0],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.12, 'rgba(110,50,230,0.5)', 0.35, 'rgba(0,200,255,0.65)', 0.6, 'rgba(255,230,54,0.8)', 0.85, 'rgba(255,120,40,0.88)', 1, 'rgba(255,50,80,0.92)'],
      }});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, heatKey]);

  // Plekken: small emoji markers (plain DOM, no React portal needed).
  const placeMarkers = useRef(new Map<string, import('maplibre-gl').Marker>());
  const onPlaceRef = useRef(onPlace);
  useEffect(() => { onPlaceRef.current = onPlace; }, [onPlace]);
  const placesKey = (places ?? []).map(p => p.id).join('|');
  useEffect(() => {
    const ml = lib.current, instance = map.current;
    if (!ready || !ml || !instance) return;
    const keep = new Set((places ?? []).map(p => p.id));
    for (const [id, marker] of placeMarkers.current) if (!keep.has(id)) { marker.remove(); placeMarkers.current.delete(id); }
    for (const p of places ?? []) {
      if (placeMarkers.current.has(p.id)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.title = p.name;
      el.setAttribute('aria-label', `${p.name}, ${p.city}`);
      el.dataset.place = p.id;
      el.textContent = CATEGORY_INFO[p.category].emoji;
      el.style.cssText = 'width:34px;height:34px;border-radius:17px;border:2px solid #ffffff55;background:#1D1730E6;font-size:17px;line-height:28px;padding:0;cursor:pointer;box-shadow:0 2px 10px #0008';
      el.addEventListener('click', e => { e.stopPropagation(); onPlaceRef.current?.(p.id); });
      placeMarkers.current.set(p.id, new ml.Marker({element: el, anchor: 'center'}).setLngLat([p.longitude, p.latitude]).addTo(instance));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, placesKey]);
  useEffect(() => {
    for (const [id, marker] of placeMarkers.current) {
      const el = marker.getElement() as HTMLElement, on = id === selectedPlaceId;
      el.style.borderColor = on ? '#FFE436' : '#ffffff55';
      el.style.background = on ? '#5B2DB8' : '#1D1730E6';
    }
    const p = (places ?? []).find(x => x.id === selectedPlaceId);
    if (ready && p) map.current?.easeTo({center: [p.longitude, p.latitude], zoom: Math.max(map.current.getZoom(), 13), duration: 500});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaceId, ready, placesKey]);

  function zoom(delta: number) {
    const instance = map.current;
    if (!instance) return;
    const next = Math.max(3, Math.min(20, instance.getZoom() + delta));
    // Zoomed in close: tilt so the 3D buildings read like the iOS map.
    instance.easeTo({zoom: next, pitch: next >= 15.5 ? 55 : 0, duration: 260});
  }

  return <View style={styles.root}>
    <View ref={container} style={StyleSheet.absoluteFill} accessibilityLabel="Interactieve kaart van Nederland"/>
    {own && elements.__own && createPortal(<View style={styles.ownMarker} pointerEvents="none">
      <View style={styles.glow}><OwnAvatarFigure userId={own.id} appearance={ownAppearance} size={FIG_W}/></View>
      <View style={styles.nowBadge}><Text style={styles.nowText}>Ik nu</Text></View>
    </View>, elements.__own)}
    {pins.map(pin => elements[pin.id] ? createPortal(<Pressable onPress={() => onSelect(pin.id)} style={[styles.pin, selectedId === pin.id && styles.selectedPin]} accessibilityLabel={pin.name}>
      <FriendAvatarFigure id={pin.id} outfit={friendOutfits?.get(pin.id)} size={FIG_W}/>
    </Pressable>, elements[pin.id], pin.id) : null)}
    <View style={styles.controls} pointerEvents="box-none">
      <Pressable style={styles.control} onPress={() => zoom(1)} accessibilityLabel="Inzoomen"><Ionicons name="add" size={25} color="#fff"/></Pressable>
      <Pressable style={styles.control} onPress={() => zoom(-1)} accessibilityLabel="Uitzoomen"><Ionicons name="remove" size={25} color="#fff"/></Pressable>
      <Pressable style={styles.control} onPress={showNetherlands} accessibilityLabel="Heel Nederland bekijken"><Ionicons name="globe-outline" size={24} color="#fff"/></Pressable>
      <Pressable style={[styles.control, styles.locate]} onPress={onLocate} accessibilityLabel="Ga naar mijn locatie"><Ionicons name="locate" size={23} color="#25112F"/></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#24504c'},
  ownMarker: {alignItems: 'center', width: 110},
  glow: {width: FIG_W + 10, height: FIG_H + 6, borderRadius: 46, alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#FFE43638', boxShadow: '0 0 34px 14px #FFE43666'},
  nowBadge: {marginTop: -6, borderRadius: 15, backgroundColor: '#FFE436', paddingHorizontal: 14, paddingVertical: 5, boxShadow: '0 0 12px #FFE436'},
  nowText: {color: '#211428', fontSize: 14, fontWeight: '900'},
  pin: {width: FIG_W + 6, height: FIG_H + 4, alignItems: 'center', justifyContent: 'flex-end'},
  selectedPin: {backgroundColor: '#AE57DB33', borderRadius: 35},
  controls: {position: 'absolute', right: 15, bottom: 230, gap: 12},
  control: {height: 50, width: 50, borderRadius: 25, backgroundColor: '#211B30E8', justifyContent: 'center', alignItems: 'center'},
  locate: {backgroundColor: '#FFE436'},
});
