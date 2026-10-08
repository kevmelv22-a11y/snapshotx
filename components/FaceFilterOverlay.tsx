import React, { useId, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { balaclavaShape, smoothClosedPath, stickerMatrix, type BalaclavaShape } from '../lib/face-filters/geometry';
import type { FaceGeometry, Pt } from '../lib/face-filters/types';
import { photoFilter, type PhotoFilterId } from '../lib/photo-filters';

type Props = {
  filterId: PhotoFilterId;
  /** Face in the overlay's own coordinates (view points), or null when no face was found. */
  face: FaceGeometry | null;
  width: number;
  height: number;
};

/** Draws face lenses on detected landmarks. Tint-only filters are rendered by the parent. */
export function FaceFilterOverlay({ filterId, face, width, height }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const kind = photoFilter(filterId).kind;
  const geometry = useMemo(() => {
    if (kind === 'tint' || width <= 0 || height <= 0) return null;
    if (face) return face;
    return kind === 'frame' ? centredFace(width, height) : null;
  }, [face, kind, width, height]);
  const shape = useMemo(() => (geometry && filterId === 'balaclava' ? balaclavaShape(geometry) : null), [geometry, filterId]);
  if (!geometry) return null;
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {shape ? <Balaclava shape={shape} uid={uid} /> : <Sticker filterId={filterId} face={geometry} />}
  </Svg>;
}

/** Default face placement for decorative frames when no face was detected. */
function centredFace(w: number, h: number): FaceGeometry {
  const d = w * 0.22, cx = w / 2, ey = h * 0.4;
  return { bounds: { x: cx - d * 1.1, y: ey - d, width: d * 2.2, height: d * 3 },
    landmarks: { LEFT_EYE: { x: cx + d / 2, y: ey }, RIGHT_EYE: { x: cx - d / 2, y: ey }, MOUTH_LEFT: { x: cx - d * 0.4, y: ey + d * 1.1 }, MOUTH_RIGHT: { x: cx + d * 0.4, y: ey + d * 1.1 } } };
}

const ptAlong = (o: Pt, u: Pt, k: number): Pt => ({ x: o.x + u.x * k, y: o.y + u.y * k });

/**
 * Stockinette knit as plain path geometry (no SVG <Pattern>, which react-native-svg on iOS did not
 * render): one "V" of two yarn legs per stitch, rows stacked downwards, in a frame rotated with the
 * head. Only stitches inside the balaclava's bounding box (in that rotated frame) are emitted.
 */
function knitPaths(shape: BalaclavaShape) {
  const { frame: f, stitch: sw } = shape;
  const sh = sw * 0.82;
  const c = Math.cos(f.roll), s = Math.sin(f.roll);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of shape.outline) {
    const dx = p.x - f.center.x, dy = p.y - f.center.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    minX = Math.min(minX, lx); maxX = Math.max(maxX, lx); minY = Math.min(minY, ly); maxY = Math.max(maxY, ly);
  }
  const n = (v: number) => v.toFixed(1);
  let legs = '', legsPurl = '', hiL = '', hiR = '', grooves = '';
  // Columns are aligned to the face centre so the knit "wales" run symmetrically down the face.
  const i0 = Math.floor(minX / sw) - 1, i1 = Math.ceil(maxX / sw) + 1;
  const j0 = Math.floor(minY / sh) - 1, j1 = Math.ceil(maxY / sh) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = i * sw - sw / 2;
    grooves += `M${n(x)} ${n(j0 * sh)}V${n(j1 * sh)}`;
    for (let j = j0; j <= j1; j++) {
      const y = j * sh;
      const leg = `M${n(x + sw * 0.1)} ${n(y - sh * 0.08)}L${n(x + sw * 0.5)} ${n(y + sh * 0.92)}L${n(x + sw * 0.9)} ${n(y - sh * 0.08)}`;
      // Rib knit: alternate columns sit slightly deeper (darker).
      if (i % 2 === 0) legs += leg; else legsPurl += leg;
      hiL += `M${n(x + sw * 0.16)} ${n(y + sh * 0.02)}L${n(x + sw * 0.44)} ${n(y + sh * 0.7)}`;
      hiR += `M${n(x + sw * 0.84)} ${n(y + sh * 0.02)}L${n(x + sw * 0.56)} ${n(y + sh * 0.7)}`;
    }
  }
  const transform = `matrix(${c.toFixed(5)} ${s.toFixed(5)} ${(-s).toFixed(5)} ${c.toFixed(5)} ${n(f.center.x)} ${n(f.center.y)})`;
  return { legs, legsPurl, hiL, hiR, grooves, transform, sw };
}

