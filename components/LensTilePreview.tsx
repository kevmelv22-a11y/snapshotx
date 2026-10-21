import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { FaceFilterOverlay } from './FaceFilterOverlay';
import { centroid, placeholderFace } from '../lib/face-filters/geometry';
import type { PhotoFilter } from '../lib/photo-filters';
import type { ExpressionState } from '../lib/face-filters/expressions';

/** Tiles show triggered lenses mid-effect (mouth open / smiling / just blinked) so the effect is visible. */
const TILE_EXPRESSION: ExpressionState = { active: { mouthOpen: true, smile: true, blink: false }, lastRise: { mouthOpen: 0, smile: 0, blink: 0 }, count: { mouthOpen: 1, smile: 1, blink: 1 } };
const TILE_NOW_MS = 420;

/** Tile preview: the app's own filter rendered on a neutral, drawn placeholder face (no photos). */
export const LensTilePreview = React.memo(function LensTilePreview({ lens, width, height }: { lens: PhotoFilter; width: number; height: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { face, head } = useMemo(() => placeholderFace(width, height), [width, height]);
  const c = face.contours!;
  const eyes = [c.RIGHT_EYE!, c.LEFT_EYE!].map(centroid);
  const mouth = centroid([...c.UPPER_LIP_TOP!, ...c.LOWER_LIP_BOTTOM!]);
  const { cx, cy, rx, ry } = head;
  return <View style={[styles.box, { width, height }]}>
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`bg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5B5568" /><Stop offset="1" stopColor="#1E1C26" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#bg${uid})`} />
      <Ellipse cx={cx} cy={height * 1.02} rx={width * 0.5} ry={height * 0.24} fill="#3E5C82" />
      <Rect x={cx - rx * 0.4} y={cy + ry * 0.6} width={rx * 0.8} height={ry * 0.75} fill="#C88E6E" />
      <Ellipse cx={cx - rx * 0.98} cy={cy + ry * 0.02} rx={rx * 0.14} ry={ry * 0.17} fill="#D9A07F" />
      <Ellipse cx={cx + rx * 0.98} cy={cy + ry * 0.02} rx={rx * 0.14} ry={ry * 0.17} fill="#D9A07F" />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#E3AC88" />
      <Path d={`M${cx - rx * 1.02} ${cy - ry * 0.12} Q${cx - rx * 1.05} ${cy - ry * 1.12} ${cx} ${cy - ry * 1.08} Q${cx + rx * 1.05} ${cy - ry * 1.12} ${cx + rx * 1.02} ${cy - ry * 0.12} Q${cx + rx * 0.7} ${cy - ry * 0.62} ${cx} ${cy - ry * 0.66} Q${cx - rx * 0.7} ${cy - ry * 0.62} ${cx - rx * 1.02} ${cy - ry * 0.12} Z`} fill="#2B1D16" />
      {eyes.map((e, i) => <React.Fragment key={i}>
        <Ellipse cx={e.x} cy={e.y} rx={rx * 0.19} ry={rx * 0.09} fill="#F4EEE8" />
        <Ellipse cx={e.x} cy={e.y} rx={rx * 0.08} ry={rx * 0.08} fill="#3B2A22" />
        <Path d={`M${e.x - rx * 0.2} ${e.y - rx * 0.2} Q${e.x} ${e.y - rx * 0.28} ${e.x + rx * 0.2} ${e.y - rx * 0.2}`} stroke="#3A2618" strokeWidth={rx * 0.06} fill="none" strokeLinecap="round" />
      </React.Fragment>)}
      <Path d={`M${cx} ${cy + ry * 0.02} L${cx - rx * 0.09} ${cy + ry * 0.26} Q${cx} ${cy + ry * 0.3} ${cx + rx * 0.09} ${cy + ry * 0.26}`} stroke="#B97D5F" strokeWidth={rx * 0.05} fill="none" strokeLinecap="round" />
      <Ellipse cx={mouth.x} cy={mouth.y} rx={rx * 0.3} ry={rx * 0.09} fill="#B5535C" />
      {lens.kind === 'tint' && <Rect width={width} height={height} fill={lens.tint} />}
    </Svg>
    <FaceFilterOverlay filterId={lens.id} face={face} width={width} height={height} expression={TILE_EXPRESSION} nowMs={TILE_NOW_MS} />
  </View>;
});

const styles = StyleSheet.create({ box: { overflow: 'hidden' } });