/** Black knitted balaclava: procedural knit texture, soft edges and shading, no outline. */
function Balaclava({ shape, uid }: { shape: BalaclavaShape; uid: string }) {
  const { frame: f, stitch: sw } = shape;
  const d = f.eyeDist;
  const knit = useMemo(() => knitPaths(shape), [shape]);
  const light = ptAlong(f.center, f.uy, -0.55 * d);
  const neckEnd = ptAlong(f.center, f.uy, 2.6 * d);
  const holes = [...shape.eyes, shape.mouth];
  const holeD = holes.map((h) => smoothClosedPath(h.points));
  const id = (n: string) => `${n}${uid}`;
  return <G>
    <Defs>
      <ClipPath id={id('mask')}><Path d={shape.d} fillRule="evenodd" clipRule="evenodd" /></ClipPath>
      <RadialGradient id={id('shade')} gradientUnits="userSpaceOnUse" cx={light.x} cy={light.y} r={2.3 * d} fx={light.x} fy={light.y}>
        <Stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
        <Stop offset="0.35" stopColor="#ffffff" stopOpacity="0.02" />
        <Stop offset="0.62" stopColor="#000000" stopOpacity="0.12" />
        <Stop offset="0.88" stopColor="#000000" stopOpacity="0.5" />
        <Stop offset="1" stopColor="#000000" stopOpacity="0.7" />
      </RadialGradient>
      <LinearGradient id={id('neck')} gradientUnits="userSpaceOnUse" x1={f.center.x} y1={f.center.y} x2={neckEnd.x} y2={neckEnd.y}>
        <Stop offset="0" stopColor="#000000" stopOpacity="0" />
        <Stop offset="0.55" stopColor="#000000" stopOpacity="0.05" />
        <Stop offset="1" stopColor="#000000" stopOpacity="0.45" />
      </LinearGradient>
      {holeD.map((hd, i) => <ClipPath key={i} id={id(`hole${i}`)}><Path d={hd} /></ClipPath>)}
    </Defs>
    <Path d={shape.d} fillRule="evenodd" fill="#09090b" />
    <G clipPath={`url(#${id('mask')})`}>
      <G transform={knit.transform}>
        <Path d={knit.grooves} fill="none" stroke="#030304" strokeWidth={sw * 0.12} />
        <Path d={knit.legs} fill="none" stroke="#202126" strokeWidth={sw * 0.36} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={knit.legsPurl} fill="none" stroke="#17181c" strokeWidth={sw * 0.34} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={knit.hiL} fill="none" stroke="#34363d" strokeWidth={sw * 0.11} strokeLinecap="round" />
        <Path d={knit.hiR} fill="none" stroke="#2b2d33" strokeWidth={sw * 0.1} strokeLinecap="round" />
      </G>
      <Path d={shape.d} fillRule="evenodd" fill={`url(#${id('shade')})`} />
      <Path d={shape.d} fillRule="evenodd" fill={`url(#${id('neck')})`} />
    </G>
    {/* Soft edge instead of an outline: a translucent feather plus short yarn tufts in the fabric colour. */}
    <Path d={shape.outlineD} fill="none" stroke="#060607" strokeOpacity={0.35} strokeWidth={0.05 * d} strokeLinejoin="round" />
    <Path d={shape.outlineD} fill="none" stroke="#060607" strokeOpacity={0.8} strokeWidth={0.035 * d} strokeDasharray={`${(sw * 0.12).toFixed(2)} ${(sw * 0.22).toFixed(2)}`} strokeLinecap="round" strokeLinejoin="round" />
    {/* Holes: shadow cast on the skin + a thicker ribbed rim. */}
    {holeD.map((hd, i) => <G key={i} clipPath={`url(#${id(`hole${i}`)})`}>
      <Path d={hd} fill="none" stroke="#000000" strokeOpacity={0.5} strokeWidth={0.12 * d} />
      <Path d={hd} fill="none" stroke="#000000" strokeOpacity={0.22} strokeWidth={0.26 * d} />
    </G>)}
    {holeD.map((hd, i) => <G key={`rim${i}`}>
      <Path d={hd} fill="none" stroke="#0d0e10" strokeWidth={0.085 * d} />
      <Path d={hd} fill="none" stroke="#2c2e34" strokeWidth={0.07 * d} strokeDasharray={`${(sw * 0.16).toFixed(2)} ${(sw * 0.3).toFixed(2)}`} />
      <Path d={hd} fill="none" stroke="#3a3c43" strokeOpacity={0.35} strokeWidth={0.025 * d} />
    </G>)}
  </G>;
}

/** Artwork in a 300x330 design space; `anchors` = image-left eye, image-right eye, mouth in that space. */
const STICKERS: Partial<Record<PhotoFilterId, { anchors: [Pt, Pt, Pt]; art: React.ReactNode }>> = {
  dog: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M62 82 Q12 37 30 153 Q43 178 86 141 Z" fill="#9A5A31" stroke="#503020" strokeWidth="5"/>
    <Path d="M238 82 Q288 37 270 153 Q257 178 214 141 Z" fill="#9A5A31" stroke="#503020" strokeWidth="5"/>
    <Path d="M52 98 Q34 74 43 137 L69 126 Z M248 98 Q266 74 257 137 L231 126 Z" fill="#DFA783"/>
    <Ellipse cx="150" cy="210" rx="33" ry="23" fill="#B97850" opacity=".82"/>
    <Path d="M133 203 Q150 189 167 203 Q169 222 150 226 Q131 222 133 203 Z" fill="#39231F"/>
    <Path d="M150 226 Q150 241 137 241 M150 226 Q150 241 163 241" stroke="#39231F" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </G> },
  cat: { anchors: [{ x: 112, y: 160 }, { x: 188, y: 160 }, { x: 150, y: 244 }], art: <G>
    <Path d="M54 139 L61 34 Q66 25 77 42 L115 83 M246 139 L239 34 Q234 25 223 42 L185 83" fill="#5D405F" stroke="#E5A6CD" strokeWidth="7" strokeLinejoin="round"/>
    <Path d="M73 64 L80 111 L106 91 M227 64 L220 111 L194 91" fill="#F4A5C6"/>
    <Path d="M139 213 Q150 204 161 213 L150 225 Z" fill="#EC93AC"/>
    <Line x1="121" y1="228" x2="50" y2="215" stroke="#F9F0F3" strokeWidth="4"/>
    <Line x1="121" y1="235" x2="54" y2="244" stroke="#F9F0F3" strokeWidth="4"/>
    <Line x1="179" y1="228" x2="250" y2="215" stroke="#F9F0F3" strokeWidth="4"/>
    <Line x1="179" y1="235" x2="246" y2="244" stroke="#F9F0F3" strokeWidth="4"/>
  </G> },
  rabbit: { anchors: [{ x: 112, y: 165 }, { x: 188, y: 165 }, { x: 150, y: 249 }], art: <G>
    <Path d="M81 115 Q43 -34 70 16 Q105 32 113 112 M219 115 Q257 -34 230 16 Q195 32 187 112" fill="#E9E4F0" stroke="#BDB2CE" strokeWidth="5"/>
    <Path d="M82 94 Q63 12 76 34 L98 105 M218 94 Q237 12 224 34 L202 105" fill="#F6AECF"/>
    <Ellipse cx="150" cy="216" rx="13" ry="9" fill="#F3A0C4"/>
    <Path d="M150 225 L150 239 M135 238 Q150 248 165 238" stroke="#F3A0C4" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </G> },
  sunglasses: { anchors: [{ x: 97, y: 187 }, { x: 203, y: 187 }, { x: 150, y: 304 }], art: <G>
    <Path d="M52 154 L105 157 Q137 154 140 178 Q138 212 107 219 Q68 221 58 188 Z M248 154 L195 157 Q163 154 160 178 Q162 212 193 219 Q232 221 242 188 Z"
      fill="#181924" fillOpacity={0.92} stroke="#D6B365" strokeWidth="7"/>
    <Path d="M140 173 Q150 164 160 173 M52 162 L27 150 M248 162 L273 150" fill="none" stroke="#D6B365" strokeWidth="8" strokeLinecap="round"/>
    <Path d="M70 175 L113 169 M181 175 L224 169" stroke="#8B8FAE" opacity=".55" strokeWidth="5"/>
  </G> },
  crown: { anchors: [{ x: 100, y: 244 }, { x: 200, y: 244 }, { x: 150, y: 354 }], art: <G>
    <Path d="M50 113 L38 34 L94 71 L150 13 L206 71 L262 34 L250 113 Z" fill="#FFC83D" stroke="#9C6A1B" strokeWidth="6" strokeLinejoin="round"/>
    <Rect x="50" y="110" width="200" height="24" rx="8" fill="#EAAA22" stroke="#9C6A1B" strokeWidth="5"/>
    <Circle cx="150" cy="91" r="12" fill="#C92A79"/><Circle cx="84" cy="97" r="8" fill="#7545C4"/><Circle cx="216" cy="97" r="8" fill="#7545C4"/>
  </G> },
  hearts: { anchors: [{ x: 115, y: 160 }, { x: 185, y: 160 }, { x: 150, y: 237 }], art: <G fill="#F451A6" stroke="#FFF0F8" strokeWidth="3">
    <Path d="M54 118 C23 83 7 125 54 155 C101 125 85 83 54 118 Z"/>
    <Path d="M245 91 C215 56 198 99 245 129 C292 99 275 56 245 91 Z"/>
    <Path d="M240 232 C216 204 201 239 240 266 C279 239 264 204 240 232 Z"/>
    <Path d="M89 254 C71 231 54 259 89 281 C124 259 107 231 89 254 Z"/>
  </G> },
};

function Sticker({ filterId, face }: { filterId: PhotoFilterId; face: FaceGeometry }) {
  const sticker = STICKERS[filterId];
  if (!sticker) return null;
  const m = stickerMatrix(face, sticker.anchors).map((v) => v.toFixed(4)).join(' ');
  return <G transform={`matrix(${m})`}>{sticker.art}</G>;
}

